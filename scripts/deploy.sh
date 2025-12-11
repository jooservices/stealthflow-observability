#!/usr/bin/env bash

################################################################################
# StealthFlow Observability - Automated Deployment Script
################################################################################
#
# This script provides 100% automated deployment with:
# - Complete self-contained Docker stack (Redis + ES + MongoDB + API + Worker)
# - Auto-generation of API keys and secrets
# - Docker container deployment
# - Health verification
# - Security features enabled (API auth, rate limiting, metrics)
#
# Usage: ./scripts/deploy.sh
#
################################################################################

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"
ENV_EXAMPLE=".env.example"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${API_PORT:-3100}"
KIBANA_PORT="${KIBANA_PORT:-5601}"
DOCKER_COMPOSE_CMD=""  # Will be set by detect_docker_compose()

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

################################################################################
# Pre-flight Checks
################################################################################

check_docker() {
    log_info "Checking Docker availability..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker daemon is not running. Please start Docker Desktop or the daemon."
        exit 1
    fi
    
    log_success "Docker is available"
}

detect_docker_compose() {
    log_info "Detecting Docker Compose version..."
    
    # Check for Docker Compose V2 (docker compose)
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
        log_success "Docker Compose V2 detected (docker compose)"
        return 0
    fi
    
    # Check for Docker Compose V1 (docker-compose) - explicitly block
    if command -v docker-compose &> /dev/null; then
        log_error "Legacy docker-compose (v1) detected. It breaks with newer Docker Engine versions (missing ContainerConfig in image inspect)."
        log_error "Please install Docker Compose V2 and use 'docker compose' instead."
        exit 1
    fi
    
    # Neither found
    log_error "Docker Compose is not available. Please install either:"
    log_error "  - Docker Compose V2 (included with Docker Desktop or docker-ce-plugin-compose)"
    exit 1
}

check_port_available() {
    local port=$1
    local service_name=$2
    
    log_info "Checking if port ${port} is available..."
    
    if command -v lsof &> /dev/null; then
        if lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1; then
            # Port is in use. Check if it's our container.
            if docker ps --format "{{.Ports}}" | grep -q ":${port}->"; then
                # It is a docker container. Let's assume for now it might be ours if we are in a "redeploy" flow.
                # But strictly speaking, we should check if it's *our* container.
                # We'll defer the strict check to check_existing_containers which runs later.
                # For now, just warn if it's NOT docker.
                log_warning "Port ${port} is in use. Checking if it belongs to an existing deployment..."
                return 0
            else
                log_error "Port ${port} is already in use by a non-Docker process. Please release this port."
                exit 1
            fi
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -an | grep -q ":${port}.*LISTEN"; then
             log_warning "Port ${port} is in use. Checking if it belongs to an existing deployment..."
             return 0
        fi
    fi
    
    log_success "Port ${port} is available"
}

check_ports() {
    check_port_available "${API_PORT}" "API"
    check_port_available "${KIBANA_PORT}" "Kibana"
}

check_disk_space() {
    log_info "Checking disk space..."
    
    available_space=$(df -k "${PROJECT_ROOT}" | awk 'NR==2 {print $4}')
    required_space=2097152  # 2GB in KB (for Docker images + data)
    
    if [ "${available_space}" -lt "${required_space}" ]; then
        log_warning "Low disk space (< 2GB available). Consider freeing up space."
    else
        log_success "Sufficient disk space available"
    fi
}

################################################################################
# Environment Setup
################################################################################

setup_environment() {
    log_info "Setting up environment configuration..."
    
    # Create .env from example if it doesn't exist
    if [ ! -f "${ENV_FILE}" ]; then
        log_info "Creating ${ENV_FILE} from ${ENV_EXAMPLE}..."
        cp "${ENV_EXAMPLE}" "${ENV_FILE}"
        log_success "Created ${ENV_FILE}"
    else
        log_success "${ENV_FILE} already exists"
    fi
}

