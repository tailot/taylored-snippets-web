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
console.log(`[Info] Runner service starting on port ${PORT}`);

io.on('connection', (socket) => {
  console.log(`[Connection] New client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Connection] Client disconnected: ${socket.id}`);
  });

  socket.on('tayloredRun', async (xmlDataRequest) => {
    console.log('[tayloredRun] Received tayloredRun event.');
    const xmlData = xmlDataRequest.body;
    
    if (typeof xmlData !== 'string' || xmlData.trim() === '') {
      console.error('[tayloredRun] Invalid XML data received.');
      return socket.emit('tayloredRunError', { error: 'Invalid XML data: must be a non-empty string.' });
    }
    console.log('[tayloredRun] Snippet XML received:\n', xmlData);

    const blockRegex = /[^\n]*?<taylored\s+number=["'](\d+)["'](?:\s+compute=["']([^"']*)["'])?>([\s\S]*?)[^\n]*?<\/taylored>/g;
    const matches = [...xmlData.matchAll(blockRegex)];

    let numberValue = null;
    if (matches.length > 0) {
      numberValue = matches[0][1];
      console.log(`[tayloredRun] Extracted Snippet ID: ${numberValue}`);
    } else {
      console.error('[tayloredRun] Could not extract snippet ID from XML.');
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
      console.log(`[Debug] Spawning command: npx taylored --automatic xml main in ${tempDirPath}`);

      tayloredProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[tayloredProcess stdout] Streaming output for ID ${numberValue}:\n`, output);
        socket.emit('tayloredOutput', { id: parseInt(numberValue, 10), output: output });
      });

      tayloredProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        console.error(`[tayloredProcess stderr] Streaming error for ID ${numberValue}:\n`, errorOutput);
        socket.emit('tayloredError', { id: parseInt(numberValue, 10), error: errorOutput });
      });

      tayloredProcess.on('error', (error) => {
        console.error('[tayloredProcess error]', error);
        socket.emit('tayloredRunError', { id: numberValue ? parseInt(numberValue, 10) : null, error: `Execution failed: ${error.message}` });
      });

      tayloredProcess.on('close', (code) => {
        console.log(`[tayloredProcess] Command finished for ID ${numberValue} with code ${code}`);
      });

    } catch (err) {
      console.error('[Server Error]', err);
      socket.emit('tayloredRunError', { id: numberValue ? parseInt(numberValue, 10) : null, error: `Server-side error: ${err.message}` });
    } finally {
      // tempDir cleanup is handled by tmp.dirSync with unsafeCleanup: true
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[Info] Runner is listening on port ${PORT}`);
});