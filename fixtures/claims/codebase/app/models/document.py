"""ClaimDocument: supporting evidence requested from the claimant.

This entity has no status column. Its lifecycle is derived from three
nullable timestamps, mirroring the way the upload pipeline writes them:

* requested  -> the row exists with only ``requested_at`` set,
* uploaded   -> ``uploaded_at`` is filled when the file lands in storage,
* verified   -> ``verified_at`` is filled once an adjuster accepts it,
* rejected   -> ``rejected_at`` is filled if it is unreadable / wrong.

A document is never both verified and rejected.
"""

from datetime import datetime

from app.extensions import db


class ClaimDocument(db.Model):
    __tablename__ = "claim_documents"

    id = db.Column(db.Integer, primary_key=True)
    claim_id = db.Column(db.Integer, db.ForeignKey("claims.id"), nullable=False)

    kind = db.Column(db.String(64), nullable=False)
    storage_key = db.Column(db.String(255), nullable=True)
    content_type = db.Column(db.String(128), nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)

    requested_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    uploaded_at = db.Column(db.DateTime, nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)
    rejected_at = db.Column(db.DateTime, nullable=True)

    claim = db.relationship("Claim", back_populates="documents")

    @property
    def is_requested(self):
        """Outstanding: asked for, nothing uploaded yet."""
        return self.uploaded_at is None and self.rejected_at is None

    @property
    def is_uploaded(self):
        """A file is present but no adjuster has ruled on it."""
        return (
            self.uploaded_at is not None
            and self.verified_at is None
            and self.rejected_at is None
        )

    @property
    def is_verified(self):
        return self.verified_at is not None

    @property
    def is_rejected(self):
        return self.rejected_at is not None

    @property
    def is_pending_review(self):
        """Something an adjuster could still act on."""
        return self.is_uploaded

    def __repr__(self):
        return f"<ClaimDocument {self.id} claim={self.claim_id}>"
