const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const Docker = require('dockerode');
const http = require('http');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const activeRunners = new Map();

function logAction(level, message, data) {
  const timestamp = new Date().toISOString();
  if (data) {
    console[level](`[${timestamp}] ${message}`, data);
  } else {
    console[level](`[${timestamp}] ${message}`);
  }
}

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
        logAction('error', 'Error finding available port.', err);
        reject(err);
    });
  });
}

app.get('/', (req, res) => {
  logAction('info', `GET / - Orchestrator status check.`);
  res.send('Orchestrator service is running!');
});

app.post('/api/runner/provision', async (req, res, next) => {
  const sessionId = req.headers['x-session-id'] || uuidv4();
  const { networkMode } = req.body; 

  logAction('info', `POST /api/runner/provision - Attempting for session: ${sessionId}, requested networkMode: ${networkMode || 'default'}`);

  if (activeRunners.has(sessionId)) {
    const existingRunner = activeRunners.get(sessionId);
    logAction('info', `Runner already exists for session ${sessionId} on port ${existingRunner.port}`);
    return res.json({
      message: 'Runner already exists for this session.',
      endpoint: `http://localhost:${existingRunner.port}`,
      sessionId: sessionId
    });
  }

  let allocatedPort;
  let containerInstance;
  const imageName = 'runner-standalone';

  try {
    if (networkMode !== 'none') {
        allocatedPort = await getAvailablePort();
        logAction('info', `Host port allocated for session ${sessionId}: ${allocatedPort}`);
    } else {
        logAction('info', `Network mode 'none' selected for session ${sessionId}. No host port will be allocated.`);
    }
    
    logAction('info', `Provisioning runner for session ${sessionId} using image ${imageName}`);

    try {
        await docker.getImage(imageName).inspect();
        logAction('info', `Image ${imageName} found locally.`);
    } catch (error) {
        if (error.statusCode === 404) {
            logAction('error', `Docker image ${imageName} not found for session ${sessionId}.`);
            return res.status(500).json({ error: 'DOCKER_IMAGE_NOT_FOUND', message: `Docker image ${imageName} not found. Build it before running the orchestrator.` });
        }
        logAction('error', `Error inspecting image ${imageName} for session ${sessionId}.`, error);
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
        logAction('warn', `WARNING: Runner for session ${sessionId} will be completely isolated (NetworkMode: 'none'). Orchestrator will NOT be able to reach it.`);
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
        logAction('info', `Runner for session ${sessionId} will be connected to custom network: ${networkMode}`);
    } else {
        containerConfig.HostConfig = {
            PortBindings: {
                '3000/tcp': [{ HostPort: allocatedPort.toString() }]
            }
        };
        logAction('info', `Runner for session ${sessionId} will use default network mode (bridge) with port binding.`);
    }

    containerInstance = await docker.createContainer(containerConfig);
    logAction('info', `Container created for session ${sessionId}: ${containerInstance.id}`);

    await containerInstance.start();
    logAction('info', `Container started for session ${sessionId}: ${containerInstance.id}`);

    const containerData = await containerInstance.inspect();
    const containerId = containerData.Id;

    activeRunners.set(sessionId, {
        containerId: containerId,
        port: allocatedPort,
        container: containerInstance
    });

    logAction('info', `Runner provisioned successfully for session ${sessionId}. Container ID: ${containerId}, Host Port: ${allocatedPort || 'N/A'}`);
    res.status(201).json({
      message: 'Runner provisioned successfully.',
      endpoint: allocatedPort ? `http://localhost:${allocatedPort}` : 'N/A (isolated network mode)',
      sessionId: sessionId
    });

  } catch (err) {
    logAction('error', `Error provisioning runner for session ${sessionId}:`, err.message || err);
    if (containerInstance) {
      try {
        const contState = await containerInstance.inspect().catch(() => null);
        if (contState) {
            logAction('info', `Cleaning up failed container ${containerInstance.id} for session ${sessionId}.`);
            if (contState.State.Running) {
                 await containerInstance.stop().catch(e => logAction('error', `Error stopping failed container ${containerInstance.id}:`, e));
            }
            await containerInstance.remove({ force: true }).catch(e => logAction('error', `Error removing failed container ${containerInstance.id}:`, e));
        }
      } catch (cleanupErr) {
        logAction('error', `Critical error during cleanup of failed container ${containerInstance.id} for session ${sessionId}:`, cleanupErr);
      }
    }
    activeRunners.delete(sessionId);
    next(err);
  }
});

app.post('/api/runner/deprovision', async (req, res, next) => {
  const sessionId = req.body.sessionId || req.headers['x-session-id'];
  logAction('info', `POST /api/runner/deprovision - Attempting for session: ${sessionId}`);

  if (!sessionId) {
    logAction('warn', 'Deprovisioning attempt without session ID.');
    return res.status(400).json({ error: 'SESSION_ID_REQUIRED', message: 'Session ID is required for deprovisioning.' });
  }

  const runnerInfo = activeRunners.get(sessionId);

  if (!runnerInfo) {
    logAction('warn', `No active runner found for session ${sessionId} to deprovision.`);
    return res.status(404).json({ error: 'RUNNER_NOT_FOUND', message: 'No active runner found for this session ID.' });
  }

  const { container, port, containerId } = runnerInfo;

  try {
    logAction('info', `Attempting to deprovision runner for session ${sessionId}, container ID: ${container.id || containerId}, port: ${port || 'N/A'}`);

    const containerState = await container.inspect().catch(err => {
        if (err.statusCode === 404) {
            logAction('info', `Container ${container.id || containerId} for session ${sessionId} already removed (inspect returned 404).`);
            return null;
        }
        logAction('error', `Error inspecting container ${container.id || containerId} for session ${sessionId} during deprovision:`, err);
        throw err;
    });

    if (containerState) {
        if (containerState.State.Running) {
            logAction('info', `Stopping container ${container.id} for session ${sessionId}.`);
            await container.stop().catch(err => {
                logAction('error', `Error stopping container ${container.id} for session ${sessionId}: ${err.message}. Will attempt force remove.`);
            });
        }
        logAction('info', `Removing container ${container.id} for session ${sessionId}.`);
        await container.remove({ force: true });
        logAction('info', `Container ${container.id} for session ${sessionId} stopped and removed.`);
    }

    activeRunners.delete(sessionId);
    logAction('info', `Runner for session ${sessionId} removed from active map.`);
    res.status(200).json({ message: `Runner for session ${sessionId} deprovisioned successfully.` });

  } catch (err) {
    logAction('error', `Error deprovisioning runner for session ${sessionId}:`, err.message || err);
    activeRunners.delete(sessionId);
    next(err);
  }
});

app.use((err, req, res, next) => {
  logAction('error', 'Unhandled error in orchestrator:', {
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack
  });

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
  logAction('info', `Orchestrator service listening on port ${port}`);
});

module.exports = app;
