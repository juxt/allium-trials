"""Shared pytest fixtures.

Spins up the app against an in-memory database and provides factory helpers
that build claimants, policies, adjusters and claims in known states so the
behaviour tests can start from a precise point in each lifecycle.
"""

from datetime import datetime, timedelta

import pytest

from app import create_app
from app.extensions import db
from app.models.adjuster import Adjuster
from app.models.claim import Claim
from app.models.claimant import Claimant
from app.models.document import ClaimDocument
from app.models.fraud import FraudCheck
from app.models.payment import Payment
from app.models.policy import Policy


@pytest.fixture
def app():
    application = create_app()
    application.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI="sqlite+pysqlite:///:memory:",
    )
    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture
def session(app):
    return db.session


@pytest.fixture
def claimant(session):
    record = Claimant(
        crm_id="crm-test",
        full_name="Test Claimant",
        email="claimant@example.com",
    )
    session.add(record)
    session.commit()
    return record


@pytest.fixture
def policy(session, claimant):
    record = Policy(
        policy_number="POL-TEST-1",
        policyholder_id=claimant.id,
        product="home",
        covered_perils=["fire", "flood", "theft"],
        coverage_limit=50000,
        deductible=250,
        effective_from=datetime.utcnow() - timedelta(days=100),
        effective_to=datetime.utcnow() + timedelta(days=100),
    )
    session.add(record)
    session.commit()
    return record


@pytest.fixture
def adjuster(session):
    record = Adjuster(
        email="adjuster@example.com",
        full_name="Test Adjuster",
        is_available=True,
        max_open_claims=10,
    )
    session.add(record)
    session.commit()
    return record


def make_claim(session, claimant, policy, *, status="submitted", amount=1000):
    claim = Claim(
        claimant_id=claimant.id,
        policy_id=policy.id,
        peril="fire",
        amount_claimed=amount,
        incident_date=datetime.utcnow() - timedelta(days=1),
        status=status,
    )
    session.add(claim)
    session.commit()
    return claim


def add_clear_fraud_check(session, claim):
    check = FraudCheck(claim_id=claim.id, status="clear", resolved_at=datetime.utcnow())
    session.add(check)
    session.commit()
    return check


def add_verified_document(session, claim, kind="proof"):
    doc = ClaimDocument(
        claim_id=claim.id,
        kind=kind,
        uploaded_at=datetime.utcnow(),
        verified_at=datetime.utcnow(),
    )
    session.add(doc)
    session.commit()
    return doc


def add_payment(session, claim, *, status="pending", amount=750, retry_count=0):
    payment = Payment(
        claim_id=claim.id,
        amount=amount,
        status=status,
        retry_count=retry_count,
    )
    session.add(payment)
    session.commit()
    return payment


@pytest.fixture
def claim_factory(session, claimant, policy):
    def factory(**kwargs):
        return make_claim(session, claimant, policy, **kwargs)

    return factory
