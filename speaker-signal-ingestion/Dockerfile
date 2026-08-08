# syntax=docker/dockerfile:1

# Pinned to the Playwright version resolved in package-lock.json so the
# preinstalled Chromium + OS dependencies match the npm package exactly. The
# crawler only uses Playwright as a fallback for JS-rendered pages, but shipping
# it means the container can "grab everything", including SPA sites.
ARG PLAYWRIGHT_VERSION=1.62.1

# --- Build stage: install all deps and compile TypeScript -> dist ------------
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS build
WORKDIR /app
ENV npm_config_update_notifier=false
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage: production deps + compiled output only --------------------
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    npm_config_update_notifier=false \
    INGESTION_PORT=8001 \
    HOST=0.0.0.0
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 8001

# Config comes from the environment (see docker-compose env_file: ../backend/.env).
# The app also tries to load a shared backend/.env by walking up from its module
# path; a missing file is harmless because real values arrive via env vars.
CMD ["node", "dist/server.js"]
