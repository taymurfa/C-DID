# syntax=docker/dockerfile:1

# Agent 3 (GTM): Fastify sequences + funnel. No browser dependency.
# Multi-stage: compile TypeScript, then ship prod deps + dist only.

# --- Build stage --------------------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV npm_config_update_notifier=false
COPY package.json package-lock.json ./
# openai's optional zod peer can conflict under npm 10 strict resolution in Docker.
RUN npm ci --legacy-peer-deps
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage ------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    npm_config_update_notifier=false \
    GTM_PORT=8003 \
    HOST=0.0.0.0
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps
COPY --from=build /app/dist ./dist

EXPOSE 8003

CMD ["node", "dist/server.js"]
