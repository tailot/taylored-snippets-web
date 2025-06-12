# Use Node.js 22 Alpine image as a build stage.
# Node.js 22 is already included, so no need to install it again.
FROM node:22-alpine AS build-stage

# Install basic tools and shells using apk.
# Removed 'csh' and 'ksh' as they are not available in Alpine repositories.
RUN apk add --no-cache \
    bash \
    zsh \
    tcsh \
    curl \
    gnupg \
    ca-certificates \
    git

# Install scripting languages and runtime environments using apk.
# Changed 'lua5.4' to 'lua' and 'R' to 'R' (package name is R).
RUN apk add --no-cache \
    python3 \
    py3-pip \
    perl \
    ruby \
    php \
    openjdk21-jdk \
    lua \
    R \
    gawk \
    tcl \
    expect

# Install global Node.js tools like TypeScript and ts-node.
RUN npm install -g typescript ts-node taylored

# Set the working directory inside the container.
WORKDIR /app

# Copy package.json and package-lock.json files to install dependencies.
COPY package*.json ./

# Install Node.js dependencies.
RUN npm install --production

# Copy the rest of the application code into the working directory.
COPY . .

# Set NODE_ENV environment variable for production optimizations.
ENV NODE_ENV=production

# Expose port 3000, which is the default port the Node.js runner application listens on.
# This aligns the Dockerfile with the orchestrator's configuration.
EXPOSE 3000

# Specify the command that will be executed when the container starts.
# The path to 'runner.js' has been corrected to reflect its location within
# the current working directory (/app/runner.js).
CMD [ "node", "runner.js" ]
