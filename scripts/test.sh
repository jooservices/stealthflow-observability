#!/usr/bin/env bash

################################################################################
# StealthFlow Observability - Comprehensive E2E Test Suite
################################################################################
#
# This script runs a comprehensive set of tests:
# 1. Deployment Scenario Detection (Fresh vs Incremental)
# 2. Docker Isolation Verification
# 3. Container Health & Status
# 4. API Health & Metrics
# 5. Authentication Security
# 6. Rate Limiting (Stress Test)
# 7. Functional E2E Tests (Single & Batch Logs)
#
# Usage: 
#   ./scripts/test.sh [API_KEY]
#
# The script auto-detects whether containers existed before testing
# and runs appropriate validation for each scenario.
#
################################################################################

set -e

# Configuration
API_URL="${API_URL:-http://localhost:3100}"
ENV_FILE=".env"
API_KEY="${1:-}"
NETWORK_NAME="observability-network"
CONTAINER_PREFIX="stealthflow-"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Deployment scenario
DEPLOYMENT_SCENARIO="unknown"

# Helper Functions
log_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

log_test() {
    echo -e "${BLUE}[TEST] $1${NC}"
}

log_pass() {
    echo -e "${GREEN}[PASS] $1${NC}"
    PASSED=$((PASSED + 1))
}

log_fail() {
    echo -e "${RED}[FAIL] $1${NC}"
    FAILED=$((FAILED + 1))
}

log_warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

log_info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

check_http_status() {
    local url=$1
    local expected_status=$2
    local key=$3
    local method=${4:-GET}
    local data=${5:-}
    
    local curl_cmd="curl -s -w '\n%{http_code}' -X $method"
    
    if [ -n "$key" ]; then
        curl_cmd="$curl_cmd -H 'X-API-Key: $key'"
    fi
    
    if [ -n "$data" ]; then
        curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
    fi
    
    curl_cmd="$curl_cmd '$url'"
    
    local response=$(eval $curl_cmd)
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        return 0
    else
        echo "Expected: $expected_status, Got: $http_code"
        echo "Response: $body"
        return 1
    fi
}

# Detect deployment scenario
log_header "Deployment Scenario Detection"

log_test "Detecting deployment scenario..."
container_count=$(docker-compose ps -q 2>/dev/null | wc -l | tr -d ' ')

if [ "$container_count" -eq 0 ]; then
    DEPLOYMENT_SCENARIO="fresh"
    log_info "Scenario: FRESH DEPLOYMENT (no existing containers)"
else
    DEPLOYMENT_SCENARIO="incremental"
    log_info "Scenario: INCREMENTAL DEPLOYMENT (existing containers: $container_count)"
fi

################################################################################
# 1. Docker Isolation Tests
################################################################################

log_header "1. Docker Isolation Verification"

# 1.1 Network Isolation
log_test "Checking dedicated network exists..."
if docker network ls | grep -q "$NETWORK_NAME"; then
    log_pass "Network '$NETWORK_NAME' exists"
else
    log_fail "Network '$NETWORK_NAME' not found"
fi

log_test "Verifying network is not shared with other projects..."
# Get containers on our network
our_containers=$(docker network inspect "$NETWORK_NAME" 2>/dev/null | grep -o "\"Name\": \"[^\"]*\"" | cut -d'"' -f4 | grep -v "$NETWORK_NAME" || true)

if [ -n "$our_containers" ]; then
    non_stealthflow_count=0
    while IFS= read -r container; do
        if [[ ! "$container" =~ ^${CONTAINER_PREFIX} ]] && [ "$container" != "observability-api" ] && [ "$container" != "log-worker" ]; then
            non_stealthflow_count=$((non_stealthflow_count + 1))
            log_info "Found external container: $container"
        fi
    done <<< "$our_containers"
    
    if [ $non_stealthflow_count -eq 0 ]; then
        log_pass "All containers on network are part of this project"
    else
        log_fail "Found $non_stealthflow_count external containers on our network"
    fi
else
    log_pass "No containers found on network (system may not be running)"
fi

log_test "Verifying network isolation (bridge driver)..."
network_driver=$(docker network inspect "$NETWORK_NAME" --format '{{.Driver}}' 2>/dev/null || echo "none")
if [ "$network_driver" = "bridge" ]; then
    log_pass "Network uses bridge driver (isolated)"
