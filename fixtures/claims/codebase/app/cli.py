"""Developer CLI commands, registered on the Flask app.

These are local conveniences for creating the schema and loading a small set
of demo records so the surfaces can be exercised by hand. None of it runs in
production; it exists purely to bootstrap a developer database.
"""

from datetime import datetime, timedelta

import click
from flask.cli import with_appcontext

from app.extensions import db
from app.models.adjuster import Adjuster
from app.models.claimant import Claimant
from app.models.policy import Policy


def register_cli(app):
    app.cli.add_command(init_db)
    app.cli.add_command(seed_demo)


@click.command("init-db")
@with_appcontext
def init_db():
    """Create all tables from the model metadata."""
    db.create_all()
    click.echo("schema created")


@click.command("seed-demo")
@with_appcontext
def seed_demo():
    """Insert a couple of demo claimants, policies and adjusters."""
    alice = Claimant(
        crm_id="crm-alice",
        full_name="Alice Stone",
        email="alice@example.com",
        phone="+447700900001",
    )
    bob = Claimant(
        crm_id="crm-bob",
        full_name="Bob Reyes",
        email="bob@example.com",
        phone="+447700900002",
    )
    db.session.add_all([alice, bob])
    db.session.flush()

    home = Policy(
        policy_number="POL-HOME-001",
        policyholder_id=alice.id,
        product="home",
        covered_perils=["fire", "flood", "theft"],
        coverage_limit=50000,
        deductible=250,
        effective_from=datetime.utcnow() - timedelta(days=365),
        effective_to=datetime.utcnow() + timedelta(days=365),
    )
    motor = Policy(
        policy_number="POL-MOTOR-001",
        policyholder_id=bob.id,
        product="motor",
        covered_perils=["collision", "theft"],
        coverage_limit=15000,
        deductible=500,
        effective_from=datetime.utcnow() - timedelta(days=200),
    )
    db.session.add_all([home, motor])

    db.session.add_all(
        [
            Adjuster(
                email="dana@claimflow.example.com",
                full_name="Dana Okafor",
                specialties="property",
            ),
            Adjuster(
                email="evan@claimflow.example.com",
                full_name="Evan Liu",
                specialties="motor",
            ),
        ]
    )
    db.session.commit()
    click.echo("demo data loaded")
