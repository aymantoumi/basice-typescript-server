#!/bin/bash

# Order Service Test Script
# Usage: ./test_orders.sh

set -e

BASE_URL="http://localhost:3500"
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

# Generate unique email to avoid conflicts
generate_unique_email() {
    local timestamp=$(date +%s)
    local random=$(echo $RANDOM | md5sum | head -c 5)
    echo "testuser_${timestamp}_${random}@example.com"
}

cleanup() {
    log "Cleaning up test data..."
    # Add any cleanup logic here if needed
}

trap cleanup EXIT

echo -e "${BLUE}=== Order Service Comprehensive Tests ===${NC}"
echo "Base URL: $BASE_URL"
echo

# Check if server is running
if ! curl -s "$BASE_URL" > /dev/null; then
    error "Server is not running on $BASE_URL"
    exit 1
fi

step "1. Creating new test users for this run"

# Generate unique emails
USER1_EMAIL=$(generate_unique_email)
USER2_EMAIL=$(generate_unique_email)

log "Using emails: $USER1_EMAIL, $USER2_EMAIL"

# Create first user
log "Creating first user..."
USER1_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
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

if [ "$USER1_ID" == "null" ]; then
    error "Failed to get user 1 ID"
    exit 1
fi

if [ "$USER1_TOKEN" == "null" ]; then
    error "Failed to get user 1 token"
    exit 1
fi

log "User 1 created - ID: $USER1_ID"
log "User 1 token obtained"

# Create second user
log "Creating second user..."
USER2_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
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

if [ "$USER2_ID" == "null" ]; then
    error "Failed to get user 2 ID"
    exit 1
fi

if [ "$USER2_TOKEN" == "null" ]; then
    error "Failed to get user 2 token"
    exit 1
fi

log "User 2 created - ID: $USER2_ID"
log "User 2 token obtained"

step "2. Creating test products"

# Set authorization headers with tokens
AUTH_HEADER_USER1="Authorization: Bearer $USER1_TOKEN"
AUTH_HEADER_USER2="Authorization: Bearer $USER2_TOKEN"

log "User 1 Auth Header: $AUTH_HEADER_USER1"

# Create multiple products
log "Creating product 1 - Laptop..."
PRODUCT1_RESPONSE=$(curl -s -X POST "$BASE_URL/products/create" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -d '{
    "name": "Laptop",
    "price": 99900,
    "description": "High-performance laptop"
  }')

echo "Product 1 response:"
echo "$PRODUCT1_RESPONSE" | jq '.'

PRODUCT1_ID=$(echo "$PRODUCT1_RESPONSE" | jq -r '.product.id // .id')
if [ "$PRODUCT1_ID" == "null" ]; then
    error "Failed to create product 1"
    exit 1
fi

log "Creating product 2 - Smartphone..."
PRODUCT2_RESPONSE=$(curl -s -X POST "$BASE_URL/products/create" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -d '{
    "name": "Smartphone",
    "price": 69900,
    "description": "Latest smartphone"
  }')
echo "Product 2 response:"
echo "$PRODUCT2_RESPONSE" | jq '.'
PRODUCT2_ID=$(echo "$PRODUCT2_RESPONSE" | jq -r '.product.id // .id')

log "Creating product 3 - Headphones..."
PRODUCT3_RESPONSE=$(curl -s -X POST "$BASE_URL/products/create" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -d '{
    "name": "Headphones",
    "price": 19900,
    "description": "Wireless headphones"
  }')
echo "Product 3 response:"
echo "$PRODUCT3_RESPONSE" | jq '.'
PRODUCT3_ID=$(echo "$PRODUCT3_RESPONSE" | jq -r '.product.id // .id')

log "Creating product 4 - Tablet..."
PRODUCT4_RESPONSE=$(curl -s -X POST "$BASE_URL/products/create" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -d '{
    "name": "Tablet",
    "price": 49900,
    "description": "10-inch tablet"
  }')
echo "Product 4 response:"
echo "$PRODUCT4_RESPONSE" | jq '.'
PRODUCT4_ID=$(echo "$PRODUCT4_RESPONSE" | jq -r '.product.id // .id')

log "Products created - IDs: $PRODUCT1_ID, $PRODUCT2_ID, $PRODUCT3_ID, $PRODUCT4_ID"