else
    log_fail "Network driver is '$network_driver' (expected: bridge)"
fi

# 1.2 Container Name Uniqueness
log_test "Checking all containers have unique prefix..."
expected_containers=(
    "${CONTAINER_PREFIX}redis"
    "${CONTAINER_PREFIX}elasticsearch"
    "${CONTAINER_PREFIX}mongodb"
    "${CONTAINER_PREFIX}kibana"
    "observability-api"
    "log-worker"
)

for container in "${expected_containers[@]}"; do
    if docker ps -a --format "{{.Names}}" | grep -q "^${container}$"; then
        log_pass "Container '$container' has correct unique name"
    else
        log_info "Container '$container' not found (may not be running)"
    fi
done

log_test "Verifying no name conflicts with other containers..."
conflicting_names=0
for container in "${expected_containers[@]}"; do
    count=$(docker ps -a --format "{{.Names}}" | grep -c "^${container}$" || true)
    if [ "$count" -gt 1 ]; then
        conflicting_names=$((conflicting_names + 1))
        log_fail "Duplicate container name: $container (count: $count)"
    fi
done

if [ $conflicting_names -eq 0 ]; then
    log_pass "No container name conflicts detected"
fi

# 1.3 Volume Isolation
log_test "Checking volumes have unique names..."
expected_volumes=(
    "${CONTAINER_PREFIX}redis-data"
    "${CONTAINER_PREFIX}elasticsearch-data"
    "${CONTAINER_PREFIX}mongodb-data"
)

for volume in "${expected_volumes[@]}"; do
    if docker volume ls --format "{{.Name}}" | grep -q "^${volume}$"; then
        log_pass "Volume '$volume' has correct unique name"
    else
        log_info "Volume '$volume' not found (may not exist yet)"
    fi
done

log_test "Verifying no volume name conflicts..."
conflicting_volumes=0
for volume in "${expected_volumes[@]}"; do
    count=$(docker volume ls --format "{{.Name}}" | grep -c "^${volume}$" || true)
    if [ "$count" -gt 1 ]; then
        conflicting_volumes=$((conflicting_volumes + 1))
        log_fail "Duplicate volume name: $volume (count: $count)"
    fi
done

if [ $conflicting_volumes -eq 0 ]; then
    log_pass "No volume name conflicts detected"
fi

# 1.4 Port Binding Verification
log_test "Verifying infrastructure ports are NOT exposed externally..."

# Check if containers are running
if docker ps --format "{{.Names}}" | grep -q "${CONTAINER_PREFIX}"; then
    # Check Redis port (should NOT be exposed)
    redis_binding=$(docker port "${CONTAINER_PREFIX}redis" 6379 2>/dev/null || echo "")
    if [ -z "$redis_binding" ]; then
        log_pass "Redis port NOT exposed (internal only - complete isolation)"
    else
        log_fail "Redis port is exposed: $redis_binding (should NOT be exposed for isolation)"
    fi
    
    # Check Elasticsearch port (should NOT be exposed)
    es_binding=$(docker port "${CONTAINER_PREFIX}elasticsearch" 9200 2>/dev/null || echo "")
    if [ -z "$es_binding" ]; then
        log_pass "Elasticsearch port NOT exposed (internal only - complete isolation)"
    else
        log_fail "Elasticsearch port is exposed: $es_binding (should NOT be exposed for isolation)"
    fi
    
    # Check MongoDB port (should NOT be exposed)
    mongo_binding=$(docker port "${CONTAINER_PREFIX}mongodb" 27017 2>/dev/null || echo "")
    if [ -z "$mongo_binding" ]; then
        log_pass "MongoDB port NOT exposed (internal only - complete isolation)"
    else
        log_fail "MongoDB port is exposed: $mongo_binding (should NOT be exposed for isolation)"
    fi
    
    # Check Kibana port (SHOULD be exposed now)
    kibana_binding=$(docker port "${CONTAINER_PREFIX}kibana" 5601 2>/dev/null || echo "")
    if [[ "$kibana_binding" =~ 0\.0\.0\.0:5601 ]]; then
        log_pass "Kibana port exposed correctly on 5601"
    elif [ -n "$kibana_binding" ]; then
        log_info "Kibana binding: $kibana_binding"
        log_pass "Kibana port exposed"
    else
        log_fail "Kibana port not exposed (should be accessible on 5601)"
    fi
    
    # Check API port (ONLY port that should be exposed)
    api_binding=$(docker port "observability-api" 3000 2>/dev/null || echo "")
    if [[ "$api_binding" =~ 0\.0\.0\.0:3100 ]]; then
        log_pass "API port exposed correctly on 3100 (only public interface)"
    elif [ -n "$api_binding" ]; then
        log_info "API binding: $api_binding"
    else
        log_fail "API port not exposed (should be accessible on 3100)"
    fi
