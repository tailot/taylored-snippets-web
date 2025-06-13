/**
 * @file orchestrator.js
 * @description This module is an Express application that acts as an orchestrator for managing
 * Docker-based runner instances. It handles provisioning new runners, deprovisioning them,
 * tracking their activity via heartbeats, and cleaning up inactive runners.
 * Runners are isolated environments where code snippets can be executed.
 * The orchestrator communicates with Docker to start and stop runner containers.
 * It supports a standard mode where each session gets a new runner, and a REUSE_RUNNER_MODE
 * where a single runner instance is reused.
 */
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const Docker = require('dockerode');
const http = require('http');
const path = require('path');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

/**
 * @const {number} INACTIVITY_TIMEOUT_SECONDS
 * @description The time in seconds after which an inactive runner will be cleaned up.
 * Defaults to 60 seconds if not set via environment variable `INACTIVITY_TIMEOUT_SECONDS`.
 */
const INACTIVITY_TIMEOUT_SECONDS = parseInt(process.env.INACTIVITY_TIMEOUT_SECONDS, 10) || 60;
/**
 * @const {number} CLEANUP_INTERVAL_SECONDS
 * @description The interval in seconds at which the orchestrator checks for and cleans up inactive runners.
 * Defaults to 30 seconds.
 */
const CLEANUP_INTERVAL_SECONDS = 30;

/**
 * @const {number} NUM_MAPPED_PORTS
 * @description The number of ports to map for each runner, starting from container port 3000 downwards.
 * Read from the `FREE_DOORS` environment variable. Defaults to 0 if not set or invalid.
 */
let NUM_MAPPED_PORTS = 0;
const freeDoorsEnv = process.env.FREE_DOORS;
if (freeDoorsEnv !== undefined) {
    const parsed = parseInt(freeDoorsEnv, 10);
    if (!isNaN(parsed) && parsed >= 0) {
        NUM_MAPPED_PORTS = parsed;
    } else {
        console.warn(`[Orchestrator Config] FREE_DOORS environment variable ("${freeDoorsEnv}") is invalid. Must be a non-negative integer. Defaulting to 0.`);
    }
}

const app = express();
const port = 3001;

/**
 * @const {boolean} REUSE_RUNNER_MODE
 * @description If true, the orchestrator will attempt to reuse a single runner instance
 * for all sessions, instead of provisioning a new one for each.
 * Controlled by the `REUSE_RUNNER_MODE` environment variable.
 */
const REUSE_RUNNER_MODE = process.env.REUSE_RUNNER_MODE === 'true';
/**
 * @const {string} RUNNERS_HOST
 * @description The hostname or IP address that clients should use to connect to the runners.
 * Defaults to 'localhost'. Controlled by the `RUNNERS_HOST` environment variable.
 */
const RUNNERS_HOST = process.env.RUNNERS_HOST || 'localhost';
/**
 * @type {Object|null}
 * @description Stores the details of the singleton runner instance if `REUSE_RUNNER_MODE` is true.
 * Contains properties like `containerId`, `port`, `container` (Dockerode object), `sessionId`, `lastActivityTime`.
 */
let singletonRunnerInstance = null;

app.use(cors());
app.use(express.json());

/**
 * @type {Map<string, Object>}
 * @description A map storing active runner instances, keyed by session ID.
 * Each value is an object containing details about the runner:
 * `containerId`, `port`, `container` (Dockerode object), `sessionId`, `lastActivityTime`.
 * This is not used if `REUSE_RUNNER_MODE` is true.
 */
const activeRunners = new Map();

/**
 * Finds an available port on the host machine by temporarily starting a server.
 * @async
 * @returns {Promise<number>} A promise that resolves with an available port number.
 * @throws {Error} If an error occurs while trying to find a port.
 */
function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, () => {
      const assignedPort = server.address().port;
      server.close(() => {
        resolve(assignedPort);
      });
    });
    server.on('error', (err) => {
        reject(err);
    });
  });
}

/**
 * @route GET /
 * @description Basic health check endpoint.
 * @param {express.Request} req - The Express request object.
 * @param {express.Response} res - The Express response object.
 */
