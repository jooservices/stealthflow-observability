#!/usr/bin/env bash

################################################################################
# StealthFlow Observability - Demo Script
################################################################################
#
# This script demonstrates the capabilities of the StealthFlow Observability stack.
# It will:
# 1. Verify the deployment (using test.sh)
# 2. Generate 600 meaningful log entries with NEW format (schema_version: 1) - 100 per category
# 3. Run stress test with 5,000 random API requests
# 4. Guide you on how to explore the data in Kibana
#
# Routing Rules Tested:
# - BUSINESS -> LONG_TERM (MongoDB) or CRITICAL_DUAL (ES+Mongo) for errors
# - ANALYTICS -> LONG_TERM (MongoDB)
# - SYSTEM -> HOT_SEARCH (Elasticsearch) or DEBUG_SHORT for debug
# - SECURITY -> CRITICAL_DUAL (ES+Mongo) for errors, HOT_SEARCH for info
#
# Usage: ./scripts/demo.sh
#
################################################################################

set -euo pipefail

# Configuration
API_URL="${API_URL:-http://localhost:3100}"
ENV_FILE=".env"
KIBANA_URL="http://localhost:5601"

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

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if .env exists
if [ ! -f "${ENV_FILE}" ]; then
    log_error ".env file not found. Please run ./scripts/deploy.sh first."
    exit 1
fi

# Extract API Key
log_info "Extracting API key from .env..."
API_KEY=$(grep "^API_KEYS=" "${ENV_FILE}" | cut -d'=' -f2 | cut -d',' -f1 | tr -d ' ')

if [ -z "$API_KEY" ]; then
    log_error "No API key found in .env. Please run ./scripts/deploy.sh to generate keys."
    exit 1
fi

log_success "Using API Key: ${API_KEY:0:10}..."

# Step 1: Verify Deployment
log_header "Step 1: Verifying Deployment"
if [ -f "scripts/test.sh" ]; then
    log_info "Running test suite..."
    if bash scripts/test.sh "$API_KEY"; then
        log_success "System is healthy and ready for demo."
    else
        log_error "System verification failed. Please check logs."
        exit 1
    fi
else
    log_error "scripts/test.sh not found."
    exit 1
fi

# Step 2: Generate Meaningful Log Data
log_header "Step 2: Generating 600 Log Entries (100 per Category)"

log_info "Sending 600 log records to ${API_URL}..."
log_info "Using new format: schema_version: 1, with kind, category, event, trace, context, payload"
log_info "100 logs per category: BUSINESS, ANALYTICS, SYSTEM, SECURITY, FACEBOOK, AUDIT"

count=0
total=600  # 100 logs per category × 6 categories

# Generate UUID-4 (works on macOS and Linux)
generate_uuid() {
    if command -v uuidgen >/dev/null 2>&1; then
        # Use uuidgen if available (macOS)
        uuidgen | tr '[:upper:]' '[:lower:]'
    elif [ -f /proc/sys/kernel/random/uuid ]; then
        # Linux
        cat /proc/sys/kernel/random/uuid
    else
        # Fallback: generate manually
        local hex_chars="0123456789abcdef"
        local uuid=""
        for i in {1..32}; do
            if [ $i -eq 13 ]; then
                uuid="${uuid}4"
            elif [ $i -eq 17 ]; then
                uuid="${uuid}$(echo $hex_chars | cut -c $((RANDOM % 4 + 9)))"
            else
                uuid="${uuid}$(echo $hex_chars | cut -c $((RANDOM % 16 + 1)))"
            fi
        done
        echo "${uuid:0:8}-${uuid:8:4}-${uuid:12:4}-${uuid:16:4}-${uuid:20:12}"
    fi
}

# Helper function to send log with new format
send_log_new_format() {
    local schema_version=$1
    local log_id=$2
    local timestamp=$3
    local level=$4
    local service=$5
    local environment=$6
    local kind=$7
    local category=$8
    local event=$9
    local message=${10}
    local trace=${11}
    local context=${12}
    local payload=${13}
    local host=${14}
    local tags=${15}
    
    local payload_json="{\"schema_version\":$schema_version,\"log_id\":\"$log_id\",\"timestamp\":\"$timestamp\",\"level\":\"$level\",\"service\":\"$service\",\"environment\":\"$environment\",\"kind\":\"$kind\",\"category\":\"$category\",\"event\":\"$event\",\"message\":\"$message\",\"trace\":$trace,\"context\":$context,\"payload\":$payload,\"host\":$host,\"tags\":$tags}"
    
    curl -s -X POST "${API_URL}/api/v1/logs" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: ${API_KEY}" \
        -d "$payload_json" > /dev/null &
    
    count=$((count + 1))
    if [ $((count % 10)) -eq 0 ]; then
        echo -n "."
    fi
    
    if [ $((count % 20)) -eq 0 ]; then
        wait
    fi
}

