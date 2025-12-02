FROM node:22-alpine

# Install utilities for health checks
# Update package cache and install with retry logic to handle CDN issues
RUN apk update && \
    apk add --no-cache curl netcat-openbsd || \
    (sleep 5 && apk update && apk add --no-cache curl netcat-openbsd)

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install for compatibility when lock file is missing)
RUN npm install --only=production

# Copy source code
COPY . .

# Create log directories
RUN mkdir -p /var/log/observability/fallback

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Default command (can be overridden in docker-compose)
CMD ["node", "src/api/server.js"]
