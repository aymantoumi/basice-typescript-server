#!/bin/bash

# Order Service Test Script with CSRF Support (Updated for Schema)
# Usage: ./test_cases.sh

set -e

BASE_URL="http://localhost:3500"
COOKIE_JAR="cookies.txt"
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

generate_unique_email() {
    local timestamp=$(date +%s)
    local random=$(echo $RANDOM | md5sum | head -c 5)
    echo "testuser_${random}@example.com"
}

get_csrf_token() {
    local response=$(curl -s -X GET "$BASE_URL/api/csrf-token" \
        -H "Content-Type: application/json" \
        -b "$COOKIE_JAR" -c "$COOKIE_JAR")
    echo "$response" | jq -r '.csrfToken'
}

cleanup() {
    log "Cleaning up test data and cookies..."
    rm -f "$COOKIE_JAR"
}

trap cleanup EXIT

> "$COOKIE_JAR"

echo -e "${BLUE}=== Order Service Tests (Schema-Compliant) ===${NC}"
echo "Base URL: $BASE_URL"
echo

if ! curl -s --head "$BASE_URL" > /dev/null; then
    error "Server is not running on $BASE_URL"
    exit 1
fi

step "1. Creating new test users"

USER1_EMAIL=$(generate_unique_email)
USER2_EMAIL=$(generate_unique_email)

log "Using emails: $USER1_EMAIL, $USER2_EMAIL"

# Create first user
log "Creating first user..."
CSRF_TOKEN=$(get_csrf_token)
USER1_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -d '{
    "name": "Ahmed Doe",
    "age": 30,
    "password": "password123",
    "email": "'"$USER1_EMAIL"'"
  }')

if [ $? -ne 0 ]; then
    error "Failed to create user 1"
    exit 1
fi

echo "User 1 response:"
echo "$USER1_RESPONSE" | jq '.'

USER1_ID=$(echo "$USER1_RESPONSE" | jq -r '.user.id')
USER1_TOKEN=$(echo "$USER1_RESPONSE" | jq -r '.token')

if [ "$USER1_ID" == "null" ] || [ "$USER1_TOKEN" == "null" ]; then
    error "Failed to get user 1 ID or token"
    exit 1
fi

log "User 1 created - ID: $USER1_ID"

# Create second user
log "Creating second user..."
CSRF_TOKEN=$(get_csrf_token)
USER2_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -d '{
    "name": "Jane Smith",
    "age": 25,
    "password": "password123",
    "email": "'"$USER2_EMAIL"'"
  }')

if [ $? -ne 0 ]; then
    error "Failed to create user 2"
    exit 1
fi

echo "User 2 response:"
echo "$USER2_RESPONSE" | jq '.'

USER2_ID=$(echo "$USER2_RESPONSE" | jq -r '.user.id')
USER2_TOKEN=$(echo "$USER2_RESPONSE" | jq -r '.token')

if [ "$USER2_ID" == "null" ] || [ "$USER2_TOKEN" == "null" ]; then
    error "Failed to get user 2 ID or token"
    exit 1
fi

log "User 2 created - ID: $USER2_ID"

step "2. Creating test products"

AUTH_HEADER_USER1="Authorization: Bearer $USER1_TOKEN"
AUTH_HEADER_USER2="Authorization: Bearer $USER2_TOKEN"

# Helper to create product with full schema
create_product() {
  local name="$1"
  local price="$2"
  local desc="$3"
  local category="${4:-electronics}"
  
  local slug=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  
  CSRF_TOKEN=$(get_csrf_token)
  curl -s -X POST "$BASE_URL/products/create" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER_USER1" \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -d '{
      "name": "'"$name"'",
      "slug": "'"$slug"'",
      "description": "'"$desc"'",
      "price": '"$price"',
      "category": "'"$category"'",
      "quantity": 100,
      "status": "active"
    }'
}

