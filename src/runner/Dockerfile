FROM node:22-alpine AS build-stage

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ksh \
    zsh \
    csh \
    tcsh \
    python3 \
    python3-pip \
    python-is-python3 \
    perl \
    ruby-full \
    php-cli \
    default-jdk-headless \
    groovy \
    lua5.4 \
    r-base \
    gawk \
    tcl \
    expect \
    curl \
    gnupg \
    firejail \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# The above command includes the installation of not only interpreters. 

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g typescript ts-node \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# RUN echo "Versioni degli interpreti installati:" && \
#     bash --version | head -n 1 && \
#     ksh --version 2>&1 | head -n 1 || echo "ksh version check failed" && \
#     zsh --version | head -n 1 && \
#     csh --version 2>&1 | head -n 1 || echo "csh version check failed" && \
#     tcsh --version | head -n 1 && \
#     python3 --version && \
#     perl --version | head -n 2 | tail -n 1 && \
#     ruby --version && \
#     node --version && \
#     tsc --version && \
#     ts-node --version && \
#     php --version | head -n 1 && \
#     java -version 2>&1 | head -n 1 && \
#     groovy --version | head -n 1 && \
#     lua5.4 -v && \
#     R --version | head -n 1 && \
#     gawk --version | head -n 1 && \
#     tclsh <<< "puts [info patchlevel]" && \
#     expect -v | head -n 1 || echo "expect version check failed"

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

ENV NODE_ENV=production

EXPOSE 3001

CMD [ "node", "runner.js" ]