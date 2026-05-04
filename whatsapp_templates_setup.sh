#!/bin/bash

# ==============================================================================
# CARTEL COFFEE - META WHATSAPP BUSINESS API (v18.0)
# MESSAGE TEMPLATE SUBMISSION SCRIPT
# ==============================================================================
# 
# Usage:
#   1. Replace YOUR_BUSINESS_ACCOUNT_ID with your actual WABA ID
#   2. Replace YOUR_ACCESS_TOKEN with your System User Access Token
#   3. Run this script in your terminal
# 
# Note: Facebook requires example values for templates that use variables ({{1}}, {{2}}).
#       These have been included in the 'example' blocks.

WABA_ID="YOUR_BUSINESS_ACCOUNT_ID"
ACCESS_TOKEN="YOUR_ACCESS_TOKEN"

echo "Submitting: cartel_table_ready"
curl -X POST "https://graph.facebook.com/v18.0/${WABA_ID}/message_templates" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cartel_table_ready",
    "language": "en",
    "category": "UTILITY",
    "components": [
      {
        "type": "BODY",
        "text": "Hello {{1}}, we'\''re ready to host you at Cartel Coffee. 🖤 We'\''ve reserved *{{2}}* for your party of *{{3}}*. Please check in with our hostess to be seated. ⏱️ *Kindly note*: We hold reservations for *10 minutes*. If you'\''re unable to arrive within this time, we'\''re going to need to release the table to our waiting guests. We look forward to seeing you. Cartel Coffee Roasters | The Art of Specialty.",
        "example": {
          "body_text": [
            [
              "Jane",
              "BENCH 4",
              "2"
            ]
          ]
        }
      }
    ]
  }'

echo -e "\n\nSubmitting: cartel_gentle_reminder"
curl -X POST "https://graph.facebook.com/v18.0/${WABA_ID}/message_templates" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cartel_gentle_reminder",
    "language": "en",
    "category": "UTILITY",
    "components": [
      {
        "type": "BODY",
        "text": "Hi {{1}}, gentle reminder — your table *{{2}}* is waiting for you. ⏳ Please check in within the next *2 minutes* to secure your reservation. Cartel Coffee Roasters ☕",
        "example": {
          "body_text": [
            [
              "Jane",
              "BENCH 4"
            ]
          ]
        }
      }
    ]
  }'

echo -e "\n\nSubmitting: cartel_table_released"
curl -X POST "https://graph.facebook.com/v18.0/${WABA_ID}/message_templates" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cartel_table_released",
    "language": "en",
    "category": "UTILITY",
    "components": [
      {
        "type": "BODY",
        "text": "Hi {{1}}, we sincerely apologize — we'\''ve had to release your table *{{2}}* due to the 10-minute grace period expiring. 😔 You'\''re welcome to rejoin our waitlist, and we'\''ll seat you as soon as possible. Cartel Coffee Roasters | The Art of Specialty.",
        "example": {
          "body_text": [
            [
              "Jane",
              "BENCH 4"
            ]
          ]
        }
      }
    ]
  }'

echo -e "\n\nTemplate Submission Complete! Check the Meta developer dashboard for approval status."
