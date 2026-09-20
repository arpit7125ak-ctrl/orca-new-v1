# orca/backend/Dockerfile
# ---------------------------------------------------------------------------
# Production Multi-Stage Dockerfile for ORCA Backend Gateway
# ---------------------------------------------------------------------------

FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY backend/package*.json ./backend/

# Install dependencies
WORKDIR /app/backend
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy dependencies from builder stage
COPY --from=builder /app/backend/node_modules ./backend/node_modules

# Copy shared contracts and config
COPY contracts ./contracts
COPY shared-config ./shared-config

# Copy backend source code
COPY backend ./backend

WORKDIR /app/backend

# Public API: 4000 | Internal API: 4100
EXPOSE 4000 4100

# Run both public and internal servers via supervisor
CMD ["node", "src/start-both.js"]