# Verify products were created
if [ "$PRODUCT1_ID" == "null" ] || [ "$PRODUCT2_ID" == "null" ]; then
    error "Some products failed to create"
    exit 1
fi

step "3. Testing Order Endpoints"

echo $AUTH_HEADER_USER1
# Test 1: Create an order with multiple products using token authentication
log "Test 1: Create order with multiple products"
CREATE_ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -d '{
    "user_address": "123 Main St, New York, NY 10001",
    "products": [
      {
        "product_id": '"$PRODUCT1_ID"',
        "quantity": 1
      },
      {
        "product_id": '"$PRODUCT2_ID"',
        "quantity": 2
      },
      {
        "product_id": '"$PRODUCT3_ID"',
        "quantity": 1
      }
    ]
  }')

echo "Create order response:"
echo "$CREATE_ORDER_RESPONSE" | jq '.'

ORDER_ID=$(echo "$CREATE_ORDER_RESPONSE" | jq -r '.data.order.id // .order.id // .id')
if [ "$ORDER_ID" == "null" ]; then
    error "Failed to create order"
    exit 1
fi

log "Order created with ID: $ORDER_ID"

# Test 2: Create another order for the same user
log "Test 2: Create another order for same user"
CREATE_ORDER2_RESPONSE=$(curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -d '{
    "user_address": "456 Oak Ave, Boston, MA 02101",
    "products": [
      {
        "product_id": '"$PRODUCT4_ID"',
        "quantity": 1
      },
      {
        "product_id": '"$PRODUCT3_ID"',
        "quantity": 3
      }
    ]
  }')

echo "Create order 2 response:"
echo "$CREATE_ORDER2_RESPONSE" | jq '.'
ORDER2_ID=$(echo "$CREATE_ORDER2_RESPONSE" | jq -r '.data.order.id // .order.id // .id')

# Test 3: Create order for second user
log "Test 3: Create order for second user"
CREATE_ORDER3_RESPONSE=$(curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER2" \
  -d '{
    "user_address": "789 Pine St, Chicago, IL 60601",
    "products": [
      {
        "product_id": '"$PRODUCT2_ID"',
        "quantity": 1
      }
    ]
  }')

echo "Create order 3 response:"
echo "$CREATE_ORDER3_RESPONSE" | jq '.'
ORDER3_ID=$(echo "$CREATE_ORDER3_RESPONSE" | jq -r '.data.order.id // .order.id // .id')

# Test 4: Get all orders
log "Test 4: Get all orders"
GET_ALL_ORDERS_RESPONSE=$(curl -s -X GET "$BASE_URL/orders" \
  -H "$AUTH_HEADER_USER1")
echo "All orders response:"
echo "$GET_ALL_ORDERS_RESPONSE" | jq '.'

# Test 5: Get specific order by ID
log "Test 5: Get order by ID"
GET_ORDER_RESPONSE=$(curl -s -X GET "$BASE_URL/orders/$ORDER_ID" \
  -H "$AUTH_HEADER_USER1")
echo "Get order by ID response:"
echo "$GET_ORDER_RESPONSE" | jq '.'

# Test 6: Get orders by user ID
log "Test 6: Get orders by user ID"
GET_USER_ORDERS_RESPONSE=$(curl -s -X GET "$BASE_URL/orders/user/$USER1_ID" \
  -H "$AUTH_HEADER_USER1")
echo "Get user orders response:"
echo "$GET_USER_ORDERS_RESPONSE" | jq '.'

# Test 7: Update order address
log "Test 7: Update order address"
UPDATE_ORDER_RESPONSE=$(curl -s -X PUT "$BASE_URL/orders/$ORDER_ID" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -d '{
    "user_address": "Updated Address: 999 New St, Los Angeles, CA 90210"
  }')

echo "Update order response:"
echo "$UPDATE_ORDER_RESPONSE" | jq '.'

# Test 8: Add product to existing order
log "Test 8: Add product to existing order"
ADD_PRODUCT_RESPONSE=$(curl -s -X POST "$BASE_URL/orders/$ORDER_ID/products" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -d '{
    "product_id": '"$PRODUCT4_ID"',
    "quantity": 2
  }')

echo "Add product response:"
echo "$ADD_PRODUCT_RESPONSE" | jq '.'

