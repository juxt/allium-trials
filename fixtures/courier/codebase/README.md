# SwiftShip

SwiftShip is the backend for our courier and parcel-delivery operation. It exposes a
public tracking API, the driver mobile-app API, back-office endpoints for depot and
ops staff, and inbound webhooks for the customs broker and the CRM.

Runs on Flask + SQLAlchemy against PostgreSQL, with Redis for caching and Celery for
scheduled housekeeping jobs. Start locally with `flask --app "app:create_app()" run`.