# BUSINESS Category (100 logs) -> LONG_TERM (MongoDB) or CRITICAL_DUAL for errors
log_info "Generating BUSINESS logs (100 logs)..."
for i in {1..100}; do
    uuid=$(generate_uuid)
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    trace_id=$(generate_uuid)
    span_id=$(generate_uuid)
    
    # Distribute across different scenarios
    scenario=$((i % 20))
    
    case $scenario in
        0|1|2|3|4|5|6|7|8|9|10|11|12|13|14)
            # INFO level -> LONG_TERM (75 logs)
            send_log_new_format \
                1 "$uuid" "$timestamp" "INFO" "OrderService" "production" "BUSINESS" \
                "business.order" "order_created" "Order created successfully" \
                "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
                "{\"orderId\":\"ORD-$(printf %05d $i)\",\"amount\":$((RANDOM % 1000 + 50)),\"currency\":\"USD\",\"customerId\":\"CUST-$(printf %06d $((RANDOM % 10000)))\"}" \
                "{\"endpoint\":\"/api/orders\",\"method\":\"POST\",\"response_code\":201,\"response_time_ms\":$((RANDOM % 200 + 50))}" \
                "{\"hostname\":\"node-01\",\"ip\":\"10.0.0.5\",\"vm_id\":\"vm-order-$i\"}" \
                "[\"business\",\"order\",\"api\"]"
            ;;
        15|16|17)
            # ERROR level -> CRITICAL_DUAL (ES + Mongo) (15 logs)
            send_log_new_format \
                1 "$uuid" "$timestamp" "ERROR" "PaymentService" "production" "BUSINESS" \
                "business.payment" "payment_failed" "Payment processing failed" \
                "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
                "{\"paymentId\":\"PAY-$(printf %05d $i)\",\"amount\":$((RANDOM % 500 + 10)),\"error\":\"Insufficient funds\",\"transactionId\":\"TXN-$(printf %010d $((RANDOM % 1000000)))\"}" \
                "{\"endpoint\":\"/api/payments\",\"method\":\"POST\",\"response_code\":402,\"response_time_ms\":$((RANDOM % 100 + 20))}" \
                "{\"hostname\":\"node-02\",\"ip\":\"10.0.0.6\",\"vm_id\":\"vm-payment-$i\"}" \
                "[\"business\",\"payment\",\"error\"]"
            ;;
        18)
            # WARN level -> CRITICAL_DUAL (5 logs)
            send_log_new_format \
                1 "$uuid" "$timestamp" "WARN" "SubscriptionService" "production" "BUSINESS" \
                "business.subscription" "subscription_warning" "Subscription approaching limit" \
                "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
                "{\"subscriptionId\":\"SUB-$(printf %05d $i)\",\"plan\":\"premium\",\"usage\":85,\"limit\":100}" \
                "{\"endpoint\":\"/api/subscriptions\",\"method\":\"GET\",\"response_code\":200,\"response_time_ms\":$((RANDOM % 150 + 30))}" \
                "{\"hostname\":\"node-03\",\"ip\":\"10.0.0.7\",\"vm_id\":\"vm-sub-$i\"}" \
                "[\"business\",\"subscription\",\"warning\"]"
            ;;
        19)
            # FATAL level -> CRITICAL_DUAL (5 logs)
            send_log_new_format \
                1 "$uuid" "$timestamp" "FATAL" "OrderService" "production" "BUSINESS" \
                "business.order" "order_system_failure" "Critical order system failure" \
                "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
                "{\"orderId\":\"ORD-$(printf %05d $i)\",\"error\":\"Database connection lost\",\"severity\":\"critical\"}" \
                "{\"endpoint\":\"/api/orders\",\"method\":\"POST\",\"response_code\":500,\"response_time_ms\":5000}" \
                "{\"hostname\":\"node-01\",\"ip\":\"10.0.0.5\",\"vm_id\":\"vm-order-$i\"}" \
                "[\"business\",\"order\",\"fatal\",\"critical\"]"
            ;;
    esac
