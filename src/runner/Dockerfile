# Usa l'immagine Node.js 22 basata su Alpine come stage di build.
# Node.js 22 è già incluso, quindi non è necessario installarlo nuovamente.
FROM node:22-alpine AS build-stage

# Installa i tool di base e le shell usando apk.
# Ho rimosso 'csh' e 'ksh' perché non sono disponibili nei repository Alpine.
RUN apk add --no-cache \
    bash \
    zsh \
    tcsh \
    curl \
    gnupg \
    ca-certificates \
    git

# Installa i linguaggi di scripting e gli ambienti di runtime usando apk.
# Ho cambiato 'lua5.4' a 'lua' e 'R' a 'R' (il nome del pacchetto è R).
RUN apk add --no-cache \
    python3 \
    py3-pip \
    perl \
    ruby \
    php \
    openjdk17-jre-headless \
    lua \
    R \
    gawk \
    tcl \
    expect

# Installa gli strumenti Node.js globali come TypeScript e ts-node.
RUN npm install -g typescript ts-node

# Imposta la directory di lavoro all'interno del container.
WORKDIR /app

# Copia i file package.json e package-lock.json per installare le dipendenze.
COPY package*.json ./

# Installa le dipendenze di Node.js.
RUN npm install --production

# Copia il resto del codice dell'applicazione nella directory di lavoro.
COPY . .

# Imposta la variabile d'ambiente NODE_ENV per ottimizzazioni di produzione.
ENV NODE_ENV=production

# Espone la porta 3000, che è la porta predefinita su cui l'applicazione runner Node.js ascolta.
# Questo allinea il Dockerfile con la configurazione dell'orchestratore.
EXPOSE 3000

# Specifica il comando che verrà eseguito all'avvio del container.
# Il percorso di 'runner.js' è stato corretto per riflettere la sua posizione all'interno
# della directory di lavoro corrente (/app/src/runner/runner.js).
CMD [ "node", "runner.js" ]