generate_api_keys() {
    log_info "Checking API keys configuration..."
    
    # Check if API_KEYS exists and is not empty
    if grep -q "^API_KEYS=" "${ENV_FILE}" 2>/dev/null; then
        api_keys=$(grep "^API_KEYS=" "${ENV_FILE}" | cut -d'=' -f2-)
        if [ -n "${api_keys}" ]; then
            log_success "API keys already configured"
            return 0
        fi
    fi
    
    log_info "Generating new API keys..."
    
    # Generate 3 API keys
    KEY1=$(openssl rand -hex 32)
    KEY2=$(openssl rand -hex 32)
    KEY3=$(openssl rand -hex 32)
    
    # Remove old API_KEYS line if exists
    if grep -q "^API_KEYS=" "${ENV_FILE}" 2>/dev/null; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' '/^API_KEYS=/d' "${ENV_FILE}"
        else
            sed -i '/^API_KEYS=/d' "${ENV_FILE}"
        fi
    fi
    
    # Append new API keys
    {
        echo ""
        echo "# API keys generated by deploy.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
        echo "API_KEYS=${KEY1},${KEY2},${KEY3}"
    } >> "${ENV_FILE}"
    
    # Store keys for later display
    GENERATED_KEY1="${KEY1}"
    GENERATED_KEY2="${KEY2}"
    GENERATED_KEY3="${KEY3}"
    KEYS_GENERATED=true
    
    log_success "API keys generated successfully"
}

configure_rate_limiting() {
    log_info "Configuring rate limiting..."
    
    # Set defaults if not present
    if ! grep -q "^RATE_LIMIT_WINDOW_MS=" "${ENV_FILE}" 2>/dev/null; then
        echo "RATE_LIMIT_WINDOW_MS=60000" >> "${ENV_FILE}"
    fi
    
    if ! grep -q "^RATE_LIMIT_MAX_REQUESTS=" "${ENV_FILE}" 2>/dev/null; then
        echo "RATE_LIMIT_MAX_REQUESTS=100" >> "${ENV_FILE}"
    fi
    
    if ! grep -q "^RATE_LIMIT_BATCH_MAX=" "${ENV_FILE}" 2>/dev/null; then
        echo "RATE_LIMIT_BATCH_MAX=20" >> "${ENV_FILE}"
    fi
    
    log_success "Rate limiting configured"
}

create_directories() {
    log_info "Creating required directories..."
    
    mkdir -p logs/fallback
    
    log_success "Directories created"
}

################################################################################
# Docker Deployment
################################################################################

check_existing_containers() {
    log_info "Checking for existing containers..."
    
    # Check if any containers exist (running or stopped)
    existing_containers=$(${DOCKER_COMPOSE_CMD} -f "${COMPOSE_FILE}" ps -a -q 2>/dev/null | wc -l | tr -d ' ')
    
    if [ "${existing_containers}" -gt 0 ]; then
        log_warning "Found ${existing_containers} existing container(s) from this project."
        ${DOCKER_COMPOSE_CMD} -f "${COMPOSE_FILE}" ps
        
        echo ""
        echo -e "${YELLOW}Existing deployment detected. How would you like to proceed?${NC}"
        echo ""
        echo "  1) Clean & Redeploy (Stop, Remove Volumes, Start Fresh) - RECOMMENDED"
        echo "  2) Restart (Stop & Start existing containers)"
        echo "  3) Cancel"
        echo ""
        read -p "Enter your choice [1-3]: " cleanup_choice
        
        case "${cleanup_choice}" in
            1)
                log_info "Performing full cleanup..."
                ${DOCKER_COMPOSE_CMD} -f "${COMPOSE_FILE}" down -v --rmi all 2>/dev/null || true
                log_success "Cleanup completed. Proceeding with fresh deployment..."
                ;;
            2)
                log_info "Restarting containers..."
                ${DOCKER_COMPOSE_CMD} -f "${COMPOSE_FILE}" restart
                log_success "Containers restarted"
                wait_for_health
                display_summary
                exit 0
                ;;
            3)
                log_info "Deployment cancelled by user"
                exit 0
                ;;
            *)
                log_warning "Invalid choice. Defaulting to Clean & Redeploy (Option 1)."
                log_info "Performing full cleanup..."
                ${DOCKER_COMPOSE_CMD} -f "${COMPOSE_FILE}" down -v --rmi all 2>/dev/null || true
                ;;
        esac
    else
        log_success "No existing containers found"
    fi
}

