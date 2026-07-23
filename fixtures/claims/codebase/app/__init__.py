"""ClaimFlow application factory."""

from flask import Flask

import config
from app.extensions import db


def create_app():
    app = Flask(__name__)
    app.config.from_object(config)

    db.init_app(app)

    from app import jobs  # noqa: F401  register celery tasks and beat schedule
    from app import models  # noqa: F401  register tables with the metadata
    from app.api import adjuster, internal, manager, portal, status, webhooks
    from app.cli import register_cli
    from app.errors import register_error_handlers

    register_error_handlers(app)
    register_cli(app)

    app.register_blueprint(status.bp)
    app.register_blueprint(portal.bp)
    app.register_blueprint(adjuster.bp)
    app.register_blueprint(manager.bp)
    app.register_blueprint(internal.bp)
    app.register_blueprint(webhooks.bp)

    return app