done
wait  # Wait for all BUSINESS logs to complete

# ANALYTICS Category (100 logs) -> LONG_TERM (MongoDB)
log_info "Generating ANALYTICS logs (100 logs → LONG_TERM / MongoDB)..."
for i in {1..100}; do
    uuid=$(generate_uuid)
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    trace_id=$(generate_uuid)
    span_id=$(generate_uuid)
    
    # Distribute across different event types
    event_type=$((i % 4))
    
    case $event_type in
        0)
            # Page view (25 logs)
            send_log_new_format \
                1 "$uuid" "$timestamp" "INFO" "AnalyticsService" "production" "ANALYTICS" \
                "analytics.pageview" "page_view" "Page view tracked" \
                "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
                "{\"page\":\"/products\",\"userId\":\"USER-$(printf %06d $((RANDOM % 10000)))\",\"sessionId\":\"SESS-$(printf %010d $((RANDOM % 1000000)))\",\"duration\":$((RANDOM % 300 + 10))}" \
                "{\"endpoint\":\"/api/analytics/pageview\",\"method\":\"POST\",\"response_code\":200,\"response_time_ms\":$((RANDOM % 30 + 5))}" \
                "{\"hostname\":\"analytics-node-01\",\"ip\":\"10.0.1.5\",\"vm_id\":\"vm-analytics-$i\"}" \
                "[\"analytics\",\"pageview\",\"tracking\"]"
            ;;
        1)
            # Conversion event (25 logs)
            send_log_new_format \
                1 "$uuid" "$timestamp" "INFO" "AnalyticsService" "production" "ANALYTICS" \
                "analytics.conversion" "conversion_event" "Conversion event tracked" \
                "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
                "{\"eventType\":\"purchase\",\"value\":$((RANDOM % 500 + 50)),\"userId\":\"USER-$(printf %06d $((RANDOM % 10000)))\",\"campaignId\":\"CAMP-$(printf %04d $((RANDOM % 100)))\"}" \
                "{\"endpoint\":\"/api/analytics/conversion\",\"method\":\"POST\",\"response_code\":200,\"response_time_ms\":$((RANDOM % 40 + 10))}" \
                "{\"hostname\":\"analytics-node-02\",\"ip\":\"10.0.1.6\",\"vm_id\":\"vm-analytics-$i\"}" \
                "[\"analytics\",\"conversion\",\"tracking\"]"
            ;;
        2)
            # User engagement (25 logs)
            send_log_new_format \
                1 "$uuid" "$timestamp" "INFO" "AnalyticsService" "production" "ANALYTICS" \
                "analytics.engagement" "user_engagement" "User engagement metric" \
                "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
                "{\"metric\":\"click_rate\",\"value\":$((RANDOM % 100)),\"userId\":\"USER-$(printf %06d $((RANDOM % 10000)))\",\"feature\":\"product_catalog\"}" \
                "{\"endpoint\":\"/api/analytics/engagement\",\"method\":\"POST\",\"response_code\":200,\"response_time_ms\":$((RANDOM % 35 + 8))}" \
                "{\"hostname\":\"analytics-node-03\",\"ip\":\"10.0.1.7\",\"vm_id\":\"vm-analytics-$i\"}" \
                "[\"analytics\",\"engagement\",\"metric\"]"
            ;;
        3)
            # Performance metric (25 logs)
            send_log_new_format \
                1 "$uuid" "$timestamp" "INFO" "AnalyticsService" "production" "ANALYTICS" \
                "analytics.performance" "performance_metric" "Performance metric recorded" \
                "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
                "{\"metric\":\"api_response_time\",\"value\":$((RANDOM % 500 + 50)),\"endpoint\":\"/api/products\",\"statusCode\":200}" \
                "{\"endpoint\":\"/api/analytics/metrics\",\"method\":\"POST\",\"response_code\":200,\"response_time_ms\":$((RANDOM % 25 + 5))}" \
                "{\"hostname\":\"analytics-node-04\",\"ip\":\"10.0.1.8\",\"vm_id\":\"vm-analytics-$i\"}" \
                "[\"analytics\",\"performance\",\"metric\"]"
            ;;
    esac
done
wait  # Wait for all ANALYTICS logs to complete

