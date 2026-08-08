# syntax=docker/dockerfile:1

# Agent 2 has no browser dependency (no Playwright), so a slim Node base is
# enough. Multi-stage: compile TypeScript, then ship prod deps + dist only.

# --- Build stage --------------------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV npm_config_update_notifier=false
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage ------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    npm_config_update_notifier=false \
    INTELLIGENCE_PORT=8002 \
    HOST=0.0.0.0
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 8002

# Config comes from the environment (see docker-compose env_file: ./backend/.env).
CMD ["node", "dist/server.js"]
