# ClaimFlow

ClaimFlow is the back-office service that takes an insurance claim from
intake through to a cleared settlement payment. It is a Flask + SQLAlchemy
application backed by PostgreSQL, with Celery for scheduled work and Redis
for caching the public status page.

## What it does

A claimant files a claim against one of their policies. The system triages
it automatically (opening a fraud-scoring request), a manager assigns it to
an adjuster, and the adjuster gathers and verifies supporting documents.
Once the fraud check is clear, every requested document is verified, and the
loss is within the policy's coverage, the adjuster can approve the claim;
otherwise it is denied (and may be appealed) or escalated to senior review.
Approved claims are settled by issuing a payment, which the payment
processor confirms as cleared.

## Surfaces

| Surface | Audience | Auth |
| --- | --- | --- |
| `/status/<token>` | anyone with the signed link | lookup token |
| `/portal` | claimants | bearer token, role `claimant` |
| `/adjuster` | adjusters | bearer token, role `adjuster` |
| `/manager`, `/internal` | operations managers | bearer token, role `manager` |
| `/webhooks` | policy-admin, CRM, fraud-scoring, payment processor | `X-Api-Key` |

Policies and claimants are mastered in external systems (policy-admin and
the CRM respectively) and replicated to ClaimFlow over webhooks; the service
never originates them.

## Scheduled work

Celery beat runs four housekeeping jobs: SLA-breach escalation, stale
document reminders, the payment-retry sweep, and appeal-window closure
notices. Each is safe to run repeatedly.

## Layout

```
config.py            configuration and business constants
wsgi.py              WSGI entry point
app/__init__.py      application factory
app/auth.py          bearer-token roles and webhook API keys
app/jobs.py          scheduled Celery tasks
app/models/          SQLAlchemy models
app/services/        domain workflows and infrastructure adapters
app/api/             HTTP surfaces grouped by audience
```

## Local development

```
flask init-db      # create the schema
flask seed-demo    # load a couple of demo claimants, policies and adjusters
flask run
```