# SYSTEM Category (100 logs) -> HOT_SEARCH (Elasticsearch) or DEBUG_SHORT for debug
log_info "Generating SYSTEM logs (100 logs → HOT_SEARCH / Elasticsearch)..."
for i in {1..100}; do
    uuid=$(generate_uuid)
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    trace_id=$(generate_uuid)
    span_id=$(generate_uuid)
    
    # Distribute across different scenarios
    scenario=$((i % 10))
    
    case $scenario in
        0|1|2|3|4|5|6)
            # INFO level -> HOT_SEARCH (70 logs)
            send_log_new_format \
                1 "$uuid" "$timestamp" "INFO" "SystemService" "production" "SYSTEM" \
                "system.service" "service_operation" "System service operation" \
                "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
                "{\"service\":\"Service-$i\",\"operation\":\"operation_$i\",\"status\":\"success\"}" \
                "{\"endpoint\":\"internal\",\"method\":\"GET\",\"response_code\":200,\"response_time_ms\":$((RANDOM % 100 + 10))}" \
                "{\"hostname\":\"node-$(printf %02d $((i % 10 + 1)))\",\"ip\":\"10.0.0.$((i % 255 + 1))\",\"vm_id\":\"vm-system-$i\"}" \
                "[\"system\",\"service\",\"info\"]"
            ;;
        7|8)
            # DEBUG level -> DEBUG_SHORT (20 logs)
            send_log_new_format \
                1 "$uuid" "$timestamp" "DEBUG" "SystemService" "production" "SYSTEM" \
                "system.debug" "debug_operation" "Debug operation" \
                "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
                "{\"debugInfo\":\"Debug info for operation $i\",\"level\":\"debug\"}" \
                "{\"endpoint\":\"internal\",\"method\":\"DEBUG\",\"response_code\":200,\"response_time_ms\":$((RANDOM % 10 + 1))}" \
                "{\"hostname\":\"node-$(printf %02d $((i % 10 + 1)))\",\"ip\":\"10.0.0.$((i % 255 + 1))\",\"vm_id\":\"vm-system-$i\"}" \
                "[\"system\",\"debug\"]"
            ;;
        9)
            # ERROR level -> HOT_SEARCH (10 logs)
            send_log_new_format \
                1 "$uuid" "$timestamp" "ERROR" "SystemService" "production" "SYSTEM" \
                "system.error" "error_occurred" "System error occurred" \
                "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
                "{\"error\":\"Error in operation $i\",\"severity\":\"high\"}" \
                "{\"endpoint\":\"internal\",\"method\":\"ERROR\",\"response_code\":500,\"response_time_ms\":$((RANDOM % 1000 + 100))}" \
                "{\"hostname\":\"node-$(printf %02d $((i % 10 + 1)))\",\"ip\":\"10.0.0.$((i % 255 + 1))\",\"vm_id\":\"vm-system-$i\"}" \
                "[\"system\",\"error\"]"
            ;;
    esac
done
wait  # Wait for all SYSTEM logs to complete

