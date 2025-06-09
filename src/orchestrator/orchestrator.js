const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const Docker = require('dockerode');
const http = require('http');
const tar = require('tar-stream');
const path = require('path');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const INACTIVITY_TIMEOUT_SECONDS = parseInt(process.env.INACTIVITY_TIMEOUT_SECONDS, 10) || 60; // Default to 5 minutes if not set
const CLEANUP_INTERVAL_SECONDS = 30;

const app = express();
const port = 3001;

const REUSE_RUNNER_MODE = process.env.REUSE_RUNNER_MODE === 'true';
const RUNNERS_HOST = process.env.RUNNERS_HOST || 'localhost';
let singletonRunnerInstance = null;

app.use(cors());
app.use(express.json());

const activeRunners = new Map();

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

app.get('/', (req, res) => {
  res.send('Orchestrator service is running!');
});

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
  const imageName = 'runner-image';

  try {
    if (networkMode !== 'none') {
        allocatedPort = await getAvailablePort();
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
    };

    if (networkMode === 'none') {
        containerConfig.HostConfig = {
            NetworkMode: 'none'
        };
    } else if (networkMode) {
        containerConfig.HostConfig = {
            PortBindings: {
                '3000/tcp': [{ HostPort: allocatedPort.toString() }]
            }
        };
        containerConfig.NetworkingConfig = {
            EndpointsConfig: {
                [networkMode]: {}
            }
        };
    } else {
        containerConfig.HostConfig = {
            PortBindings: {
                '3000/tcp': [{ HostPort: allocatedPort.toString() }]
            }
        };
    }

    containerInstance = await docker.createContainer(containerConfig);

    await containerInstance.start();

    const containerData = await containerInstance.inspect();
    const containerId = containerData.Id;

    const runnerDetails = {
        containerId: containerId,
        port: allocatedPort,
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
      endpoint: allocatedPort ? `${RUNNERS_HOST}:${allocatedPort}` : 'N/A (isolated network mode)',
      sessionId: sessionId
    });

  } catch (err) {
    if (containerInstance) {
      try {
        const contState = await containerInstance.inspect().catch(() => null);
        if (contState) {
            if (contState.State.Running) {
                 await containerInstance.stop().catch(e => {});
            }
            await containerInstance.remove({ force: true }).catch(e => {});
        }
      } catch (cleanupErr) {
      }
    }
    activeRunners.delete(sessionId);
    next(err);
  }
});

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

app.get('/api/runner/download/:sessionId/:encodedFilePath', async (req, res, next) => {
  // TODO: Implement file download logic
 
});

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


app.listen(port, () => {
  // Startup message can be kept if desired, or removed. For now, I'll remove it to be consistent.
  console.log(`Orchestrator listening on port ${port}`);
  console.log(`Using INACTIVITY_TIMEOUT_SECONDS: ${INACTIVITY_TIMEOUT_SECONDS}s`);
  console.log(`Orchestrator will cleanup inactive runners every ${CLEANUP_INTERVAL_SECONDS} seconds.`);
});

setInterval(cleanupInactiveRunners, CLEANUP_INTERVAL_SECONDS * 1000);

module.exports = app;
