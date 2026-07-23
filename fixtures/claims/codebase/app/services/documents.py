"""Claim document lifecycle: request, upload, verify, reject.

The document entity carries no status column; its state is the pattern of
nullable timestamps written here (requested_at / uploaded_at / verified_at /
rejected_at).
"""

from datetime import datetime

from app.extensions import db
from app.models.document import ClaimDocument
from app.services import cache, email, storage


class DocumentError(Exception):
    """Raised when a document action is not allowed in its current state."""


def request_document(claim, kind):
    """Ask the claimant for a document: creates a 'requested' row."""
    doc = ClaimDocument(claim_id=claim.id, kind=kind)
    db.session.add(doc)
    db.session.commit()

    email.send_templated_email(
        claim.claimant.email,
        email.TEMPLATE_DOCUMENTS_REQUESTED,
        {"reference": claim.reference, "document_kind": kind},
    )
    return doc


def record_upload(document, file_stream, content_type):
    """Store an uploaded file and mark the document 'uploaded'.

    Valid only while the document is still outstanding (requested).
    """
    if not document.is_requested:
        raise DocumentError("document is not awaiting an upload")

    object_key = storage.new_object_key(document.claim.reference, document.kind)
    storage.store_upload(object_key, file_stream, content_type)

    document.storage_key = object_key
    document.content_type = content_type
    document.uploaded_at = datetime.utcnow()
    db.session.commit()

    cache.invalidate_status(document.claim.reference)
    return document


def verify_document(document):
    """Adjuster accepts an uploaded document: uploaded -> verified."""
    if not document.is_uploaded:
        raise DocumentError("only uploaded documents can be verified")
    document.verified_at = datetime.utcnow()
    db.session.commit()
    return document


def reject_document(document, reason):
    """Adjuster rejects an uploaded document: uploaded -> rejected."""
    if not document.is_uploaded:
        raise DocumentError("only uploaded documents can be rejected")
    document.rejected_at = datetime.utcnow()
    document.rejection_reason = reason
    db.session.commit()
    return document
