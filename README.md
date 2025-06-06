# Taylored Snippets Web

This is an Angular web application project designed to create, manage, and run text and code "snippets". The application can be run in two distinct modes: **singletenant**, which uses a single shared execution service, and **multitenant**, which provides an isolated Docker execution environment for each user session via an orchestration service.

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

* **Node.js**: Version 20 is recommended.
* **npm**: Is installed along with Node.js.
* **Docker and Docker Compose**: Essential for running the application with its backend services.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <REPOSITORY_URL>
    cd <DIRECTORY_NAME>
    ```

2.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```

## Building the Runner Image

Before launching the application, you need to build the Docker image for the runner service. The orchestration service will use it to create runner instances on demand.

Navigate to the runner directory and run the build command:
```bash
cd src/orchestrator
docker build -t runner-image .
```

## How to Launch the Application

You can launch the application in either **multitenant** or **singletenant** mode using Docker Compose profiles.

### Multitenant Mode

This mode is ideal for production or for tests that require complete session isolation. It uses the `orchestrator` service to dynamically create and manage a `runner` Docker container for each user session.

1.  **Start the services with the `multitenant` profile:**
    ```bash
    docker compose build runner-standalone
    docker-compose --profile multitenant up --build
    ```

2.  This command will start the following services:
    * `frontend`: The Angular application, accessible at `http://localhost:80`.
    * `orchestrator`: The Node.js service that listens on port `3001` and manages the runners.

### Singletenant Mode

This mode is simpler and suitable for local development. It uses a single `runner-standalone` service shared by all users.

1.  **Start the services with the `singletenant` profile:**
    ```bash
    docker-compose --profile singletenant up --build
    ```

2.  This command will start the following services:
    * `frontend`: The Angular application, accessible at `http://localhost:80`.
    * `runner-standalone`: The single runner service listening on port `3000`.

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