app.get('/', (req, res) => {
  res.send('Orchestrator service is running!');
});

/**
 * @route POST /api/runner/provision
 * @description Provisions a new runner instance or returns an existing one based on session ID or reuse mode.
 * It creates a new Docker container for the runner.
 * Request headers:
 *  - 'x-session-id' (optional): Client-provided session ID. If not provided, a new UUID is generated.
 * Request body (JSON):
 *  - 'networkMode' (optional): Specifies the Docker network mode for the container (e.g., 'none', 'bridge').
 * Responses:
 *  - 201 Created: If a new runner is provisioned.
 *    Body: { message: string, endpoint: string, sessionId: string }
 *    'endpoint' is the host:port for the runner, or 'N/A (isolated network mode)' if networkMode is 'none'.
 *  - 200 OK: If an existing runner is reused (for the same session or in REUSE_RUNNER_MODE).
 *    Body: { message: string, endpoint: string, sessionId: string }
 *  - 500 Internal Server Error: If provisioning fails (e.g., Docker image not found, port allocation error).
 *    Body: { error: string, message: string, details?: string }
 * @param {express.Request} req - The Express request object.
 * @param {express.Response} res - The Express response object.
 * @param {express.NextFunction} next - The Express next middleware function.
 */
app.post('/api/runner/provision', async (req, res, next) => {
  if (REUSE_RUNNER_MODE) {
    if (singletonRunnerInstance) {
      singletonRunnerInstance.lastActivityTime = Date.now();
      return res.json({
        message: 'Returning existing singleton runner.',
        endpoint: `${RUNNERS_HOST}:${singletonRunnerInstance.port}`,
        sessionId: singletonRunnerInstance.sessionId
      });
    }
  }
  const sessionId = req.headers['x-session-id'] || uuidv4();
  const { networkMode } = req.body; 

  if (activeRunners.has(sessionId)) {
    const existingRunner = activeRunners.get(sessionId);
    existingRunner.lastActivityTime = Date.now();
    return res.json({
      message: 'Runner already exists for this session.',
      endpoint: `${RUNNERS_HOST}:${existingRunner.port}`,
      sessionId: sessionId
    });
  }

  let allocatedPort;
  let containerInstance;
  const portBindings = {};
  const imageName = 'runner-image';

  try {
    if (networkMode !== 'none') {
        if (NUM_MAPPED_PORTS >= 0) {
            // Map the primary port (container 3000)
            try {
                allocatedPort = await getAvailablePort();
                portBindings['3000/tcp'] = [{ HostPort: allocatedPort.toString() }];
            } catch (portError) {
                console.error(`[Provisioning Error] Failed to get an available host port for primary container port 3000: ${portError.message}`);
                throw new Error(`Failed to secure host port for primary container port 3000. Provisioning aborted.`);
            }

            // Map additional N-1 ports (if NUM_MAPPED_PORTS > 1)
            for (let i = 1; i <= NUM_MAPPED_PORTS; i++) {
                const containerPortToMap = 3000 - i;
                if (containerPortToMap <= 0) {
                    console.warn(`[Provisioning Warning] Skipping mapping for non-positive container port: ${containerPortToMap}`);
                    break;
                }
                const hostPortToMap = containerPortToMap;
                portBindings[`${containerPortToMap}/tcp`] = [{ HostPort: hostPortToMap.toString() }];
            }
        }
        // If NUM_MAPPED_PORTS is 0, allocatedPort remains undefined, portBindings remains empty.
    }

    try {
        await docker.getImage(imageName).inspect();
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(500).json({ error: 'DOCKER_IMAGE_NOT_FOUND', message: `Docker image ${imageName} not found. Build it before running the orchestrator.` });
        }
        throw error;
    }

    let containerConfig = {
      Image: imageName,
      Env: [`PORT=3000`],
      Labels: {
        'taylored-runner-session-id': sessionId
      }
      // HostConfig will be populated based on networkMode and NUM_MAPPED_PORTS
    };

    if (networkMode === 'none') {
        containerConfig.HostConfig = { NetworkMode: 'none' };
        // allocatedPort would be undefined, portBindings is empty.
        // The endpoint response correctly reflects 'N/A'.
    } else { // Covers default bridge and specified networkMode
        containerConfig.HostConfig = { PortBindings: portBindings };
        if (networkMode) { // If a specific network (e.g., custom bridge) is provided
            containerConfig.NetworkingConfig = {
                EndpointsConfig: {
                    [networkMode]: {}
                }
            };
        }
        // If networkMode is falsy (e.g., undefined), it uses default bridge,
        // HostConfig.PortBindings (even if empty for NUM_MAPPED_PORTS=0) is sufficient.
    }

    containerInstance = await docker.createContainer(containerConfig);

    await containerInstance.start();

    const containerData = await containerInstance.inspect();
    const containerId = containerData.Id;

    const runnerDetails = {
        containerId: containerId,
        port: allocatedPort, // This is the host port for container's 3000. Undefined if no ports mapped.
        container: containerInstance,
        sessionId: sessionId,
        lastActivityTime: Date.now()
    };

    if (REUSE_RUNNER_MODE) {
        singletonRunnerInstance = runnerDetails;
    } else {
        activeRunners.set(sessionId, runnerDetails);
    }

    res.status(201).json({
      message: 'Runner provisioned successfully.',
      // allocatedPort will be undefined if networkMode is 'none' or NUM_MAPPED_PORTS is 0
      endpoint: allocatedPort ? `${RUNNERS_HOST}:${allocatedPort}` : 'N/A (isolated network or no ports mapped)',
      sessionId: sessionId
    });

  } catch (err) {
    if (containerInstance) {
      try {
        const contState = await containerInstance.inspect().catch(() => null);
        if (contState) {
            if (contState.State.Running) {
                 await containerInstance.stop().catch(e => console.error(`Error stopping container during cleanup: ${e.message}`));
            }
            await containerInstance.remove({ force: true }).catch(e => console.error(`Error removing container during cleanup: ${e.message}`));
        };
      } catch (cleanupErr) {
        console.error(`Error during container cleanup: ${cleanupErr.message}`);
      }
    }
    activeRunners.delete(sessionId);
    next(err);
  }
});

