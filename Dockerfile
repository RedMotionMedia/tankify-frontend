# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_ENABLE_DEBUG_MODE
ENV NEXT_PUBLIC_ENABLE_DEBUG_MODE=$NEXT_PUBLIC_ENABLE_DEBUG_MODE
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Runtime env (injected at build time from GitHub environment secrets).
ARG LOGO_DEV_TOKEN
ARG ENABLE_DEBUG_MODE
ARG NEXT_PUBLIC_ENABLE_DEBUG_MODE
ENV LOGO_DEV_TOKEN=$LOGO_DEV_TOKEN
ENV ENABLE_DEBUG_MODE=$ENABLE_DEBUG_MODE
ENV NEXT_PUBLIC_ENABLE_DEBUG_MODE=$NEXT_PUBLIC_ENABLE_DEBUG_MODE

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=deps /app/node_modules ./node_modules

RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node","node_modules/next/dist/bin/next","start","-H","0.0.0.0","-p","3000"]
