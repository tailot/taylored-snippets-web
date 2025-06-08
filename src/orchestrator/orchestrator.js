const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const Docker = require('dockerode');
const http = require('http');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

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
        sessionId: sessionId
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

module.exports = app;