/**
 * @route POST /api/runner/heartbeat
 * @description Receives a heartbeat from a runner instance, updating its last activity time.
 * This prevents active runners from being cleaned up by the inactivity monitor.
 * Request body (JSON) or Headers:
 *  - 'sessionId' (in body) or 'x-session-id' (in header): The session ID of the runner sending the heartbeat.
 * Responses:
 *  - 200 OK: If heartbeat is successfully processed.
 *    Body: { message: string }
 *  - 400 Bad Request: If session ID is missing.
 *    Body: { error: 'SESSION_ID_REQUIRED', message: string }
 *  - 404 Not Found: If no runner is found for the given session ID.
 *    Body: { error: 'RUNNER_NOT_FOUND', message: string }
 * @param {express.Request} req - The Express request object.
 * @param {express.Response} res - The Express response object.
 */
app.post('/api/runner/heartbeat', (req, res) => {
  const sessionId = req.body.sessionId || req.headers['x-session-id'];

  if (!sessionId) {
    return res.status(400).json({ error: 'SESSION_ID_REQUIRED', message: 'Session ID is required for heartbeat.' });
  }

  if (REUSE_RUNNER_MODE) {
    if (singletonRunnerInstance && singletonRunnerInstance.sessionId === sessionId) {
      singletonRunnerInstance.lastActivityTime = Date.now();
      return res.status(200).json({ message: 'Heartbeat received for singleton runner.' });
    } else {
      return res.status(404).json({ error: 'RUNNER_NOT_FOUND', message: 'Singleton runner not found or session ID mismatch.' });
    }
  } else {
    const runnerInfo = activeRunners.get(sessionId);
    if (runnerInfo) {
      runnerInfo.lastActivityTime = Date.now();
      return res.status(200).json({ message: `Heartbeat received for session ${sessionId}.` });
    } else {
      return res.status(404).json({ error: 'RUNNER_NOT_FOUND', message: 'No active runner found for this session ID.' });
    }
  }
});