# SECURITY Category (100 logs) -> CRITICAL_DUAL for errors, HOT_SEARCH for info
log_info "Generating SECURITY logs (100 logs)..."
for i in {1..100}; do
    uuid=$(generate_uuid)
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    trace_id=$(generate_uuid)
    span_id=$(generate_uuid)
    
    # Distribute across different scenarios
    scenario=$((i % 5))
    
    case $scenario in
        0|1)
            # ERROR -> CRITICAL_DUAL (40 logs)
            send_log_new_format \
                1 "$uuid" "$timestamp" "ERROR" "SecurityService" "production" "SECURITY" \
                "security.auth" "authentication_failed" "Authentication attempt failed" \
                "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
                "{\"userId\":\"USER-$(printf %06d $((RANDOM % 10000)))\",\"reason\":\"invalid_credentials\",\"ipAddress\":\"192.168.1.$((RANDOM % 255))\"}" \
                "{\"endpoint\":\"/api/auth/login\",\"method\":\"POST\",\"response_code\":401,\"response_time_ms\":$((RANDOM % 100 + 20))}" \
                "{\"hostname\":\"security-node-$(printf %02d $((i % 10 + 1)))\",\"ip\":\"10.0.2.$((i % 255 + 1))\",\"vm_id\":\"vm-security-$i\"}" \
                "[\"security\",\"auth\",\"error\"]"
            ;;
        2)
            # WARN -> CRITICAL_DUAL (20 logs)
            send_log_new_format \
                1 "$uuid" "$timestamp" "WARN" "SecurityService" "production" "SECURITY" \
                "security.threat" "suspicious_activity" "Suspicious activity detected" \
                "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
                "{\"threatType\":\"brute_force\",\"ipAddress\":\"192.168.1.$((RANDOM % 255))\",\"attempts\":$((RANDOM % 10 + 5))}" \
                "{\"endpoint\":\"/api/security/threats\",\"method\":\"POST\",\"response_code\":200,\"response_time_ms\":$((RANDOM % 50 + 10))}" \
                "{\"hostname\":\"security-node-$(printf %02d $((i % 10 + 1)))\",\"ip\":\"10.0.2.$((i % 255 + 1))\",\"vm_id\":\"vm-security-$i\"}" \
                "[\"security\",\"threat\",\"warning\"]"
            ;;
        3)
            # INFO -> HOT_SEARCH (20 logs)
            send_log_new_format \
                1 "$uuid" "$timestamp" "INFO" "AuthService" "production" "SECURITY" \
                "security.auth" "user_login" "User logged in successfully" \
                "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
                "{\"userId\":\"USER-$(printf %06d $((RANDOM % 10000)))\",\"ipAddress\":\"192.168.1.$((RANDOM % 255))\",\"userAgent\":\"Mozilla/5.0\"}" \
                "{\"endpoint\":\"/api/auth/login\",\"method\":\"POST\",\"response_code\":200,\"response_time_ms\":$((RANDOM % 200 + 50))}" \
                "{\"hostname\":\"auth-node-$(printf %02d $((i % 10 + 1)))\",\"ip\":\"10.0.2.$((i % 255 + 1))\",\"vm_id\":\"vm-security-$i\"}" \
                "[\"security\",\"auth\",\"login\"]"
            ;;
        4)
            # DEBUG -> DEBUG_SHORT (20 logs)
            send_log_new_format \
                1 "$uuid" "$timestamp" "DEBUG" "SecurityService" "production" "SECURITY" \
                "security.token" "token_validated" "Token validation performed" \
                "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
                "{\"tokenType\":\"jwt\",\"expiresIn\":3600,\"userId\":\"USER-$(printf %06d $((RANDOM % 10000)))\"}" \
                "{\"endpoint\":\"internal\",\"method\":\"VALIDATE\",\"response_code\":200,\"response_time_ms\":$((RANDOM % 10 + 2))}" \
                "{\"hostname\":\"security-node-$(printf %02d $((i % 10 + 1)))\",\"ip\":\"10.0.2.$((i % 255 + 1))\",\"vm_id\":\"vm-security-$i\"}" \
                "[\"security\",\"token\",\"debug\"]"
            ;;
    esac
done
wait  # Wait for all SECURITY logs to complete

# FACEBOOK category (100 logs) -> HOT_SEARCH (by category pattern)
log_info "Generating FACEBOOK logs (100 logs → HOT_SEARCH by category pattern)..."
for i in {1..100}; do
    uuid=$(generate_uuid)
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    trace_id=$(generate_uuid)
    span_id=$(generate_uuid)
    
    send_log_new_format \
        1 "$uuid" "$timestamp" "INFO" "FBCrawlerWorker" "production" "SYSTEM" \
        "facebook.graphapi" "fb_api_call" "Facebook API call completed" \
        "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
        "{\"user_id\":$((RANDOM % 1000000 + 100000)),\"page_id\":\"999888777\",\"ip\":\"1.2.3.4\",\"route\":\"/photos\"}" \
        "{\"endpoint\":\"/me/photos\",\"method\":\"GET\",\"response_code\":200,\"response_time_ms\":$((RANDOM % 200 + 50)),\"cursor_after\":\"XYZ\",\"request_size_bytes\":512,\"response_size_bytes\":4096}" \
        "{\"hostname\":\"fbcrawler-node-01\",\"ip\":\"10.0.3.5\",\"vm_id\":\"vm-fbcrawler-$i\",\"container_id\":\"fbcrawler-worker-1\"}" \
        "[\"facebook\",\"crawler\",\"api\"]"
done
wait  # Wait for all FACEBOOK logs to complete

