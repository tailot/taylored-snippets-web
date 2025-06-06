# Project Taylored Runner

This project includes a Node.js service (`src/runner.js`) that listens for Socket.IO events to execute the `taylored` command on provided XML data.

## Features

*   Receives XML data via a `tayloredRun` Socket.IO event.
*   Temporarily stores the XML in a local git repository.
*   Executes `taylored --automatic xml` on the data.
*   Streams output and errors back to the connected client.
*   Cleans up temporary files after execution.

## Prerequisites

*   Node.js (v14.x or later recommended)
*   npm (comes with Node.js)

## Setup and Running

1.  **Navigate to the service directory:**
    ```bash
    cd src
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the server:**
    ```bash
    node runner.js
    ```
    The server will start, by default, on port 3000. You can set the `PORT` environment variable to use a different port:
    ```bash
    PORT=4000 node runner.js
    ```

## Socket.IO API

The server listens for and emits the following Socket.IO events:

### Client Emits

*   **`tayloredRun`**:
    *   **Payload**: `String` - A valid XML string that `taylored` can process.
    *   **Description**: Sends an XML string to the server for processing with `taylored --automatic xml`.

### Server Emits

*   **`tayloredOutput`**:
    *   **Payload**: `Object` - `{ output: '...' }`
    *   **Description**: Emitted when the `taylored` command successfully produces standard output. The `output` field contains the `stdout` string.

*   **`tayloredError`**:
    *   **Payload**: `Object` - `{ error: '...' }`
    *   **Description**: Emitted if the `taylored` command writes to `stderr`. This might include warnings or non-critical errors from `taylored`. The `error` field contains the `stderr` string.

*   **`tayloredRunError`**:
    *   **Payload**: `Object` - `{ error: '...' }`
    *   **Description**: Emitted if there's a general error during the processing of the `tayloredRun` event (e.g., invalid input, file system error, git error, `taylored` command execution failure). The `error` field contains a descriptive error message.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
