# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV
ENV NEXT_TELEMETRY_DISABLED=1

# Runtime env (injected at build time from GitHub environment secrets).
ARG LOGO_DEV_TOKEN
ARG ENABLE_CACHE_CLEAR
ENV LOGO_DEV_TOKEN=$LOGO_DEV_TOKEN
ENV ENABLE_CACHE_CLEAR=$ENABLE_CACHE_CLEAR

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/resources ./resources
COPY --from=deps /app/node_modules ./node_modules

RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node","node_modules/next/dist/bin/next","start","-H","0.0.0.0","-p","3000"]