# AUDIT category (100 logs) -> AUDIT profile (MongoDB, 10 years)
log_info "Generating AUDIT logs (100 logs → AUDIT profile / MongoDB, 10 years)..."
for i in {1..100}; do
    uuid=$(generate_uuid)
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    trace_id=$(generate_uuid)
    span_id=$(generate_uuid)
    
    send_log_new_format \
        1 "$uuid" "$timestamp" "INFO" "AuditService" "production" "AUDIT" \
        "audit.access" "access_logged" "Access event logged" \
        "{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}" \
        "{\"userId\":\"USER-$(printf %06d $((RANDOM % 10000)))\",\"resource\":\"/api/sensitive-data\",\"action\":\"read\",\"ipAddress\":\"192.168.1.$((RANDOM % 255))\"}" \
        "{\"endpoint\":\"/api/audit\",\"method\":\"POST\",\"response_code\":200,\"response_time_ms\":$((RANDOM % 30 + 5))}" \
        "{\"hostname\":\"audit-node-01\",\"ip\":\"10.0.4.5\",\"vm_id\":\"vm-audit-$i\"}" \
        "[\"audit\",\"access\",\"logging\"]"
done
wait  # Wait for all AUDIT logs to complete

# Final wait to ensure all background jobs complete
wait

echo ""
log_success "Successfully sent $total log records (100 per category)."

# Step 3: Stress Test
log_header "Step 3: Stress Test (5,000 Random Requests)"

log_info "Flooding system with 5,000 random API requests..."
log_info "This will test:"
log_info "  • Rate limiting"
log_info "  • System performance under load"
log_info "  • Concurrent request handling"
log_info "  • Error handling"

stress_count=0
stress_total=5000

# Arrays for randomization
KINDS=("BUSINESS" "SYSTEM" "ANALYTICS" "SECURITY" "AUDIT")
LEVELS=("TRACE" "DEBUG" "INFO" "WARN" "ERROR" "FATAL")
SERVICES=("OrderService" "PaymentService" "AuthService" "AnalyticsService" "SystemService" "SecurityService")
CATEGORIES=("business.order" "business.payment" "system.service" "system.database" "analytics.pageview" "security.auth" "audit.access" "facebook.graphapi")
EVENTS=("operation_completed" "request_processed" "data_updated" "cache_hit" "api_call" "job_finished" "error_occurred" "user_action")

