"""Document storage backed by S3.

Claim documents are uploaded straight to a private bucket; we keep only the
object key on the row and hand out short-lived presigned URLs when an
adjuster or claimant needs to see the file.
"""

import logging
import secrets

import boto3

import config

logger = logging.getLogger(__name__)

_s3 = None


def _client():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3", region_name=config.AWS_REGION)
    return _s3


def new_object_key(claim_reference, kind):
    """Make a unique, unguessable object key for an upload."""
    suffix = secrets.token_urlsafe(16)
    return f"claims/{claim_reference}/{kind}/{suffix}"


def store_upload(object_key, file_stream, content_type):
    _client().upload_fileobj(
        file_stream,
        config.DOCUMENT_BUCKET,
        object_key,
        ExtraArgs={"ContentType": content_type},
    )


def presigned_url(object_key):
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": config.DOCUMENT_BUCKET, "Key": object_key},
        ExpiresIn=config.DOCUMENT_URL_TTL_SECONDS,
    )
