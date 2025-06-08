FROM node:22-alpine AS build-stage

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ARG orchestrator

ENV orchestrator=$orchestrator

RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Optional: Remove default Nginx configuration if your nginx.conf is a full replacement
# or if you want to ensure no default configuration interferes.
# If your nginx.conf is named default.conf, it will overwrite it anyway.
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from the build-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]