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
          "message": "Docker image runner-image not found. Ensure it has been built, typically by the 'runner-builder' service."
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

### POST /api/runner/heartbeat

*   **Description:** Receives a heartbeat from an active runner instance to indicate it's still active. This is used to prevent premature cleanup of active runners by the inactivity monitor.
*   **Request Body (JSON):**
    ```json
    {
      "sessionId": "<session_id_of_the_runner>"
    }
    ```
    *Alternatively, the `sessionId` can be passed via the `X-Session-Id` header.*
*   **Success Response (200 OK):**
    ```json
    {
      "message": "Heartbeat received for session <session_id>."
    }
    ```
    *Or, for the singleton runner:*
    ```json
    {
      "message": "Heartbeat received for singleton runner."
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: If `sessionId` is missing.
        ```json
        {
          "error": "SESSION_ID_REQUIRED",
          "message": "Session ID is required for heartbeat."
        }
        ```
    *   `404 Not Found`: If no runner (or singleton) matches the `sessionId`.
        ```json
        {
          "error": "RUNNER_NOT_FOUND",
          "message": "No active runner found for this session ID."
        }
        ```
        ```json
        {
          "error": "RUNNER_NOT_FOUND",
          "message": "Singleton runner not found or session ID mismatch."
        }
        ```

## 3. Prerequisites

*   **Docker Engine:** Must be installed and running. The orchestrator communicates with Docker via its socket (e.g., `/var/run/docker.sock`).
*   **Docker Image \`runner-image\`:** This is the image used to spawn runner instances. It is expected to be pre-built, typically by the `runner-builder` service defined in the main `docker-compose.yml` when the application is launched. Manual building is generally not required when using Docker Compose.
    ```bash
    # If manual building is ever needed (e.g., for isolated testing of the runner):
    # From the 'src/runner' directory
    docker build -t runner-image .
    ```

## 4. Running the Service

The Orchestrator service is typically run as part of the Taylored Snippets Web application using Docker Compose.

To run it standalone (e.g., for development or testing):
1.  Navigate to the `src/orchestrator` directory.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Ensure the `runner-image` Docker image is available locally (see Prerequisites).
4.  Run the service:
    ```bash
    node orchestrator.js
    ```
    The service will listen on port `3001` by default (can be overridden by the `PORT` environment variable).

## 5. Testing Strategy (Conceptual Guidelines)

The testing strategies outlined below are conceptual guidelines. Actual implementation details may vary.

### Unit Tests (e.g., using Jest, Mocha)

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

### Integration Tests

*   Requires a live Docker daemon.
*   **Provisioning Flow:**
    1.  Send a POST request to `/api/runner/provision`.
    2.  Verify a 201/200 status code and correct JSON response.
    *   Use `docker ps` or `dockerode` to confirm a new container based on `runner-image` (or the image specified by `DOCKER_IMAGE_NAME`) is running.
    4.  Verify the container has the correct labels (e.g., `taylored-runner-session-id`).
    5.  Attempt to connect to the allocated host port (e.g., with `netcat` or a simple client) to see if the runner service inside the container is responsive.
*   **Deprovisioning Flow:**
    1.  Provision a runner.
    2.  Send a POST request to `/api/runner/deprovision` with the correct `sessionId`.
    3.  Verify a 200 status code.
    4.  Use `docker ps` to confirm the container is stopped and removed.
*   **Error Cases:**
    *   Test provisioning when the target Docker image does not exist.
    *   Test deprovisioning with an invalid/unknown `sessionId`.
    *   (Advanced) Simulate Docker daemon errors if possible.

### End-to-End (E2E) Tests

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

## 6. Logging

*   The service uses `console.log`, `console.warn`, and `console.error` for logging.
*   Logs are timestamped and include a descriptive message.
*   Key events logged include:
    *   Service startup.
    *   API requests (provision, deprovision) with session IDs.
    *   Docker actions (image inspection, container creation, start, stop, removal).
    *   Errors encountered during any operation, including potential stack traces (in non-production environments).
*   A generic error handler logs unhandled exceptions with request context.

## 7. Environment Variables

The behavior of the Orchestrator service can be configured using the following environment variables:

*   **`NODE_ENV`**: (Standard Node.js variable)
    *   Description: Specifies the environment mode (e.g., `development`, `production`).
    *   Effect: In non-`production` modes, error responses may include more detailed stack traces.
*   **`REUSE_RUNNER_MODE`**:
    *   Description: Controls the runner provisioning strategy. If `true`, a single runner instance is reused. If `false`, a new Docker container is provisioned per session.
    *   Default: `false` (implicitly, if not set).
    *   Example: `REUSE_RUNNER_MODE=true`
*   **`RUNNERS_HOST`**:
    *   Description: The hostname or IP address that clients will use to connect to the provisioned runners.
    *   Default: `localhost`.
    *   Example: `RUNNERS_HOST=runners.example.com`
*   **`PORT`**:
    *   Description: The port on which the Orchestrator service itself will listen.
    *   Default: `3001`.
*   **`INACTIVITY_TIMEOUT_SECONDS`**:
    *   Description: The time in seconds after which an inactive runner (no heartbeats) will be automatically deprovisioned.
    *   Default: `60`.
*   **`CLEANUP_INTERVAL_SECONDS`**: (Not directly an environment variable, but a related constant)
    *   Description: The interval in seconds at which the orchestrator checks for and cleans up inactive runners.
    *   Fixed at: `30` seconds in the current code.

**Note on Docker Configuration:**
*   The Docker image name for runners is hardcoded as `runner-image`.
*   The Docker label key for tagging runner containers is hardcoded as `taylored-runner-session-id`.
*   The Docker socket path defaults to `/var/run/docker.sock` as per `dockerode` library defaults.
*   There is currently no implemented limit on the maximum number of concurrent runners (`MAX_CONCURRENT_RUNNERS`).
