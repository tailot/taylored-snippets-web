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
* `src/runner/`: The Node.js execution service that processes code snippets. This directory now contains OS-specific Dockerfiles (`Dockerfile.alpine`, `Dockerfile.debian`, `Dockerfile.ubuntu`) to build runner images for different Linux distributions.
* `docker-compose.yml`: Defines the services for running the application.
* `package.json`: Lists the dependencies and scripts for the frontend.
* `.github/workflows/ci.yml`: Defines the Continuous Integration (CI) workflow for building and testing the project.

## Prerequisites

Before you start, make sure you have the following installed:

* **Node.js**: Version 20 is recommended.
* **npm**: Is installed along with Node.js.
* **Docker and Docker Compose**: Essential for running the application with its backend services.

## Building the Runner Image

The `runner-image` (tagged as `runner-image`) contains the execution environment. It is built by the `runner-builder` service in `docker-compose.yml`. The `docker-compose.yml` points to `src/runner/Dockerfile`; one of the new OS-specific files (e.g., `Dockerfile.alpine`) would need to be renamed to `Dockerfile` to be used by the default configuration.

## How to Launch the Application

Launch the application using Docker Compose, specifying a tenancy profile:
```bash
# For singletenant mode
docker-compose --profile singletenant up --build

# For multitenant mode
docker-compose --profile multitenant up --build
```
Refer to the `docker-compose.yml` for service ports. The frontend is typically available on port 80.

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
