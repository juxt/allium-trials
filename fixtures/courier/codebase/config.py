"""SwiftShip configuration.

Values come from the environment in deployed environments; the defaults here
are for local development only.
"""

import os

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-not-a-secret")

# Infrastructure
SQLALCHEMY_DATABASE_URI = os.environ.get(
    "DATABASE_URL", "postgresql://swiftship:swiftship@localhost:5432/swiftship"
)
SQLALCHEMY_TRACK_MODIFICATIONS = False
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
SENDGRID_FROM_ADDRESS = "noreply@swiftship.example.com"
TRACKING_CACHE_TTL_SECONDS = 120
AUTH_TOKEN_MAX_AGE_SECONDS = 12 * 3600

# Webhook credentials
CUSTOMS_WEBHOOK_API_KEY = os.environ.get("CUSTOMS_WEBHOOK_API_KEY", "")
CRM_WEBHOOK_API_KEY = os.environ.get("CRM_WEBHOOK_API_KEY", "")

# Business rules
MAX_DELIVERY_ATTEMPTS = 3
PICKUP_EXPIRY_HOURS = 48

# Feature flags
SMS_NOTIFICATIONS_ENABLED = False

# Twilio (only used when SMS notifications are enabled)
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = "+15550100"