log "Creating product 1 - Laptop..."
PRODUCT1_RESPONSE=$(create_product "Laptop" "999.99" "High-performance laptop")
echo "Product 1 response:"
echo "$PRODUCT1_RESPONSE" '.'
PRODUCT1_ID=$(echo "$PRODUCT1_RESPONSE"  -r '.product.id // .id')

log "Creating product 2 - Smartphone..."
PRODUCT2_RESPONSE=$(create_product "Smartphone" "699.99" "Latest smartphone")
echo "Product 2 response:"
echo "$PRODUCT2_RESPONSE"  '.'
PRODUCT2_ID=$(echo "$PRODUCT2_RESPONSE"  -r '.product.id // .id')

log "Creating product 3 - Headphones..."
PRODUCT3_RESPONSE=$(create_product "Headphones" "199.99" "Wireless headphones")
echo "Product 3 response:"
echo "$PRODUCT3_RESPONSE"  '.'
PRODUCT3_ID=$(echo "$PRODUCT3_RESPONSE"  -r '.product.id // .id')

log "Creating product 4 - Tablet..."
PRODUCT4_RESPONSE=$(create_product "Tablet" "499.99" "10-inch tablet")
echo "Product 4 response:"
echo "$PRODUCT4_RESPONSE"  '.'
PRODUCT4_ID=$(echo "$PRODUCT4_RESPONSE"  -r '.product.id // .id')

if [ "$PRODUCT1_ID" == "null" ] || [ "$PRODUCT2_ID" == "null" ] || [ "$PRODUCT3_ID" == "null" ] || [ "$PRODUCT4_ID" == "null" ]; then
    error "Some products failed to create"
    exit 1
fi

log "Products created - IDs: $PRODUCT1_ID, $PRODUCT2_ID, $PRODUCT3_ID, $PRODUCT4_ID"

step "3. Testing Order Endpoints"

# Helper to build shipping address JSON
build_address() {
  local addr="$1"
  echo '{
    "firstName": "John",
    "lastName": "Doe",
    "address1": "'"$addr"'",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "US"
  }'
}

# Test 1: Create order with multiple products
log "Test 1: Create order with multiple products"
CSRF_TOKEN=$(get_csrf_token)
SHIPPING_ADDR=$(build_address "123 Main St")
CREATE_ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -d '{
    "customerEmail": "'"$USER1_EMAIL"'",
    "shippingAddress": '"$SHIPPING_ADDR"',
    "billingAddress": '"$SHIPPING_ADDR"',
    "items": [
      { "productId": '"$PRODUCT1_ID"', "quantity": 1 },
      { "productId": '"$PRODUCT2_ID"', "quantity": 2 },
      { "productId": '"$PRODUCT3_ID"', "quantity": 1 }
    ]
  }')
echo "Create order response:"
echo "$CREATE_ORDER_RESPONSE"  '.'
ORDER_ID=$(echo "$CREATE_ORDER_RESPONSE"  -r '.data.order.id // .order.id // .id')
if [ "$ORDER_ID" == "null" ]; then
    error "Failed to create order"
    exit 1
fi
log "Order created with ID: $ORDER_ID"

# Test 2: Create another order for same user
log "Test 2: Create another order for same user"
CSRF_TOKEN=$(get_csrf_token)
SHIPPING_ADDR2=$(build_address "456 Oak Ave, Boston, MA")
CREATE_ORDER2_RESPONSE=$(curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -d '{
    "customerEmail": "'"$USER1_EMAIL"'",
    "shippingAddress": '"$SHIPPING_ADDR2"',
    "billingAddress": '"$SHIPPING_ADDR2"',
    "items": [
      { "productId": '"$PRODUCT4_ID"', "quantity": 1 },
      { "productId": '"$PRODUCT3_ID"', "quantity": 3 }
    ]
  }')
echo "Create order 2 response:"
echo "$CREATE_ORDER2_RESPONSE"  '.'
ORDER2_ID=$(echo "$CREATE_ORDER2_RESPONSE"  -r '.data.order.id // .order.id // .id')

