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

// --- MODIFICA INIZIO ---
// Definisce la directory principale per le operazioni sui file.
// In questo modo il file manager non dipende più da una directory temporanea.
const CONTAINER_ROOT = '/';
// --- MODIFICA FINE ---

io.on('connection', (socket) => {
  socket.on('disconnect', () => {
  });

  // La logica di 'tayloredRun' rimane invariata, continua a usare una directory temporanea
  // per l'esecuzione isolata degli snippet.
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
      // Questa directory temporanea è usata solo per l'esecuzione di taylored.
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
      // La pulizia di tempDir è gestita da tmp.dirSync con unsafeCleanup: true
    }
  });

  // --- MODIFICA INIZIO ---
  // Logica aggiornata per elencare le directory partendo dalla root del container.
  socket.on('listDirectory', async (requestData) => {
    const requestedPath = requestData && requestData.path ? requestData.path : CONTAINER_ROOT;
    
    // Risolve il percorso richiesto in modo sicuro partendo dalla root.
    const targetPath = path.resolve(CONTAINER_ROOT, requestedPath);

    // Controllo di sicurezza per evitare di uscire dalla directory root.
    if (!targetPath.startsWith(CONTAINER_ROOT)) {
      return socket.emit('tayloredRunError', { error: 'Access denied: Path is outside the allowed directory.' });
    }

    try {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const files = entries.map(entry => ({ name: entry.name, isDirectory: entry.isDirectory() }));
      
      // Ritorna il percorso che è stato effettivamente listato per coerenza.
      socket.emit('directoryListing', { path: targetPath, files: files });
    } catch (error) {
      socket.emit('tayloredRunError', { error: `Error listing directory ${requestedPath}: ${error.message}` });
    }
  });

  // Logica aggiornata per scaricare file partendo dalla root del container.
  socket.on('downloadFile', async (requestData) => {
    const requestedPath = requestData && requestData.path ? requestData.path : null;

    if (!requestedPath) {
      return socket.emit('tayloredRunError', { error: 'File path is required.' });
    }

    const filePath = path.resolve(CONTAINER_ROOT, requestedPath);

    // Controllo di sicurezza.
    if (!filePath.startsWith(CONTAINER_ROOT)) {
      return socket.emit('tayloredRunError', { error: 'Access denied: Path is outside the allowed directory.' });
    }

    try {
      const stats = await fs.stat(filePath);

      if (!stats.isFile()) {
        return socket.emit('tayloredRunError', { error: 'Path is not a file.' });
      }

      const fileContent = await fs.readFile(filePath);
      socket.emit('fileContent', { path: requestedPath, content: fileContent });
    } catch (error) {
      socket.emit('tayloredRunError', { error: `Error downloading file ${requestedPath}: ${error.message}` });
    }
  });
  // --- MODIFICA FINE ---
});

httpServer.listen(PORT, () => {
});
