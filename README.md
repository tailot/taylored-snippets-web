# Taylored Snippets Web

This is an Angular web application project designed to create, manage, and run text and code "snippets", offering isolated execution environments for each snippet. The application can be run in two distinct modes: **singletenant**, which uses a single shared execution service, and **multitenant**, which provides an isolated Docker execution environment for each user session via an orchestration service.

## Key Features

### Snippet Management
- **Snippet Creation**: Users can add two types of snippets to a worksheet:
    - Text Snippets: For annotations and static content.
    - Compute Snippets: For writing and executing code.
- **Snippet Editor**: Each snippet features a text area for inputting and editing content.
- **Dynamic Reordering**: Snippets can be reordered via drag-and-drop within the sheet.

### Code Execution
- **Isolated Environments**: The application can be run in two distinct modes:
    - Multitenant Mode: Provides a fully isolated Docker execution environment for each user session, managed by an orchestrator service. This is ideal for production and tests requiring complete isolation.
    - Singletenant Mode: Uses a single, shared runner instance, suitable for local development.
- **Script Execution**: Compute snippets can execute code. Standard output and errors are displayed directly in the user interface.
- **Arbitrary Port Mapping**: In singletenant mode, it's possible to map a specified number of arbitrary ports from the host to the runner container by setting the `FREE_DOORS` environment variable (e.g., `FREE_DOORS=N`) for the orchestrator service. This allows services within the runner to be exposed externally. The mapping works as follows:
    - The primary service port of the runner (port `3000` inside the container) is mapped to a dynamically allocated random port on the host. This is the main endpoint for the runner.
    - If `N >= 1`, then `N-1` additional ports are mapped 1-to-1 from the host to the container, in descending order starting from port `2999`. For example, if `FREE_DOORS=2`, port `2999` on the host maps to `2999` in the container, and port `2998` on the host maps to `2998` in the container.
- **Supported Interpreters**: The following interpreters are supported via shebangs in the runner environment:
    * `#!/usr/bin/env bash`
    * `#!/usr/bin/env zsh`
    * `#!/usr/bin/env tcsh`
    * `#!/usr/bin/env python3`
    * `#!/usr/bin/env node`
    * `#!/usr/bin/env perl`
    * `#!/usr/bin/env ruby`
    * `#!/usr/bin/env php`
    * `#!/usr/bin/java --source 21`
    * `#!/usr/bin/env lua5.4`
    * `#!/usr/bin/env Rscript`
    * `#!/usr/bin/gawk -f`
    * `#!/usr/bin/env tclsh`
    * `#!/usr/bin/env expect`
    * `#!/usr/bin/env ts-node`
- **Containers also work offline**

## Project Structure

The repository is organized as follows:

* `src/app/`: Contains the frontend Angular application source code.
* `src/orchestrator/`: The Node.js orchestration service used in multitenant mode to manage Docker runners.
* `src/runner/`: The Node.js execution service that processes code snippets.
* `docker-compose.yml`: Defines the services and profiles for running the application in different modes.
* `package.json`: Lists the dependencies and scripts for the frontend.
* `.github/workflows/ci.yml`: Defines the Continuous Integration (CI) workflow for building and testing the project.

## Prerequisites

Before you start, make sure you have the following installed:

* **Node.js**: Version 22 is recommended.
* **npm**: Is installed along with Node.js.
* **Docker and Docker Compose**: Essential for running the application with its backend services.

## Building the Runner Image

The `runner-image`, named `runner-image` as defined in `docker-compose.yml`, is crucial for the application's operation. It contains the necessary environment for code execution and is used by the orchestrator service in multitenant mode to create isolated runner instances for each user session. This image is automatically built by the `runner-builder` service within Docker Compose when you launch the application using either the `multitenant` or `singletenant` profile.

## How to Launch the Application

You can launch the application in either **multitenant** or **singletenant** mode using Docker Compose profiles.

### Multitenant Mode

This mode is ideal for production or for tests that require complete session isolation. It uses the `orchestrator` service to dynamically create and manage a `runner` Docker container for each user session.

1.  **Start the services with the `multitenant` profile:**
    ```bash
    docker-compose --profile multitenant up --build
    ```

2.  This command will start the following services:
    * `frontend-multitenant`: The Angular application, accessible at `http://localhost:80`.
    * `orchestrator-multitenant`: The Node.js orchestrator service (see `src/orchestrator/README.md`). Listens on port `3001` and manages a separate Docker runner instance for each user session (`REUSE_RUNNER_MODE=false` is set for this service in `docker-compose.yml`). It can be configured with the `FREE_DOORS` environment variable to enable arbitrary port (maximum 20) mapping to the runner containers.
    * `runner-builder`: This service builds the `runner-image` (see `src/runner/README.md`) and then exits. The `runner-image` includes the necessary configurations for port mapping when `FREE_DOORS` is utilized.

### Singletenant Mode

This mode is simpler and suitable for local development. It uses a single runner instance, managed by the orchestrator service configured appropriately.

1.  **Start the services with the `singletenant` profile:**
    ```bash
    docker-compose --profile singletenant up --build
    ```

2.  This command will start the following services:
    * `frontend-singletenant`: The Angular application, accessible at `http://localhost:80`.
    * `orchestrator-singletenant`: The Node.js orchestrator service. For this profile, it listens on port `3001` and is configured via `docker-compose.yml` to use `REUSE_RUNNER_MODE=true`, meaning it manages a single, shared runner instance for all users.
    * `runner-builder`: This service builds the `runner-image` and then exits.

Once the services are running, you can access the application by opening your browser and navigating to `http://localhost:80`.

## Development Scripts

The project uses the following `npm` scripts for development tasks:

* **`npm start`**: Starts the Angular development server.
* **`npm run build`**: Compiles the Angular application for production.
* **`npm test`**: Runs the unit tests.

## Testing

To run the frontend unit tests, use the following command:

```bash
npm test -- --watch=false --browsers=ChromeHeadless
```

This command runs the tests using Karma and Jasmine in a headless Chrome environment, similar to how they would be executed in a CI pipeline.
