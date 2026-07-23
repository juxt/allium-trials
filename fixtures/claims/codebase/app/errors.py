"""Shared error-to-response translation.

Each surface registers these so a raised domain or validation error becomes a
consistent JSON body instead of a bare Flask error page.
"""

from flask import jsonify

from app.validation import ValidationError


def register_error_handlers(app):
    @app.errorhandler(ValidationError)
    def _on_validation_error(exc):
        return jsonify({"error": "validation_failed", "fields": exc.errors}), 422

    @app.errorhandler(404)
    def _on_not_found(_exc):
        return jsonify({"error": "not_found"}), 404

    @app.errorhandler(401)
    def _on_unauthorized(_exc):
        return jsonify({"error": "unauthorized"}), 401

    @app.errorhandler(403)
    def _on_forbidden(_exc):
        return jsonify({"error": "forbidden"}), 403

    @app.errorhandler(409)
    def _on_conflict(_exc):
        return jsonify({"error": "conflict"}), 409