# Helper function for stress test
send_stress_log() {
    local uuid=$(generate_uuid)
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    local trace_id=$(generate_uuid)
    local span_id=$(generate_uuid)
    
    # Random selection
    local kind=${KINDS[$((RANDOM % ${#KINDS[@]}))]}
    local level=${LEVELS[$((RANDOM % ${#LEVELS[@]}))]}
    local service=${SERVICES[$((RANDOM % ${#SERVICES[@]}))]}
    local category=${CATEGORIES[$((RANDOM % ${#CATEGORIES[@]}))]}
    local event=${EVENTS[$((RANDOM % ${#EVENTS[@]}))]}
    
    local message="Stress test log entry $stress_count"
    local trace="{\"trace_id\":\"$trace_id\",\"span_id\":\"$span_id\",\"parent_span_id\":null}"
    local context="{\"testId\":\"STRESS-$stress_count\",\"iteration\":$stress_count,\"randomValue\":$RANDOM}"
    local payload="{\"endpoint\":\"/api/test\",\"method\":\"POST\",\"response_code\":200,\"response_time_ms\":$((RANDOM % 500 + 10))}"
    local host="{\"hostname\":\"stress-node-$(printf %02d $((stress_count % 10 + 1)))\",\"ip\":\"10.0.0.$((stress_count % 255 + 1))\",\"vm_id\":\"vm-stress-$stress_count\"}"
    local tags="[\"stress\",\"test\",\"load\"]"
    
    local payload_json="{\"schema_version\":1,\"log_id\":\"$uuid\",\"timestamp\":\"$timestamp\",\"level\":\"$level\",\"service\":\"$service\",\"environment\":\"production\",\"kind\":\"$kind\",\"category\":\"$category\",\"event\":\"$event\",\"message\":\"$message\",\"trace\":$trace,\"context\":$context,\"payload\":$payload,\"host\":$host,\"tags\":$tags}"
    
    curl -s -X POST "${API_URL}/api/v1/logs" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: ${API_KEY}" \
        -d "$payload_json" > /dev/null 2>&1 &
    
    stress_count=$((stress_count + 1))
    
    # Progress indicator
    if [ $((stress_count % 100)) -eq 0 ]; then
        echo -n "."
    fi
    
    # Limit concurrency - wait every 50 requests
    if [ $((stress_count % 50)) -eq 0 ]; then
        wait
    fi
}

log_info "Starting stress test..."
start_time=$(date +%s)

for i in {1..5000}; do
    send_stress_log
done

# Wait for all remaining requests
wait

end_time=$(date +%s)
duration=$((end_time - start_time))

echo ""
log_success "Stress test completed!"
log_info "  • Total requests: $stress_total"
log_info "  • Duration: ${duration} seconds"
log_info "  • Average rate: ~$((stress_total / (duration > 0 ? duration : 1))) requests/second"
log_info ""
log_info "Check system metrics:"
log_info "  • Rate limiting: curl ${API_URL}/metrics | grep rate_limit"
log_info "  • Request count: curl ${API_URL}/metrics | grep http_requests"
log_info "  • Error rate: curl ${API_URL}/metrics | grep errors"
log_info "Distribution:"
log_info "  • BUSINESS: 100 logs (→ LONG_TERM for INFO, CRITICAL_DUAL for ERROR/WARN/FATAL, DEBUG_SHORT for DEBUG)"
log_info "  • ANALYTICS: 100 logs (→ LONG_TERM / MongoDB)"
log_info "  • SYSTEM: 100 logs (→ HOT_SEARCH for INFO/ERROR, DEBUG_SHORT for DEBUG)"
log_info "  • SECURITY: 100 logs (→ CRITICAL_DUAL for ERROR/WARN, HOT_SEARCH for INFO, DEBUG_SHORT for DEBUG)"
log_info "  • FACEBOOK: 100 logs (→ HOT_SEARCH by category pattern)"
log_info "  • AUDIT: 100 logs (→ AUDIT profile / MongoDB, 10 years retention)"
log_info "  • Total: 600 logs (100 per category)"

# Step 4: User Guidance
log_header "Step 4: Explore Data"

echo -e "${GREEN}Demo data has been ingested!${NC}"
echo ""
echo -e "You can now explore the data in Kibana:"
echo -e "${BLUE}  ${KIBANA_URL}${NC}"
echo ""
echo "Instructions:"
echo "1. Open Kibana in your browser."
echo "2. Go to 'Discover' (via the menu on the left)."
echo "3. If prompted, create a Data View for:"
echo "   - 'logs-hot-*' (HOT_SEARCH profile)"
echo "   - 'logs-debug-*' (DEBUG_SHORT profile)"
echo "   - 'logs-critical-*' (CRITICAL_DUAL profile)"
echo "4. You should see the logs we just sent."
echo ""
echo "Try filtering by:"
echo "  - kind: \"BUSINESS\" (check MongoDB for LONG_TERM)"
echo "  - kind: \"ANALYTICS\" (check MongoDB for LONG_TERM)"
echo "  - kind: \"SYSTEM\" (in Elasticsearch)"
echo "  - kind: \"SECURITY\" (in Elasticsearch, or MongoDB for CRITICAL_DUAL)"
echo "  - category: \"facebook.*\" (in Elasticsearch, HOT_SEARCH)"
echo "  - category: \"audit.*\" (in MongoDB, AUDIT profile)"
echo ""
echo "Try filtering by level:"
echo "  - level: \"ERROR\""
echo "  - level: \"WARN\""
echo "  - level: \"INFO\""
echo "  - level: \"DEBUG\""
echo ""
echo "Try filtering by service:"
echo "  - service: \"OrderService\""
echo "  - service: \"AnalyticsService\""
echo "  - service: \"FBCrawlerWorker\""
echo ""
echo -e "${YELLOW}Note:${NC}"
echo "  • BUSINESS and ANALYTICS logs (INFO level) → MongoDB (LONG_TERM)"
echo "  • BUSINESS logs (ERROR/WARN/FATAL) → Elasticsearch + MongoDB (CRITICAL_DUAL)"
echo "  • SYSTEM logs → Elasticsearch (HOT_SEARCH or DEBUG_SHORT)"
echo "  • SECURITY logs (ERROR/WARN/FATAL) → Elasticsearch + MongoDB (CRITICAL_DUAL)"
echo "  • FACEBOOK category → Elasticsearch (HOT_SEARCH, matched by category pattern)"
echo "  • AUDIT category → MongoDB (AUDIT profile, 10 years retention)"
echo ""
echo -e "${YELLOW}To clean up everything when done:${NC}"
echo "  ./scripts/cleanup.sh"
echo ""