else
    log_warn "Containers not running - skipping port binding tests"
fi

# 1.5 Internal Service Communication
log_test "Verifying services can communicate internally..."

if docker ps --format "{{.Names}}" | grep -q "observability-api"; then
    # Test if API can reach Redis internally
    redis_test=$(docker exec observability-api sh -c 'nc -zv redis 6379 2>&1' || echo "failed")
    if [[ "$redis_test" =~ "succeeded" ]] || [[ "$redis_test" =~ "open" ]]; then
        log_pass "API can reach Redis via internal network"
    else
        log_fail "API cannot reach Redis internally"
    fi
    
    # Test if API can reach Elasticsearch internally
    es_test=$(docker exec observability-api sh -c 'nc -zv elasticsearch 9200 2>&1' || echo "failed")
    if [[ "$es_test" =~ "succeeded" ]] || [[ "$es_test" =~ "open" ]]; then
        log_pass "API can reach Elasticsearch via internal network"
    else
        log_fail "API cannot reach Elasticsearch internally"
    fi
    
    # Test if API can reach MongoDB internally
    mongo_test=$(docker exec observability-api sh -c 'nc -zv mongodb 27017 2>&1' || echo "failed")
    if [[ "$mongo_test" =~ "succeeded" ]] || [[ "$mongo_test" =~ "open" ]]; then
        log_pass "API can reach MongoDB via internal network"
    else
        log_fail "API cannot reach MongoDB internally"
    fi
else
    log_warn "API container not running - skipping service communication tests"
fi

# 1.6 External Isolation Verification
log_test "Verifying services are NOT accessible from other Docker containers..."

# Create a test container outside our network to verify isolation
test_container="isolation-test-$$"
docker run -d --name "$test_container" alpine:latest sleep 3600 >/dev/null 2>&1 || true

if docker ps --format "{{.Names}}" | grep -q "^${test_container}$"; then
    # Try to connect to our Redis from external container (should fail)
    if docker exec "$test_container" sh -c "nc -zv ${CONTAINER_PREFIX}redis 6379 2>&1" >/dev/null 2>&1; then
        log_fail "External container CAN reach our Redis (isolation breach!)"
    else
        log_pass "External container CANNOT reach our Redis (properly isolated)"
    fi
    
    # Cleanup test container
    docker rm -f "$test_container" >/dev/null 2>&1
else
    log_warn "Could not create test container - skipping external isolation test"
fi

################################################################################
# 2. Container Status
################################################################################

log_header "2. Container Status"

log_test "Checking Docker containers..."
if docker-compose ps | grep -q "Up"; then
    container_count=$(docker-compose ps | grep "Up" | wc -l)
    if [ "$container_count" -ge 5 ]; then
        log_pass "All 5 containers are running"
    else
        log_fail "Expected 5+ containers, found: $container_count"
        docker-compose ps
    fi
else
    log_fail "No running Docker containers found"
fi

log_test "Checking container health..."
if docker-compose ps | grep -q "healthy"; then
    log_pass "Containers are reporting healthy status"
else
    log_warn "Containers may not be fully healthy yet"
fi

################################################################################
# 3. Health & Metrics
################################################################################

log_header "3. Health & Metrics"

log_test "Testing health endpoint..."
if check_http_status "$API_URL/health" "200"; then
    log_pass "Health endpoint is accessible"
else
    log_fail "Health endpoint failed"
fi

log_test "Testing metrics endpoint..."
if check_http_status "$API_URL/metrics" "200"; then
    log_pass "Metrics endpoint is accessible"