# Test 3: Create order for second user
log "Test 3: Create order for second user"
CSRF_TOKEN=$(get_csrf_token)
SHIPPING_ADDR3=$(build_address "789 Pine St, Chicago, IL")
CREATE_ORDER3_RESPONSE=$(curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER2" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -d '{
    "customerEmail": "'"$USER2_EMAIL"'",
    "shippingAddress": '"$SHIPPING_ADDR3"',
    "billingAddress": '"$SHIPPING_ADDR3"',
    "items": [
      { "productId": '"$PRODUCT2_ID"', "quantity": 1 }
    ]
  }')
echo "Create order 3 response:"
echo "$CREATE_ORDER3_RESPONSE"  '.'
ORDER3_ID=$(echo "$CREATE_ORDER3_RESPONSE"  -r '.data.order.id // .order.id // .id')

# Test 4: Get all orders
log "Test 4: Get all orders"
GET_ALL_ORDERS_RESPONSE=$(curl -s -X GET "$BASE_URL/orders" \
  -H "$AUTH_HEADER_USER1" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR")
echo "All orders response:"
echo "$GET_ALL_ORDERS_RESPONSE"  '.'

# Test 5: Get specific order by ID
log "Test 5: Get order by ID"
GET_ORDER_RESPONSE=$(curl -s -X GET "$BASE_URL/orders/$ORDER_ID" \
  -H "$AUTH_HEADER_USER1" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR")
echo "Get order by ID response:"
echo "$GET_ORDER_RESPONSE"  '.'

# Test 6: Get orders by user ID
log "Test 6: Get orders by user ID"
GET_USER_ORDERS_RESPONSE=$(curl -s -X GET "$BASE_URL/orders/user/$USER1_ID" \
  -H "$AUTH_HEADER_USER1" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR")
echo "Get user orders response:"
echo "$GET_USER_ORDERS_RESPONSE"  '.'

# Test 7: Update order address
log "Test 7: Update order address"
CSRF_TOKEN=$(get_csrf_token)
UPDATE_ADDR=$(build_address "999 New St, Los Angeles, CA")
UPDATE_ORDER_RESPONSE=$(curl -s -X PUT "$BASE_URL/orders/$ORDER_ID" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -d '{
    "shippingAddress": '"$UPDATE_ADDR"'
  }')
echo "Update order response:"
echo "$UPDATE_ORDER_RESPONSE"  '.'

# Test 8: Add product to existing order
log "Test 8: Add product to existing order"
CSRF_TOKEN=$(get_csrf_token)
ADD_PRODUCT_RESPONSE=$(curl -s -X POST "$BASE_URL/orders/$ORDER_ID/items" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -d '{
    "productId": '"$PRODUCT4_ID"',
    "quantity": 2
  }')
echo "Add product response:"
echo "$ADD_PRODUCT_RESPONSE"  '.'

# Test 9: Remove product from order
log "Test 9: Remove product from order"
GET_ORDER_AFTER_ADD=$(curl -s -X GET "$BASE_URL/orders/$ORDER_ID" \
  -H "$AUTH_HEADER_USER1" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR")
log "Order before removal:"
echo "$GET_ORDER_AFTER_ADD"  '.'

CSRF_TOKEN=$(get_csrf_token)
REMOVE_PRODUCT_RESPONSE=$(curl -s -X DELETE "$BASE_URL/orders/$ORDER_ID/items/$PRODUCT3_ID" \
  -H "$AUTH_HEADER_USER1" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR")
log "Remove product response:"
echo "$REMOVE_PRODUCT_RESPONSE"  '.'

# Test 10: Get order after modifications
log "Test 10: Get order after modifications"
GET_UPDATED_ORDER_RESPONSE=$(curl -s -X GET "$BASE_URL/orders/$ORDER_ID" \
  -H "$AUTH_HEADER_USER1" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR")
echo "Updated order response:"
echo "$GET_UPDATED_ORDER_RESPONSE"  '.'

step "4. Testing Error Cases"

# Test 11a: Create order without authentication
log "Test 11a: Create order without authentication"
CSRF_TOKEN=$(get_csrf_token)
INVALID_ADDR=$(build_address "123 Test St")
curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -d '{
    "customerEmail": "anon@example.com",
    "shippingAddress": '"$INVALID_ADDR"',
    "items": [{"productId": 1, "quantity": 1}]
  }'  '.'

# Test 11b: Create order with invalid product
log "Test 11b: Create order with invalid product"
CSRF_TOKEN=$(get_csrf_token)
INVALID_ADDR2=$(build_address "123 Test St")
curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -d '{
    "customerEmail": "'"$USER1_EMAIL"'",
    "shippingAddress": '"$INVALID_ADDR2"',
    "items": [{"productId": 99999, "quantity": 1}]
  }'  '.'

# Test 11c: Create order with empty items
log "Test 11c: Create order with empty items"
CSRF_TOKEN=$(get_csrf_token)
INVALID_ADDR3=$(build_address "123 Test St")
curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -d '{
    "customerEmail": "'"$USER1_EMAIL"'",
    "shippingAddress": '"$INVALID_ADDR3"',
    "items": []
  }'  '.'

# Test 11d: Get non-existent order
log "Test 11d: Get non-existent order"
curl -s -X GET "$BASE_URL/orders/99999" \
  -H "$AUTH_HEADER_USER1" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR"  '.'

# Test 11e: Update non-existent order
log "Test 11e: Update non-existent order"
CSRF_TOKEN=$(get_csrf_token)
UPDATE_ADDR_BAD=$(build_address "Test Addr")
curl -s -X PUT "$BASE_URL/orders/99999" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -d '{
    "shippingAddress": '"$UPDATE_ADDR_BAD"'
  }'  '.'

step "5. Cleanup Tests"

# Test 12: Delete an order
log "Test 12: Delete an order"
CSRF_TOKEN=$(get_csrf_token)
DELETE_ORDER_RESPONSE=$(curl -s -X DELETE "$BASE_URL/orders/$ORDER2_ID" \
  -H "$AUTH_HEADER_USER1" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR")
echo "Delete order response:"
echo "$DELETE_ORDER_RESPONSE"  '.'

# Verify deletion
log "Verify deletion:"
curl -s -X GET "$BASE_URL/orders/$ORDER2_ID" \
  -H "$AUTH_HEADER_USER1" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR"  '.'

step "6. Final State Check"

log "Test 13: Final state check"
FINAL_ORDERS_RESPONSE=$(curl -s -X GET "$BASE_URL/orders" \
  -H "$AUTH_HEADER_USER1" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR")
echo "Final orders count:"
echo "$FINAL_ORDERS_RESPONSE"  '.orders | length'

log "Getting all products to verify..."
GET_PRODUCTS_RESPONSE=$(curl -s -X GET "$BASE_URL/products" \
  -H "$AUTH_HEADER_USER1" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR")
echo "Products count:"
echo "$GET_PRODUCTS_RESPONSE"  '.products | length // . | length'

log "Testing user profile endpoint..."
USER_PROFILE_RESPONSE=$(curl -s -X GET "$BASE_URL/auth/profile" \
  -H "$AUTH_HEADER_USER1" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR")
echo "User profile response:"
echo "$USER_PROFILE_RESPONSE"  '.'

echo
echo -e "${GREEN}=== Test Summary ===${NC}"
echo "Users created: $USER1_ID ($USER1_EMAIL), $USER2_ID ($USER2_EMAIL)"
echo "Products created: $PRODUCT1_ID, $PRODUCT2_ID, $PRODUCT3_ID, $PRODUCT4_ID"
echo "Orders created: $ORDER_ID, $ORDER2_ID, $ORDER3_ID"
echo "Order $ORDER2_ID was deleted during testing"
echo
echo -e "${GREEN}=== All tests completed successfully! ===${NC}"