# Test 9: Remove product from order
log "Test 9: Remove product from order"
GET_ORDER_AFTER_ADD=$(curl -s -X GET "$BASE_URL/orders/$ORDER_ID" \
  -H "$AUTH_HEADER_USER1")
log "Order before removal:"
echo "$GET_ORDER_AFTER_ADD" | jq '.'

REMOVE_PRODUCT_RESPONSE=$(curl -s -X DELETE "$BASE_URL/orders/$ORDER_ID/products/$PRODUCT3_ID" \
  -H "$AUTH_HEADER_USER1")
log "Remove product response:"
echo "$REMOVE_PRODUCT_RESPONSE" | jq '.'

# Test 10: Get order after modifications
log "Test 10: Get order after modifications"
GET_UPDATED_ORDER_RESPONSE=$(curl -s -X GET "$BASE_URL/orders/$ORDER_ID" \
  -H "$AUTH_HEADER_USER1")
echo "Updated order response:"
echo "$GET_UPDATED_ORDER_RESPONSE" | jq '.'

step "4. Testing Error Cases"

# Test 11a: Create order without authentication
log "Test 11a: Create order without authentication"
curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "user_address": "123 Test St",
    "products": [{"product_id": 1}]
  }' | jq '.'

# Test 11b: Create order with invalid product
log "Test 11b: Create order with invalid product"
curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -d '{
    "user_address": "123 Test St",
    "products": [{"product_id": 99999}]
  }' | jq '.'

# Test 11c: Create order with empty products
log "Test 11c: Create order with empty products"
curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -d '{
    "user_address": "123 Test St",
    "products": []
  }' | jq '.'

# Test 11d: Get non-existent order
log "Test 11d: Get non-existent order"
curl -s -X GET "$BASE_URL/orders/99999" \
  -H "$AUTH_HEADER_USER1" | jq '.'

# Test 11e: Update non-existent order
log "Test 11e: Update non-existent order"
curl -s -X PUT "$BASE_URL/orders/99999" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER_USER1" \
  -d '{"user_address": "Test"}' | jq '.'

step "5. Cleanup Tests"

# Test 12: Delete an order
log "Test 12: Delete an order"
DELETE_ORDER_RESPONSE=$(curl -s -X DELETE "$BASE_URL/orders/$ORDER2_ID" \
  -H "$AUTH_HEADER_USER1")
echo "Delete order response:"
echo "$DELETE_ORDER_RESPONSE" | jq '.'

# Verify deletion by trying to get the deleted order
log "Verify deletion:"
curl -s -X GET "$BASE_URL/orders/$ORDER2_ID" \
  -H "$AUTH_HEADER_USER1" | jq '.'

step "6. Final State Check"

# Get all orders to see final state
log "Test 13: Final state check"
FINAL_ORDERS_RESPONSE=$(curl -s -X GET "$BASE_URL/orders" \
  -H "$AUTH_HEADER_USER1")
echo "Final orders count:"
echo "$FINAL_ORDERS_RESPONSE" | jq '.orders | length'

# Get all products to verify they exist
log "Getting all products to verify..."
GET_PRODUCTS_RESPONSE=$(curl -s -X GET "$BASE_URL/products/get-products" \
  -H "$AUTH_HEADER_USER1")
echo "Products count:"
echo "$GET_PRODUCTS_RESPONSE" | jq '.products | length // . | length'

# Test user profile endpoint with token
log "Testing user profile endpoint with token..."
USER_PROFILE_RESPONSE=$(curl -s -X GET "$BASE_URL/auth/profile" \
  -H "$AUTH_HEADER_USER1")
echo "User profile response:"
echo "$USER_PROFILE_RESPONSE" | jq '.'

echo
echo -e "${GREEN}=== Test Summary ===${NC}"
echo "Users created: $USER1_ID ($USER1_EMAIL), $USER2_ID ($USER2_EMAIL)"
echo "User 1 Token: ${USER1_TOKEN:0:20}..."
echo "User 2 Token: ${USER2_TOKEN:0:20}..."
echo "Products created: $PRODUCT1_ID, $PRODUCT2_ID, $PRODUCT3_ID, $PRODUCT4_ID"
echo "Orders created and tested: $ORDER_ID, $ORDER2_ID, $ORDER3_ID"
echo "Order $ORDER2_ID was deleted during testing"
echo
echo -e "${GREEN}=== All tests completed successfully! ===${NC}"