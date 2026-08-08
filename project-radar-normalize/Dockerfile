# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV npm_config_update_notifier=false
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    npm_config_update_notifier=false \
    RADAR_NORMALIZE_PORT=8012 \
    HOST=0.0.0.0
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 8012
CMD ["node", "dist/server.js"]
