"""SwiftShip application factory."""

from flask import Flask

import config
from app.extensions import db


def create_app():
    app = Flask(__name__)
    app.config.from_object(config)

    db.init_app(app)

    from app import jobs  # noqa: F401  register celery tasks and beat schedule
    from app import models  # noqa: F401  register tables with the metadata
    from app.api import admin, driver, tracking, webhooks

    app.register_blueprint(tracking.bp)
    app.register_blueprint(driver.bp)
    app.register_blueprint(admin.bp)
    app.register_blueprint(webhooks.bp)

    return app
