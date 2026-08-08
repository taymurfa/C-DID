# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV npm_config_update_notifier=false
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY fixtures ./fixtures
RUN npm run build
RUN mkdir -p /app/runtime && cp -r dist /app/runtime/dist && cp -r fixtures /app/runtime/fixtures

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    npm_config_update_notifier=false \
    RADAR_SCORE_PORT=8013 \
    HOST=0.0.0.0
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/runtime/dist ./dist
COPY --from=build /app/runtime/fixtures ./fixtures

EXPOSE 8013
CMD ["node", "dist/server.js"]
