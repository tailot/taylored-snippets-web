// SPDX-License-Identifier: MIT
// Copyright (c) 2025 tailot@gmail.com

const http = require('http');
const { Server } = require("socket.io");
const { spawn } = require('child_process');
const simpleGit = require('simple-git');
const tmp = require('tmp');
const fs = require('fs').promises;
const path = require('path');
const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
  socket.on('disconnect', () => {
  });

  socket.on('tayloredRun', async (xmlDataRequest) => {
    const xmlData = xmlDataRequest.body;
    
    if (typeof xmlData !== 'string' || xmlData.trim() === '') {
      return socket.emit('tayloredRunError', { error: 'Invalid XML data: must be a non-empty string.' });
    }

    const blockRegex = /[^\n]*?<taylored\s+number=["'](\d+)["'](?:\s+compute=["']([^"']*)["'])?>([\s\S]*?)[^\n]*?<\/taylored>/g;
    const matches = [...xmlData.matchAll(blockRegex)];

    let numberValue = null;
    if (matches.length > 0) {
      numberValue = matches[0][1];
    } else {
      return socket.emit('tayloredRunError', { error: 'Could not extract snippet ID (number) from XML data.' });
    }

    let tempDir;
    try {
      tempDir = tmp.dirSync({ unsafeCleanup: true });
      const tempDirPath = tempDir.name;
      
      const git = simpleGit(tempDirPath);
      await git.init(['--initial-branch=main']);
      await git.addConfig('user.name', 'Taylored Runner');
      await git.addConfig('user.email', 'bot@taylored.run');
      
      const xmlFilePath = path.join(tempDirPath, 'runner.xml');
      await fs.writeFile(xmlFilePath, xmlData);
      await git.add(xmlFilePath);
      await git.commit('Add runner.xml');
      
      const tayloredProcess = spawn('npx', ['taylored', '--automatic', 'xml', 'main'], { cwd: tempDirPath });

      tayloredProcess.stdout.on('data', (data) => {
        const output = data.toString();
        socket.emit('tayloredOutput', { id: parseInt(numberValue, 10), output: output });
      });

      tayloredProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        socket.emit('tayloredError', { id: parseInt(numberValue, 10), error: errorOutput });
      });

      tayloredProcess.on('error', (error) => {
        socket.emit('tayloredRunError', { id: numberValue ? parseInt(numberValue, 10) : null, error: `Execution failed: ${error.message}` });
      });

      tayloredProcess.on('close', (code) => {
      });

    } catch (err) {
      socket.emit('tayloredRunError', { id: numberValue ? parseInt(numberValue, 10) : null, error: `Server-side error: ${err.message}` });
    } finally {
      // tempDir cleanup is handled by tmp.dirSync with unsafeCleanup: true
    }
  });
});

httpServer.listen(PORT, () => {
});