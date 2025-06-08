# Orchestrator Service for Taylored Snippets Web

## 1. Overview

The Orchestrator Service is a Node.js application responsible for managing the lifecycle of dedicated Dockerized runner instances for the Taylored Snippets Web application. It provides an isolated environment for each user session to execute code snippets securely.

## 2. API Endpoints

The service exposes the following RESTful API endpoints:

### POST /api/runner/provision

*   **Description:** Provisions a new dedicated Docker runner instance for a user session. If a runner already exists for the given session ID, it returns the existing runner's details.
*   **Request Headers (Optional):**
    *   `X-Session-Id: <string>`: An optional session ID provided by the client. If not provided, the orchestrator generates a new UUID v4.
*   **Success Response (201 Created or 200 OK):**
    ```json
    {
      "message": "Runner provisioned successfully." / "Runner already exists for this session.",
      "endpoint": "http://localhost:<allocated_port>",
      "sessionId": "<session_id>"
    }
    ```
*   **Error Responses:**
    *   `500 Internal Server Error`:
        ```json
        {
          "error": "DOCKER_IMAGE_NOT_FOUND",
          "message": "Docker image my-taylored-runner-image not found. Build it before running the orchestrator."
        }
        ```
        ```json
        {
          "error": "SERVER_ERROR",
          "message": "An unexpected error occurred on the server.",
          "details": "<error_message_if_not_production>"
        }
        ```

### POST /api/runner/deprovision

*   **Description:** Deprovisions (stops and removes) an active Docker runner instance associated with a session ID.
*   **Request Body (JSON):**
    ```json
    {
      "sessionId": "<session_id_to_deprovision>"
    }
    ```
    *Alternatively, the `sessionId` can be passed via the `X-Session-Id` header.*
*   **Success Response (200 OK):**
    ```json
    {
      "message": "Runner for session <session_id> deprovisioned successfully."
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`:
        ```json
        {
          "error": "SESSION_ID_REQUIRED",
          "message": "Session ID is required for deprovisioning."
        }
        ```
    *   `404 Not Found`:
        ```json
        {
          "error": "RUNNER_NOT_FOUND",
          "message": "No active runner found for this session ID."
        }
        ```
    *   `500 Internal Server Error`: (Similar to provision endpoint for unexpected errors)

## 3. Prerequisites

*   **Docker Engine:** Must be installed and running. The orchestrator communicates with Docker via its socket (e.g., `/var/run/docker.sock`).
*   **Docker Image \`my-taylored-runner-image\`:** This image must be built from the Dockerfile located in `../runner/Dockerfile`.
    ```bash
    # From the 'src/runner' directory
    docker build -t my-taylored-runner-image .
    ```

## 4. Configuration

The following environment variables can be used to configure the Orchestrator Service:

*   **`INACTIVE_RUNNER_TIMEOUT_MS`**:
    *   **Purpose:** Specifies the maximum time (in milliseconds) a runner container can be inactive before it is automatically deprovisioned by the cleanup job.
    *   **Default value:** Defaults to 30 minutes (1800000 ms) if not set or if an invalid value is provided.
    *   **Example:** `INACTIVE_RUNNER_TIMEOUT_MS=600000` (for 10 minutes).
*   **`REUSE_RUNNER_MODE`**:
    *   **Purpose:** If set to `'true'`, the orchestrator will attempt to reuse a single runner instance for all sessions. This is primarily for development or resource-constrained environments.
    *   **Default value:** Defaults to `false`.
    *   **Example:** `REUSE_RUNNER_MODE=true`.

## 5. Running the Service

1.  Navigate to the `src/orchestrator` directory.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set any desired environment variables (see Configuration section).
4.  Run the service:
    ```bash
    node orchestrator.js
    ```
    The service will listen on port 3001 by default.

## 6. Testing

### Running Tests

To run the unit tests, navigate to the `src/orchestrator` directory and use the following command:
```bash
npm test
```

### Testing Strategy (Conceptual)

#### Unit Tests (e.g., using Jest, Mocha)

*   **`getAvailablePort()` utility:** Test its ability to find and release a port.
*   **Endpoint Logic Mocking:**
    *   Mock the `dockerode` library to simulate Docker interactions.
    *   For `/api/runner/provision`:
        *   Verify `docker.createContainer()` and `container.start()` are called with correct parameters.
        *   Test session ID generation/reuse logic.
        *   Test response structure on success and error.
    *   For `/api/runner/deprovision`:
        *   Verify `container.stop()` and `container.remove()` are called.
        *   Test behavior when session ID is missing or runner not found.
*   **Error Handling:** Test how different errors (e.g., Docker errors, internal logic errors) are caught and propagated to the client as standardized JSON error responses.
*   **`cleanupInactiveRunners` function:**
    *   Test removal of inactive runners.
    *   Test that active runners are not removed.
    *   Test handling of Docker errors during cleanup.

#### Integration Tests

*   Requires a live Docker daemon.
*   **Provisioning Flow:**
    1.  Send a POST request to `/api/runner/provision`.
    2.  Verify a 201/200 status code and correct JSON response.
    3.  Use `docker ps` or `dockerode` to confirm a new container based on `my-taylored-runner-image` is running.
    4.  Verify the container has the correct labels (e.g., `taylored-runner-session-id`).
    5.  Attempt to connect to the allocated host port (e.g., with `netcat` or a simple client) to see if the runner service inside the container is responsive.
*   **Deprovisioning Flow:**
    1.  Provision a runner.
    2.  Send a POST request to `/api/runner/deprovision` with the correct `sessionId`.
    3.  Verify a 200 status code.
    4.  Use `docker ps` to confirm the container is stopped and removed.
*   **Inactive Runner Cleanup:**
    1.  Provision a runner.
    2.  Wait for longer than `INACTIVE_RUNNER_TIMEOUT_MS`.
    3.  Verify the runner is automatically deprovisioned.
*   **Error Cases:**
    *   Test provisioning when `my-taylored-runner-image` does not exist.
    *   Test deprovisioning with an invalid/unknown `sessionId`.
    *   (Advanced) Simulate Docker daemon errors if possible.

#### End-to-End (E2E) Tests

*   This involves the entire application stack: Angular Frontend -> Orchestrator Service -> Docker Runner.
*   **Scenario 1: Successful Code Execution**
    1.  Launch the Angular application.
    2.  (Automated) Trigger an action that requires a runner (e.g., loading a page that auto-provisions).
    3.  Verify the `RunnerService` in Angular successfully connects to an endpoint provided by the orchestrator.
    4.  (Automated) Send a code snippet for execution.
    5.  Verify the expected output is received via Socket.IO.
*   **Scenario 2: Session Cleanup**
    1.  Perform Scenario 1.
    2.  (Automated) Simulate user leaving/session ending (e.g., call `runnerService.deprovisionRunner()` or close the tab if test framework supports it).
    3.  Verify the orchestrator deprovisions the runner (check Docker).
*   **Scenario 3: Orchestrator Errors**
    *   Simulate orchestrator being down or returning errors during provisioning. Verify frontend handles this gracefully.

## 7. Logging

*   The service uses `console.log`, `console.warn`, and `console.error` for logging.
*   Logs are timestamped and include a descriptive message.
*   Key events logged include:
    *   Service startup.
    *   API requests (provision, deprovision) with session IDs.
    *   Docker actions (image inspection, container creation, start, stop, removal).
    *   Cleanup job for inactive runners.
    *   Errors encountered during any operation, including potential stack traces (in non-production environments).
*   A generic error handler logs unhandled exceptions with request context.

EOL