build_docker_images() {
    log_info "Building Docker images..."
    
    if ! ${DOCKER_COMPOSE_CMD} -f "${COMPOSE_FILE}" build; then
        log_error "Failed to build Docker images"
        exit 1
    fi
    
    log_success "Docker images built successfully"
}

start_containers() {
    log_info "Starting Docker containers..."
    
    # Start containers
    if ! ${DOCKER_COMPOSE_CMD} -f "${COMPOSE_FILE}" up -d; then
        log_error "Failed to start containers"
        exit 1
    fi
    
    log_success "Containers started"
}

wait_for_health() {
    log_info "Waiting for services to become healthy (this may take 1-2 minutes)..."
    
    max_attempts=60
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        # Check if all services are healthy (now 6 services including Kibana)
        if ${DOCKER_COMPOSE_CMD} -f "${COMPOSE_FILE}" ps | grep -E "(healthy|Up)" | wc -l | grep -q "6"; then
            # Check if API is responding
            if curl -s -f -m 5 "http://localhost:${API_PORT}/health" > /dev/null 2>&1; then
                echo ""
                log_success "All services are healthy and ready"
                return 0
            fi
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    echo ""
    log_error "Services did not become healthy within expected time"
    log_info "Container status:"
    ${DOCKER_COMPOSE_CMD} -f "${COMPOSE_FILE}" ps
    log_info "Recent logs:"
    ${DOCKER_COMPOSE_CMD} -f "${COMPOSE_FILE}" logs --tail=50
    exit 1
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check container status
    running_count=$(${DOCKER_COMPOSE_CMD} -f "${COMPOSE_FILE}" ps | grep -c "Up" || true)
    if [ "$running_count" -lt 6 ]; then
        log_error "Not all containers are running (expected 6, found $running_count)"
        return 1
    fi
    
    # Check health endpoint
    if ! curl -s -f "http://localhost:${API_PORT}/health" > /dev/null; then
        log_error "Health endpoint is not responding"
        return 1
    fi
    
    # Check metrics endpoint
    if ! curl -s -f "http://localhost:${API_PORT}/metrics" > /dev/null; then
        log_warning "Metrics endpoint is not responding"
    fi
    
    log_success "Deployment verified successfully"
}

run_e2e_tests() {
    log_info "Running comprehensive E2E tests..."
    
    # Extract first API key for tests
    local test_api_key=$(grep "^API_KEYS=" "${ENV_FILE}" | cut -d'=' -f2 | cut -d',' -f1 | tr -d ' ')
    
    if [ -z "$test_api_key" ]; then
        log_warning "No API key found for testing. Tests may be incomplete."
    fi
    
    # Run test script
    if [ -f "scripts/test.sh" ]; then
        echo ""
        if bash scripts/test.sh "$test_api_key"; then
            log_success "All E2E tests passed"
            return 0
        else
            log_error "Some E2E tests failed"
            return 1
        fi
    else
        log_warning "Test script not found at scripts/test.sh"
        return 0
    fi
}

################################################################################
# Post-Deployment
################################################################################

