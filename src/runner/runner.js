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
      socket.emit('tayloredRunError', { error: 'Invalid XML data: must be a non-empty string.' });
      return;
    }
    const blockRegex = /[^\n]*?<taylored\s+number=["'](\d+)["'](?:\s+compute=["']([^"']*)["'])?>([\s\S]*?)[^\n]*?<\/taylored>/g;
    const matches = [...xmlData.matchAll(blockRegex)];
    if (matches.length > 0) {
      for (const match of matches) {
        const numberValue = match[1];
        const computeValue = match[2];
        const innerContent = match[3].trim();
      }
    }
    let tempDir;
    try {
      tempDir = tmp.dirSync({ unsafeCleanup: true });
      const tempDirPath = tempDir.name;
      const git = simpleGit(tempDirPath);
      await git.init(['--initial-branch=main']);
      const xmlFilePath = path.join(tempDirPath, 'runner.xml');
      await fs.writeFile(xmlFilePath, xmlData);
      await git.add(xmlFilePath);
      await git.commit('Add runner.xml');
      const tayloredProcess = spawn('npx', ['taylored', '--automatic', 'xml', 'main'], { cwd: tempDirPath });

      tayloredProcess.stdout.on('data', (data) => {
        socket.emit('tayloredOutput', { output: data.toString() });
      });

      tayloredProcess.stderr.on('data', (data) => {
        socket.emit('tayloredError', { error: data.toString() });
      });

      tayloredProcess.on('error', (error) => {
        socket.emit('tayloredRunError', { error: `Execution failed: ${error.message}` });
      });

      tayloredProcess.on('close', (code) => {
        console.log(`Command finished with code ${code}`);
      });
    } catch (err) {
      socket.emit('tayloredRunError', { error: `Server-side error: ${err.message}` });
    } finally {
      // tempDir cleanup is handled by tmp.dirSync with unsafeCleanup: true
    }
  });
});
httpServer.listen(PORT, () => {
});