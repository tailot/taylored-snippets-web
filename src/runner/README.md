# Project Taylored Runner

This project includes a Node.js service (`src/runner/runner.js`) that listens for Socket.IO events to execute the `taylored` command on provided XML data.

## Features

*   Receives XML data via a `tayloredRun` Socket.IO event.
*   Temporarily stores the XML in a local git repository.
*   Executes `taylored --automatic xml` on the data.
*   Streams output and errors back to the connected client.
*   Cleans up temporary files after execution.

## Prerequisites

*   **Node.js**: Version 20 is recommended (aligns with the main project).
*   **npm**: Is installed along with Node.js.
*   **Taylored CLI**: The `taylored` command-line tool (typically `npx taylored`) must be available in the execution environment, as this service invokes it. The `runner-image` Docker image handles this dependency.

## Setup and Running

**Note:** This Runner service is designed to be packaged within a Docker image (named `runner-image`) and managed by the Orchestrator service (see `../orchestrator/README.md`). It is typically not run standalone in a production setup. The `runner-image` is built by the `runner-builder` service defined in the main `docker-compose.yml`.

To run the service standalone (e.g., for isolated development or testing):

1.  **Navigate to the service directory:**
    ```bash
    cd src/runner
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```
    (This will also install `taylored` as a local npm dependency if not globally available and if listed in `package.json`.)

3.  **Run the server:**
    ```bash
    node runner.js
    ```
    The server will start on port `3000` by default. This can be configured using the `PORT` environment variable (see below).

## Environment Variables

*   **`PORT`**:
    *   Description: Specifies the port on which the Runner service will listen.
    *   Default: `3000`.
    *   Example: `PORT=3001 node runner.js`

## Socket.IO API

The server listens for and emits the following Socket.IO events:

### Client Emits

*   **`tayloredRun`**:
    *   **Payload**: `Object` - `{ body: "<xml_string>" }`
    *   **Description**: Sends an XML string (wrapped in a `body` property) to the server for processing with `taylored --automatic xml main`. The runner will attempt to extract a snippet ID (number) from the XML.
*   **`listDirectory`**:
    *   **Payload**: `Object` - `{ path: "<directory_path>" }` (Optional, defaults to container root '/')
    *   **Description**: Requests a listing of the specified directory. Path is relative to the container's root.
*   **`downloadFile`**:
    *   **Payload**: `Object` - `{ path: "<file_path>" }` (Required)
    *   **Description**: Requests the content of the specified file. Path is relative to the container's root.


### Server Emits

*   **`tayloredOutput`**:
    *   **Payload**: `Object` - `{ id: number, output: string }`
    *   **Description**: Emitted when the `taylored` command successfully produces standard output. The `id` field is the snippet ID extracted from the input XML. The `output` field contains the `stdout` string.

*   **`tayloredError`**:
    *   **Payload**: `Object` - `{ id: number, error: string }`
    *   **Description**: Emitted if the `taylored` command writes to `stderr`. This might include warnings or non-critical errors from `taylored`. The `id` field is the snippet ID. The `error` field contains the `stderr` string.

*   **`tayloredRunError`**:
    *   **Payload**: `Object` - `{ id: number | null, error: string }`
    *   **Description**: Emitted if there's a general error during the processing of any event (e.g., invalid input, file system error, git error, `taylored` command execution failure, issues with `listDirectory` or `downloadFile`). The `error` field contains a descriptive error message. The `id` field will contain the extracted snippet ID if available (primarily for `tayloredRun` errors).
*   **`directoryListing`**:
    *   **Payload**: `Object` - `{ path: string, files: Array<{name: string, isDirectory: boolean}> }`
    *   **Description**: Emitted in response to a `listDirectory` request. `path` is the absolute path listed within the container. `files` is an array of file/directory entries.
*   **`fileContent`**:
    *   **Payload**: `Object` - `{ path: string, content: Buffer }`
    *   **Description**: Emitted in response to a `downloadFile` request. `path` is the original requested path. `content` is the raw file content as a Buffer.

## License

This project's runner component is licensed under the MIT License. The main project LICENSE file can be found in the root directory.
