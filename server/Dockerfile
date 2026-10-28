# Multi-stage production build for TaskPulse Backend
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci --workspace=server

COPY server ./server
RUN npm run build:server

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci --workspace=server --only=production

COPY --from=builder /app/server/dist ./server/dist

EXPOSE 5001

CMD ["node", "server/dist/server.js"]

