"""ClaimFlow configuration.

Values come from the environment in deployed environments; the defaults here
are for local development only.
"""

import os

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-not-a-secret")

# Infrastructure
SQLALCHEMY_DATABASE_URI = os.environ.get(
    "DATABASE_URL", "postgresql://claimflow:claimflow@localhost:5432/claimflow"
)
SQLALCHEMY_TRACK_MODIFICATIONS = False
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Document storage (S3)
DOCUMENT_BUCKET = os.environ.get("DOCUMENT_BUCKET", "claimflow-documents")
AWS_REGION = os.environ.get("AWS_REGION", "eu-west-1")
DOCUMENT_URL_TTL_SECONDS = 900

# Email (SendGrid)
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
SENDGRID_FROM_ADDRESS = "noreply@claimflow.example.com"

# Fraud scoring API
FRAUD_API_KEY = os.environ.get("FRAUD_API_KEY", "")
FRAUD_API_BASE_URL = os.environ.get(
    "FRAUD_API_BASE_URL", "https://fraud.example.com/v1"
)

# Status-lookup tokens
STATUS_CACHE_TTL_SECONDS = 120
STATUS_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 3600

# Webhook credentials
POLICY_WEBHOOK_API_KEY = os.environ.get("POLICY_WEBHOOK_API_KEY", "")
CRM_WEBHOOK_API_KEY = os.environ.get("CRM_WEBHOOK_API_KEY", "")
FRAUD_WEBHOOK_API_KEY = os.environ.get("FRAUD_WEBHOOK_API_KEY", "")
PAYMENT_WEBHOOK_API_KEY = os.environ.get("PAYMENT_WEBHOOK_API_KEY", "")

# Business rules
SLA_DAYS = 14
MAX_PAYMENT_RETRIES = 3
APPEAL_WINDOW_DAYS = 30
AUTO_APPROVE_THRESHOLD = 2500

# Feature flags
COINSURANCE_LEDGER_ENABLED = False

# Coinsurance reconciliation (only used when the ledger is enabled)
COINSURANCE_PARTNER_URL = os.environ.get("COINSURANCE_PARTNER_URL", "")
COINSURANCE_PARTNER_KEY = os.environ.get("COINSURANCE_PARTNER_KEY", "")