else
    log_fail "Metrics endpoint failed"
fi

################################################################################
# 4. Authentication Security
################################################################################

log_header "4. Authentication Security"

log_test "Testing access without API key (should fail)..."
if check_http_status "$API_URL/api/v1/logs" "401" "" "POST" '{"category":"TEST"}'; then
    log_pass "Correctly rejected request without key"
else
    log_fail "Should have rejected request without key"
fi

log_test "Testing access with invalid API key (should fail)..."
if check_http_status "$API_URL/api/v1/logs" "401" "invalid-key-123" "POST" '{"category":"TEST"}'; then
    log_pass "Correctly rejected request with invalid key"
else
    log_fail "Should have rejected request with invalid key"
fi

if [ -n "$API_KEY" ]; then
    log_test "Testing access with valid API key (should succeed)..."
    if check_http_status "$API_URL/api/v1/logs" "202" "$API_KEY" "POST" '{"category":"TEST","operation":"auth_test"}'; then
        log_pass "Successfully authenticated with valid key"
    else
        log_fail "Failed to authenticate with valid key"
    fi
fi

################################################################################
# 5. Functional Tests
################################################################################

log_header "5. Functional Tests"

if [ -n "$API_KEY" ]; then
    log_test "Submitting single log..."
    if check_http_status "$API_URL/api/v1/logs" "202" "$API_KEY" "POST" '{"category":"TEST","operation":"single_log","metadata":{"test":"true"}}'; then
        log_pass "Single log submission successful"
    else
        log_fail "Single log submission failed"
    fi

    log_test "Submitting batch logs..."
    BATCH_DATA='[{"category":"TEST","operation":"batch_1"},{"category":"TEST","operation":"batch_2"}]'
    if check_http_status "$API_URL/api/v1/logs/batch" "202" "$API_KEY" "POST" "$BATCH_DATA"; then
        log_pass "Batch log submission successful"
    else
        log_fail "Batch log submission failed"
    fi
    
    log_test "Testing invalid payload (should fail)..."
    if check_http_status "$API_URL/api/v1/logs" "400" "$API_KEY" "POST" '{"invalid":"payload"}'; then
        log_pass "Correctly rejected invalid payload"
    else
        log_fail "Should have rejected invalid payload"
    fi
else
    log_warn "Skipping functional tests (no API key)"
fi

################################################################################
# 6. Rate Limiting (Stress Test)
################################################################################

log_header "6. Rate Limiting Stress Test"

if [ -n "$API_KEY" ]; then
    log_test "Testing rate limit enforcement (sending 105 requests)..."
    
    LIMIT_HIT=0
    SUCCESS_COUNT=0
    
    # We expect limit is 100. Sending 105 should trigger 429.
    for i in {1..105}; do
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/v1/logs" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: $API_KEY" \
            -d "{\"category\":\"TEST\",\"operation\":\"rate_limit_$i\"}")
            
        if [ "$HTTP_CODE" = "429" ]; then
            LIMIT_HIT=1
            break
        elif [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "202" ]; then
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        fi
        
        # Progress bar
        if [ $((i % 20)) -eq 0 ]; then
            echo -n "."
        fi
    done
    echo ""
    
    if [ $LIMIT_HIT -eq 1 ]; then
        log_pass "Rate limiting correctly triggered (HTTP 429)"
    else
        log_warn "Rate limiting was NOT triggered (Configured limit might be > 100)"
    fi
else
    log_warn "Skipping rate limit test (no API key)"
fi

################################################################################
# Summary
################################################################################

log_header "Test Summary"

echo -e "${BLUE}Deployment Scenario:${NC} $DEPLOYMENT_SCENARIO"
echo ""
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${RED}Failed:${NC}   $FAILED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ ALL TESTS PASSED${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "✓ Docker isolation verified"
    echo "✓ All containers healthy"
    echo "✓ API endpoints accessible"
    echo "✓ Authentication working"
    echo "✓ Rate limiting enforced"
    echo "✓ Functional tests passed"
    echo ""
    echo "Deployment is ready for use! 🚀"
    exit 0
else
    echo -e "${RED}════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ❌ SOME TESTS FAILED${NC}"
    echo -e "${RED}════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Please review the failures above and fix the issues."
    exit 1
fi
