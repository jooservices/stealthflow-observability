#!/usr/bin/env bash

################################################################################
# StealthFlow Observability - Cleanup Script
################################################################################
#
# This script helps you clean up the StealthFlow Observability environment.
# It can:
# 1. Stop containers
# 2. Remove data volumes (optional)
# 3. Remove Docker images (optional)
# 4. Remove .env configuration (optional)
#
# Usage: ./scripts/cleanup.sh
#
################################################################################

set -euo pipefail

# Configuration
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

cd "${PROJECT_ROOT}"

log_header "StealthFlow Observability - Cleanup"

echo "This script will help you clean up the environment."
echo ""

# Step 1: Stop Containers
log_info "Stopping containers..."
docker-compose -f "${COMPOSE_FILE}" down 2>/dev/null || true
log_success "Containers stopped."

# Step 2: Remove Volumes
echo ""
echo -e "${YELLOW}Do you want to remove persistent data volumes? (Redis, ES, Mongo data)${NC}"
read -p "Type 'yes' to remove volumes [no]: " remove_volumes
if [[ "${remove_volumes}" == "yes" ]]; then
    log_info "Removing volumes..."
    docker-compose -f "${COMPOSE_FILE}" down -v 2>/dev/null || true
    log_success "Volumes removed."
else
    log_info "Skipping volume removal."
fi

# Step 3: Remove Images
echo ""
echo -e "${YELLOW}Do you want to remove Docker images built for this project?${NC}"
read -p "Type 'yes' to remove images [no]: " remove_images
if [[ "${remove_images}" == "yes" ]]; then
    log_info "Removing images..."
    docker-compose -f "${COMPOSE_FILE}" down --rmi all 2>/dev/null || true
    log_success "Images removed."
else
    log_info "Skipping image removal."
fi

# Step 4: Remove .env
echo ""
echo -e "${YELLOW}Do you want to remove the .env configuration file?${NC}"
echo -e "${YELLOW}(You will lose your generated API keys!)${NC}"
read -p "Type 'yes' to remove .env [no]: " remove_env
if [[ "${remove_env}" == "yes" ]]; then
    log_info "Removing .env..."
    rm -f "${ENV_FILE}"
    log_success ".env file removed."
else
    log_info "Skipping .env removal."
fi

echo ""
log_header "Cleanup Complete"
echo "Environment has been cleaned up according to your choices."
echo ""
