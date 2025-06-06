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
    origin: "*", // Allow all origins for simplicity, configure as needed for production
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  socket.on('tayloredRun', async (xmlData) => {
    console.log(`Received tayloredRun event from ${socket.id}.`);
    if (typeof xmlData !== 'string' || xmlData.trim() === '') {
      console.error('XML data is not a valid string or is empty.');
      socket.emit('tayloredRunError', { error: 'Invalid XML data: must be a non-empty string.' });
      return;
    }

    let tempDir;
    try {
      // Create a temporary directory
      tempDir = tmp.dirSync({ unsafeCleanup: true });
      const tempDirPath = tempDir.name;
      console.log(`Temporary directory created: ${tempDirPath}`);

      // Initialize git repository
      const git = simpleGit(tempDirPath);
      await git.init();
      console.log(`Git repository initialized in ${tempDirPath}`);

      // Write XML content to runner.xml
      const xmlFilePath = path.join(tempDirPath, 'runner.xml');
      await fs.writeFile(xmlFilePath, xmlData);
      console.log(`XML data written to ${xmlFilePath}`);

      // Add and commit runner.xml
      await git.add(xmlFilePath);
      await git.commit('Add runner.xml');
      console.log(`runner.xml committed in ${tempDirPath}`);

      // Execute taylored command
      const command = 'npx --no-install taylored --automatic xml';
      console.log(`Executing command: ${command} in ${tempDirPath}`);

      exec(command, { cwd: tempDirPath }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Execution error for command "${command}": ${error.message}`);
          socket.emit('tayloredRunError', { error: `Execution failed: ${error.message}` });
          return;
        }

        if (stderr) {
          console.warn(`Command "${command}" produced stderr: ${stderr}`);
          socket.emit('tayloredError', { error: stderr });
          // Continue to send stdout even if there's stderr, as taylored might output useful info to stdout
        }

        console.log(`Command "${command}" produced stdout: ${stdout}`);
        socket.emit('tayloredOutput', { output: stdout });
      });

    } catch (err) {
      console.error('Error processing tayloredRun:', err);
      socket.emit('tayloredRunError', { error: `Server-side error: ${err.message}` });
    } finally {
      // tmp.dirSync({ unsafeCleanup: true }) should handle cleanup.
      // If not, manual cleanup would be: if (tempDir) { tempDir.removeCallback(); }
      // For now, relying on unsafeCleanup.
      if (tempDir) {
         console.log(`Temporary directory ${tempDir.name} will be cleaned up.`);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
