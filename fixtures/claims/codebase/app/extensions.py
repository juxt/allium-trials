"""Shared application extensions, initialised by the app factory."""

import redis
from celery import Celery
from flask_sqlalchemy import SQLAlchemy

import config

db = SQLAlchemy()

celery = Celery("claimflow", broker=config.REDIS_URL, backend=config.REDIS_URL)
celery.conf.timezone = "UTC"

redis_client = redis.Redis.from_url(config.REDIS_URL, decode_responses=True)
