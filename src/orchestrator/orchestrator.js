const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const Docker = require('dockerode');
const http = require('http');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const app = express();
const port = 3001;

const REUSE_RUNNER_MODE = process.env.REUSE_RUNNER_MODE === 'true';
const DEFAULT_INACTIVE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const INACTIVE_TIMEOUT_MS = parseInt(process.env.INACTIVE_RUNNER_TIMEOUT_MS, 10) > 0 ? parseInt(process.env.INACTIVE_RUNNER_TIMEOUT_MS, 10) : DEFAULT_INACTIVE_TIMEOUT_MS;
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
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
      return res.json({
        message: 'Returning existing singleton runner.',
        endpoint: `http://localhost:${singletonRunnerInstance.port}`,
        sessionId: singletonRunnerInstance.sessionId
      });
    }
  }
  const sessionId = req.headers['x-session-id'] || uuidv4();
  const { networkMode } = req.body; 

  if (activeRunners.has(sessionId)) {
    const existingRunner = activeRunners.get(sessionId);
    existingRunner.lastActivityTime = Date.now(); // Add this line
    // Note: If you're using a Map and storing objects, this modification should directly update the object in the Map.
    // If for some reason it doesn't, you might need to activeRunners.set(sessionId, existingRunner) after updating,
    // but for standard JavaScript Map behavior with object references, direct modification is fine.
    return res.json({
      message: 'Runner already exists for this session.',
      endpoint: `http://localhost:${existingRunner.port}`,
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
        lastActivityTime: Date.now() // Add this line
    };

    if (REUSE_RUNNER_MODE) {
        singletonRunnerInstance = runnerDetails;
    } else {
        activeRunners.set(sessionId, runnerDetails);
    }

    res.status(201).json({
      message: 'Runner provisioned successfully.',
      endpoint: allocatedPort ? `http://localhost:${allocatedPort}` : 'N/A (isolated network mode)',
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

  const { container, port, containerId } = runnerInfo;

  try {
    const containerState = await container.inspect().catch(err => {
        if (err.statusCode === 404) {
            return null;
        }
        throw err;
    });

    if (containerState) {
        if (containerState.State.Running) {
            await container.stop().catch(err => {
            });
        }
        await container.remove({ force: true });
    }

    activeRunners.delete(sessionId);
    res.status(200).json({ message: `Runner for session ${sessionId} deprovisioned successfully.` });

  } catch (err) {
    activeRunners.delete(sessionId);
    next(err);
  }
});

async function cleanupInactiveRunners() {
  console.log('Running cleanup for inactive runners...');
  const now = Date.now();
  for (const [sessionId, runner] of activeRunners.entries()) {
    if (now - runner.lastActivityTime > INACTIVE_TIMEOUT_MS) {
      console.log(`Runner for session ${sessionId} (container: ${runner.containerId}) is inactive. Removing...`);
      try {
        const containerState = await runner.container.inspect().catch(err => {
          if (err.statusCode === 404) { // Container already removed
            return null;
          }
          throw err; // Other errors should be propagated or logged
        });

        if (containerState) { // If container exists
          if (containerState.State.Running) {
            console.log(`Stopping container ${runner.containerId}...`);
            await runner.container.stop().catch(e => console.error(`Error stopping container ${runner.containerId}:`, e.message));
          }
          console.log(`Removing container ${runner.containerId}...`);
          await runner.container.remove({ force: true }).catch(e => console.error(`Error removing container ${runner.containerId}:`, e.message));
        }
        activeRunners.delete(sessionId);
        console.log(`Runner for session ${sessionId} (container: ${runner.containerId}) removed successfully due to inactivity.`);
      } catch (err) {
        console.error(`Error during cleanup of runner for session ${sessionId} (container: ${runner.containerId}):`, err.message);
        // Decide if we should remove it from activeRunners even if cleanup failed partially
        // For now, let's remove it to prevent repeated attempts on a problematic container/runner
        activeRunners.delete(sessionId);
      }
    }
  }
  console.log('Finished cleanup for inactive runners.');
}

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
});

// After app.listen(...)
setInterval(cleanupInactiveRunners, CLEANUP_INTERVAL_MS);

// For testing purposes:
const existingExports = module.exports; // Could be 'app' if 'module.exports = app' was used
module.exports = {
  ...(typeof existingExports === 'object' && existingExports !== null ? existingExports : { app: existingExports }),
  __cleanupInactiveRunners: typeof cleanupInactiveRunners !== 'undefined' ? cleanupInactiveRunners : undefined,
  get __activeRunners() { return typeof activeRunners !== 'undefined' ? activeRunners : undefined; },
  get __INACTIVE_TIMEOUT_MS() { return typeof INACTIVE_TIMEOUT_MS !== 'undefined' ? INACTIVE_TIMEOUT_MS : undefined; }
  // Note: activeRunners and INACTIVE_TIMEOUT_MS are exported via getters to ensure tests get the actual variables from the module's scope.
  // Docker instance is typically mocked via jest.mock('dockerode').
};
