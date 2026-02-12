#!/bin/bash

# Test matching case (should return 204 No Content)
echo "Testing matching case..."
curl -i -k -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "The user is over 18 years old",
    "payload": {
      "name": "John Doe",
      "age": 25
    }
  }'
echo -e "\n"

# Test non-matching case (should return explanation)
echo "Testing non-matching case..."
curl -i -k -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "The user is over 18 years old",
    "payload": {
      "name": "Jane Doe",
      "age": 15
    }
  }'
echo -e "\n"