/**
 * @route POST /api/runner/deprovision
 * @description Deprovisions (stops and removes) a runner instance associated with a given session ID.
 * This endpoint is disabled if `REUSE_RUNNER_MODE` is true.
 * Request body (JSON) or Headers:
 *  - 'sessionId' (in body) or 'x-session-id' (in header): The session ID of the runner to deprovision.
 * Responses:
 *  - 200 OK: If the runner is successfully deprovisioned or if deprovisioning is disabled.
 *    Body: { message: string }
 *  - 400 Bad Request: If session ID is missing.
 *    Body: { error: 'SESSION_ID_REQUIRED', message: string }
 *  - 404 Not Found: If no runner is found for the given session ID.
 *    Body: { error: 'RUNNER_NOT_FOUND', message: string }
 *  - 500 Internal Server Error: If an error occurs during container stop/removal.
 * @param {express.Request} req - The Express request object.
 * @param {express.Response} res - The Express response object.
 * @param {express.NextFunction} next - The Express next middleware function.
 */
app.post('/api/runner/deprovision', async (req, res, next) => {
  if (REUSE_RUNNER_MODE) {
      return res.status(200).json({ message: 'Deprovisioning is disabled in REUSE_RUNNER_MODE.' });
  }
  const sessionId = req.body.sessionId || req.headers['x-session-id'];

  if (!sessionId) {
    return res.status(400).json({ error: 'SESSION_ID_REQUIRED', message: 'Session ID is required for deprovisioning.' });
  }

  const runnerInfo = activeRunners.get(sessionId);

  if (!runnerInfo) {
    return res.status(404).json({ error: 'RUNNER_NOT_FOUND', message: 'No active runner found for this session ID.' });
  }

  const { container, sessionId: runnerSessionId } = runnerInfo; // Renamed sessionId to avoid conflict

  try {
    await stopAndRemoveContainer(container, runnerSessionId);
    activeRunners.delete(runnerSessionId);
    res.status(200).json({ message: `Runner for session ${runnerSessionId} deprovisioned successfully.` });
  } catch (err) {
    // stopAndRemoveContainer already logs errors.
    // We still delete the runner from activeRunners as it might be in an inconsistent state.
    activeRunners.delete(runnerSessionId);
    next(err); // Pass to the generic error handler
  }
});

/**
 * Stops and removes a Docker container.
 * @async
 * @param {Docker.Container} container - The Dockerode container object to stop and remove.
 * @param {string} sessionId - The session ID associated with the container, for logging purposes.
 * @throws {Error} If an unexpected error occurs during inspection, stop, or removal,
 *                 other than the container already being removed (404 on inspect).
 */
async function stopAndRemoveContainer(container, sessionId) {
  if (!container) {
    console.log(`[Session: ${sessionId}] No container object provided for cleanup.`);
    return;
  }
  try {
    const containerState = await container.inspect().catch(err => {
      if (err.statusCode === 404) {
        console.log(`[Session: ${sessionId}] Container already removed (404).`);
        return null; // Container doesn't exist
      }
      // For other errors (network, Docker daemon issues), rethrow to be caught by the caller.
      console.error(`[Session: ${sessionId}] Error inspecting container: ${err.message}`);
      throw err;
    });

    if (containerState) {
      if (containerState.State.Running) {
        console.log(`[Session: ${sessionId}] Stopping container...`);
        await container.stop().catch(err => {
          // Log stop errors but attempt removal anyway
          console.error(`[Session: ${sessionId}] Error stopping container: ${err.message}`);
        });
      }
      console.log(`[Session: ${sessionId}] Removing container...`);
      await container.remove({ force: true }).catch(err => {
        console.error(`[Session: ${sessionId}] Error removing container: ${err.message}`);
        // If removal fails, it might be an issue for manual cleanup, but we've done our best.
      });
    }
  } catch (err) {
    // This catch is for errors rethrown from inspect or other unexpected issues
    console.error(`[Session: ${sessionId}] An unexpected error occurred during stop/remove: ${err.message}`);
    // The caller should handle whether to remove the runner from tracking structures.
    throw err; // Re-throw so the caller can decide how to proceed
  }
}

