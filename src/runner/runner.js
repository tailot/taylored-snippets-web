
/**
 * @file runner.js
 * @description This module implements a runner server that executes code snippets using the 'taylored' CLI tool.
 * It uses Socket.IO for real-time communication with a client (e.g., a frontend application).
 * The runner can execute code, list directories, and provide file contents within a sandboxed environment.
 * It operates within a container and uses a temporary directory with Git for processing Taylored XML.
 */
const http = require('http');
const { Server } = require("socket.io");
const { spawn } = require('child_process');
const simpleGit = require('simple-git');
const tmp = require('tmp');
const fs = require('fs').promises;
const path = require('path');
/**
 * @const {number} PORT
 * @description The port on which the runner server will listen. Defaults to 3000, or the value of
 * the `PORT` environment variable if set.
 */
const PORT = process.env.PORT || 3000;

/**
 * @const {string} CONTAINER_ROOT
 * @description The root directory within the container that this runner considers as its operational root.
 * Used to restrict file system access for `listDirectory` and `downloadFile` operations.
 */
const CONTAINER_ROOT = '/';

const httpServer = http.createServer();
/**
 * @type {Server}
 * @description The Socket.IO server instance attached to the HTTP server.
 * Configured with CORS to allow connections from any origin.
 */
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/**
 * Handles new Socket.IO connections.
 * @param {Socket} socket - The Socket.IO socket object for the connected client.
 */
io.on('connection', (socket) => {
  /**
   * Handles the 'disconnect' event for a client socket.
   * Currently, no specific action is taken on disconnect, but can be used for cleanup if needed.
   */
  socket.on('disconnect', () => {
    // console.log(`Socket ${socket.id} disconnected`);
  });

  /**
   * Handles the 'tayloredRun' event from the client, which requests execution of a code snippet.
   * The snippet is provided as an XML string.
   * This function sets up a temporary directory, initializes a Git repository,
   * writes the XML to a file, and then executes the 'taylored' CLI tool.
   * Output, errors, and execution status are streamed back to the client via
   * 'tayloredOutput', 'tayloredError', and 'tayloredRunError' events.
   *
   * @param {object} xmlDataRequest - The request object from the client.
   * @param {string} xmlDataRequest.body - The XML string containing the Taylored snippet(s).
   * Emits:
   *  - 'tayloredOutput': For standard output from the Taylored CLI.
   *    Payload: { id: number, output: string }
   *  - 'tayloredError': For standard error output from the Taylored CLI.
   *    Payload: { id: number, error: string }
   *  - 'tayloredRunError': For errors during the setup or execution process itself.
   *    Payload: { id: number|null, error: string }
   */
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

      const tayloredProcess = spawn('taylored', ['--automatic', 'xml', 'main'], { cwd: tempDirPath });

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
      // tempDir.removeCallback(); // Cleanup the temporary directory if needed, though unsafeCleanup might handle it.
    }
  });

  /**
   * Handles the 'listDirectory' event from the client.
   * Lists the contents of a specified directory within the `CONTAINER_ROOT`.
   *
   * @param {object} requestData - The request object from the client.
   * @param {string} [requestData.path='./'] - The path of the directory to list, relative to `CONTAINER_ROOT`.
   * Emits:
   *  - 'directoryListing': On successful listing.
   *    Payload: { path: string (absolute path), files: Array<{name: string, isDirectory: boolean}> }
   *  - 'tayloredRunError': If an error occurs (e.g., path outside allowed root, read error).
   *    Payload: { error: string }
   */
  socket.on('listDirectory', async (requestData) => {
    const requestedPath = requestData && requestData.path ? requestData.path : CONTAINER_ROOT;

    // Resolve the path safely against the defined CONTAINER_ROOT
    const targetPath = path.resolve(CONTAINER_ROOT, requestedPath);

    // Security check: Ensure the resolved path is still within the CONTAINER_ROOT
    if (!targetPath.startsWith(CONTAINER_ROOT)) {
      return socket.emit('tayloredRunError', { error: 'Access denied: Path is outside the allowed directory.' });
    }
    try {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const files = entries.map(entry => ({ name: entry.name, isDirectory: entry.isDirectory() }));

      // Return the resolved, absolute path for clarity, but it's rooted within the container context.
      socket.emit('directoryListing', { path: targetPath, files: files });
    } catch (error) {
      socket.emit('tayloredRunError', { error: `Error listing directory ${requestedPath}: ${error.message}` });
    }
  });

  /**
   * Handles the 'downloadFile' event from the client.
   * Reads the content of a specified file within the `CONTAINER_ROOT` and sends it back.
   *
   * @param {object} requestData - The request object from the client.
   * @param {string} requestData.path - The path of the file to download, relative to `CONTAINER_ROOT`.
   * Emits:
   *  - 'fileContent': On successful file read.
   *    Payload: { path: string (original requested path), content: Buffer }
   *  - 'tayloredRunError': If an error occurs (e.g., path missing, path is not a file, read error, access denied).
   *    Payload: { error: string }
   */
  socket.on('downloadFile', async (requestData) => {
    const requestedPath = requestData && requestData.path ? requestData.path : null;

    if (!requestedPath) {
      return socket.emit('tayloredRunError', { error: 'File path is required.' });
    }

    const filePath = path.resolve(CONTAINER_ROOT, requestedPath);

    // Security check: Ensure the resolved path is still within the CONTAINER_ROOT
    if (!filePath.startsWith(CONTAINER_ROOT)) {
      return socket.emit('tayloredRunError', { error: 'Access denied: Path is outside the allowed directory.' });
    }

    try {
      const stats = await fs.stat(filePath);

      if (!stats.isFile()) {
        return socket.emit('tayloredRunError', { error: 'Path is not a file.' });
      }

      const fileContent = await fs.readFile(filePath);
      // Send the original requested path back for client reference
      socket.emit('fileContent', { path: requestedPath, content: fileContent });
    } catch (error) {
      socket.emit('tayloredRunError', { error: `Error downloading file ${requestedPath}: ${error.message}` });
    }
  });
});

// Start the HTTP server, which in turn starts the Socket.IO server.
httpServer.listen(PORT, () => {
  // console.log(`Runner listening on port ${PORT}`);
});
