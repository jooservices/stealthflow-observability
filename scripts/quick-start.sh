#!/bin/bash

# Quick Start Script for Development
# This script helps set up and test the observability microservice locally

set -e

echo "========================================"
echo " StealthFlow Observability - Quick Start"
echo "========================================"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env created"
else
    echo "✅ .env already exists"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Test connections (optional)
echo ""
echo "🔍 Testing connections to Container #1..."
echo "(This will fail if Container #1 is not running at 192.168.1.13)"
node scripts/test-connections.js || echo "⚠️  Connection test failed - make sure Container #1 is running"

# Create log directories
echo ""
echo "📁 Creating log directories..."
mkdir -p logs/fallback
echo "✅ Log directories created"

echo ""
echo "========================================"
echo " Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. Start API server:"
echo "     npm run dev"
echo ""
echo "  2. In another terminal, start LogWorker:"
echo "     npm run worker"
echo ""
echo "  3. Test the API:"
echo "     curl http://localhost:3000/health"
echo ""
echo "  4. Submit a test log:"
echo "     curl -X POST http://localhost:3000/api/v1/logs \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"category\":\"SYSTEM\",\"operation\":\"test\",\"metadata\":{},\"options\":{\"serviceName\":\"Test\"}}'"
echo ""
echo "  5. View in Kibana:"
echo "     http://192.168.1.13:5602"
echo ""