display_summary() {
    log_header "Deployment Complete!"
    
    echo -e "${GREEN}✓${NC} StealthFlow Observability services are running and ready to use!"
    echo ""
    
    # Service URLs
    echo -e "${BLUE}Service URLs:${NC}"
    echo "  • API Server:     http://localhost:${API_PORT}"
    echo "  • Kibana:         http://localhost:${KIBANA_PORT}"
    echo "  • Health Check:   http://localhost:${API_PORT}/health"
    echo "  • Metrics:        http://localhost:${API_PORT}/metrics"
    echo ""
    
    # Container status
    echo -e "${BLUE}Container Status:${NC}"
    ${DOCKER_COMPOSE_CMD} -f "${COMPOSE_FILE}" ps
    echo ""
    
    # API Keys
    if [ "${KEYS_GENERATED:-false}" = true ]; then
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${YELLOW}  IMPORTANT: API Keys (Save These Securely!)${NC}"
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
        echo ""
        echo -e "  Key 1: ${GREEN}${GENERATED_KEY1}${NC}"
        echo -e "  Key 2: ${GREEN}${GENERATED_KEY2}${NC}"
        echo -e "  Key 3: ${GREEN}${GENERATED_KEY3}${NC}"
        echo ""
        echo -e "${YELLOW}  These keys are saved in .env and will NOT be displayed again.${NC}"
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
        echo ""
    else
        echo -e "${BLUE}API Keys:${NC}"
        echo "  Using existing keys from .env file"
        echo ""
    fi
    
    # Usage examples
    echo -e "${BLUE}Usage Examples:${NC}"
    echo ""
    echo "  1. Test health (no auth required):"
    echo -e "     ${GREEN}curl http://localhost:${API_PORT}/health${NC}"
    echo ""
    echo "  2. Submit a log (requires API key):"
    if [ "${KEYS_GENERATED:-false}" = true ]; then
        echo -e "     ${GREEN}curl -X POST http://localhost:${API_PORT}/api/v1/logs \\\\${NC}"
        echo -e "       ${GREEN}-H 'Content-Type: application/json' \\\\${NC}"
        echo -e "       ${GREEN}-H 'X-API-Key: ${GENERATED_KEY1}' \\\\${NC}"
        echo -e "       ${GREEN}-d '{\"category\":\"TEST\",\"operation\":\"test\"}'${NC}"
    else
        echo -e "     ${GREEN}curl -X POST http://localhost:${API_PORT}/api/v1/logs \\\\${NC}"
        echo -e "       ${GREEN}-H 'Content-Type: application/json' \\\\${NC}"
        echo -e "       ${GREEN}-H 'X-API-Key: <your-api-key>' \\\\${NC}"
        echo -e "       ${GREEN}-d '{\"category\":\"TEST\",\"operation\":\"test\"}'${NC}"
    fi
    echo ""
    echo "  3. View metrics:"
    echo -e "     ${GREEN}curl http://localhost:${API_PORT}/metrics${NC}"
    echo ""
    
    # Security features
    echo -e "${BLUE}Security Features Enabled:${NC}"
    echo "  ✓ API Key Authentication"
    echo "  ✓ Rate Limiting (100 req/min per IP)"
    echo "  ✓ Security Metrics (Prometheus)"
    echo ""
    
    # Infrastructure
    echo -e "${BLUE}Infrastructure Services (Docker Internal + Localhost):${NC}"
    echo "  ✓ Redis (message queue) - 127.0.0.1:6379"
    echo "  ✓ Elasticsearch (log storage) - 127.0.0.1:9200"
    echo "  ✓ MongoDB (metadata) - 127.0.0.1:27017"
    echo ""
    
    # Useful commands
    echo -e "${BLUE}Useful Commands:${NC}"
    echo "  • View logs:        docker-compose logs -f"
    echo "  • View API logs:    docker-compose logs -f observability-api"
    echo "  • Stop services:    docker-compose down"
    echo "  • Restart services: docker-compose restart"
    echo "  • Check status:     docker-compose ps"
    echo "  • Clean up:         docker-compose down -v (removes data volumes)"
    echo ""
}

################################################################################
# Main
################################################################################

main() {
    cd "${PROJECT_ROOT}"
    
    log_header "StealthFlow Observability - Automated Deployment"
    
    # Pre-flight checks
    log_header "Step 1: Pre-flight Checks"
    check_docker
    detect_docker_compose
    check_ports
    check_disk_space
    
    # Environment setup
    log_header "Step 2: Environment Setup"
    setup_environment
    generate_api_keys
    configure_rate_limiting
    create_directories
    
    # Docker deployment
    log_header "Step 3: Docker Deployment"
    check_existing_containers
    build_docker_images
    start_containers
    wait_for_health
    
    # Verification
    log_header "Step 4: Verification"
    verify_deployment
    
    # E2E Testing
    log_header "Step 5: E2E Testing"
    if ! run_e2e_tests; then
        log_error "E2E tests failed. Deployment completed but may have issues."
        log_info "Please review test results above and fix any issues."
        echo ""
        log_warning "You can re-run tests manually with: ./scripts/test.sh"
        exit 1
    fi
    
    # Display summary
    display_summary
    
    log_success "Deployment completed successfully! 🚀"
}

# Run main function
main "$@"
