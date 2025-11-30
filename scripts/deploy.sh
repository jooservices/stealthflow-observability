#!/bin/bash

# Deployment script for Observability Microservice
# This deploys to local machine but connects to services at 192.168.1.13

set -e

echo "========================================"
echo " Deploying Observability Microservice"
echo "========================================"
echo ""
echo "Target: Local Docker"
echo "Services: 192.168.1.13 (Redis, ES, MongoDB)"
echo ""

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "✅ Docker is running"

# Create .env if not exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
fi

# Create log directories
echo "📁 Creating log directories..."
mkdir -p logs/fallback

# Test connectivity to 192.168.1.13
echo ""
echo "🔍 Testing connectivity to 192.168.1.13..."
nc -zv -w 2 192.168.1.13 6380 || echo "⚠️  Warning: Cannot reach Redis at 192.168.1.13:6380"
nc -zv -w 2 192.168.1.13 9201 || echo "⚠️  Warning: Cannot reach ES at 192.168.1.13:9201"

# Build Docker image
echo ""
echo "🔨 Building Docker image..."
docker-compose -f docker-compose.observability.yml build

# Start containers
echo ""
echo "🚀 Starting containers..."
docker-compose -f docker-compose.observability.yml up -d

# Wait for health check
echo ""
echo "⏳ Waiting for services to be healthy (30 seconds)..."
sleep 30

# Check status
echo ""
echo "📊 Container status:"
docker-compose -f docker-compose.observability.yml ps

# Test health endpoint
echo ""
echo "🏥 Testing health endpoint..."
curl -s http://localhost:3100/health | jq '.' || echo "⚠️  Health check not responding yet"

echo ""
echo "========================================"
echo " Deployment Complete!"
echo "========================================"
echo ""
echo "Services running:"
echo "  - API Server: http://localhost:3100"
echo "  - Health Check: http://localhost:3100/health"
echo ""
echo "Useful commands:"
echo "  View logs:    docker logs -f observability-api"
echo "  View worker:  docker logs -f log-worker"
echo "  Stop:         docker-compose -f docker-compose.observability.yml down"
echo "  Restart:      docker-compose -f docker-compose.observability.yml restart"
echo ""
echo "Test log submission:"
echo "  curl -X POST http://localhost:3100/api/v1/logs \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"category\":\"SYSTEM\",\"operation\":\"deployment_test\",\"metadata\":{},\"options\":{\"serviceName\":\"Test\"}}'"
echo ""