/**
 * Periodically cleans up inactive runner instances.
 * Iterates through `activeRunners` (or checks `singletonRunnerInstance`) and removes any runner
 * whose `lastActivityTime` exceeds `INACTIVITY_TIMEOUT_SECONDS`.
 * This function is intended to be called at intervals by `setInterval`.
 * @async
 */
async function cleanupInactiveRunners() {
  console.log('Starting cleanup of inactive runners...');
  const now = Date.now();
  const timeoutMilliseconds = INACTIVITY_TIMEOUT_SECONDS * 1000;

  if (REUSE_RUNNER_MODE) {
    if (singletonRunnerInstance && (now - singletonRunnerInstance.lastActivityTime > timeoutMilliseconds)) {
      console.log(`Cleaning up inactive singleton runner (Session ID: ${singletonRunnerInstance.sessionId})...`);
      try {
        await stopAndRemoveContainer(singletonRunnerInstance.container, singletonRunnerInstance.sessionId);
        singletonRunnerInstance = null;
        console.log('Singleton runner cleaned up.');
      } catch (error) {
        console.error(`Error cleaning up singleton runner (Session ID: ${singletonRunnerInstance.sessionId}): ${error.message}`);
        // Depending on the error, we might leave singletonRunnerInstance as is, or set to null.
        // For now, setting to null to allow reprovisioning if the container is truly gone.
        singletonRunnerInstance = null;
      }
    }
  } else {
    for (const [sessionId, runnerInfo] of activeRunners.entries()) {
      if (now - runnerInfo.lastActivityTime > timeoutMilliseconds) {
        console.log(`Cleaning up inactive runner for session ${sessionId}...`);
        try {
          await stopAndRemoveContainer(runnerInfo.container, sessionId);
          activeRunners.delete(sessionId);
          console.log(`Runner for session ${sessionId} cleaned up.`);
        } catch (error) {
          console.error(`Error cleaning up runner for session ${sessionId}: ${error.message}`);
          // If stopAndRemoveContainer fails, the runner might still be there.
          // We'll remove it from activeRunners to prevent further automated attempts if the error was severe.
          activeRunners.delete(sessionId);
        }
      }
    }
  }
  console.log('Cleanup of inactive runners finished.');
}

/**
 * Generic error handling middleware for Express.
 * Logs the error and sends a JSON response to the client.
 * In non-production environments, may include error details in the response.
 * @param {Error} err - The error object.
 * @param {express.Request} req - The Express request object.
 * @param {express.Response} res - The Express response object.
 * @param {express.NextFunction} next - The Express next middleware function.
 */
app.use((err, req, res, next) => {
  const clientError = {
    error: 'SERVER_ERROR',
    message: 'An unexpected error occurred on the server.'
  };
  if (process.env.NODE_ENV !== 'production' && err.message) {
    clientError.details = err.message;
  }

  res.status(err.statusCode || 500).json(clientError);
});

// Start the Express server
app.listen(port, () => {
  console.log(`Orchestrator listening on port ${port}`);
  console.log(`Using INACTIVITY_TIMEOUT_SECONDS: ${INACTIVITY_TIMEOUT_SECONDS}s`);
  console.log(`Orchestrator will cleanup inactive runners every ${CLEANUP_INTERVAL_SECONDS} seconds.`);
  console.log(`REUSE_RUNNER_MODE is ${REUSE_RUNNER_MODE ? 'enabled' : 'disabled'}.`);
  console.log(`RUNNERS_HOST is set to '${RUNNERS_HOST}'.`);
  console.log(`Number of ports to map per runner (FREE_DOORS): ${NUM_MAPPED_PORTS}`);
});

// Set up a recurring task to clean up inactive runners.
setInterval(cleanupInactiveRunners, CLEANUP_INTERVAL_SECONDS * 1000);

module.exports = app;
