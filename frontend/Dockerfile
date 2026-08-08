# Frontend Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Fail fast if lockfile is missing motion / mediapipe (avoids stale Render cache masking bad deploys)
RUN npm ci && npm ls motion @mediapipe/tasks-vision

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next.config + client read env at build time; middleware also uses runtime env in prod.
# Without these, NEXT_PUBLIC_* is empty in the standalone bundle (layout injection, etc.).
# Render: set BACKEND_URL / NEXT_PUBLIC_API_URL in the service env (available at build + runtime).
ARG BACKEND_URL
ARG NEXT_PUBLIC_API_URL
ENV BACKEND_URL=${BACKEND_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
