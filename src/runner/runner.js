// SPDX-License-Identifier: MIT
// Copyright (c) 2025 tailot@gmail.com

const http = require('http');
const { Server } = require("socket.io");
const { exec } = require('child_process');
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
      const command = 'npx taylored --automatic xml main';
      exec(command, { cwd: tempDirPath }, (error, stdout, stderr) => {
        if (error) {
          socket.emit('tayloredRunError', { error: `Execution failed: ${error.message}` });
          return;
        }
        if (stderr) {
          console.warn(`Command "${command}" produced an error output (stderr): ${stderr}`);
          socket.emit('tayloredError', { error: stderr });
        }
        socket.emit('tayloredOutput', { output: stdout });
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