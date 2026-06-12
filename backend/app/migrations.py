from sqlalchemy import text, inspect
from app.database import engine


def run_migrations():
    """Idempotentne migracje SQL — działa na SQLite i PostgreSQL."""
    inspector = inspect(engine)

    if inspector.has_table("orders"):
        cols = {col["name"] for col in inspector.get_columns("orders")}
        with engine.connect() as conn:
            if "phone" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN phone TEXT"))
                conn.commit()
            if "pickup_date" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN pickup_date TEXT"))
                conn.commit()

    if inspector.has_table("settings"):
        cols = {col["name"] for col in inspector.get_columns("settings")}
        with engine.connect() as conn:
            if "website" not in cols:
                conn.execute(text("ALTER TABLE settings ADD COLUMN website TEXT DEFAULT ''"))
                conn.commit()

    if inspector.has_table("additional_materials"):
        with engine.connect() as conn:
            conn.execute(text(
                "UPDATE additional_materials SET category = 'front' WHERE category = 'glass'"
            ))
            conn.commit()

    if inspector.has_table("users"):
        cols = {col["name"] for col in inspector.get_columns("users")}
        with engine.connect() as conn:
            if "subscription_plan" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN subscription_plan TEXT"))
                conn.commit()
            if "subscription_expires" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN subscription_expires TIMESTAMP"))
                conn.commit()

    if inspector.has_table("mouldings"):
        cols = {col["name"] for col in inspector.get_columns("mouldings")}
        with engine.connect() as conn:
            if "discontinued" not in cols:
                # DEFAULT FALSE działa na SQLite i PostgreSQL
                conn.execute(text(
                    "ALTER TABLE mouldings ADD COLUMN discontinued BOOLEAN NOT NULL DEFAULT FALSE"
                ))
                conn.commit()
