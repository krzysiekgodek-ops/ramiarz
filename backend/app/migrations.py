from sqlalchemy import text
from app.database import engine


def run_migrations():
    """Idempotentne migracje SQL dla istniejących baz (bez Alembic)."""
    with engine.connect() as conn:
        cols = [row[1] for row in conn.execute(text("PRAGMA table_info(orders)"))]
        if "phone" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN phone TEXT"))
            conn.commit()

        if "pickup_date" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN pickup_date TEXT"))
            conn.commit()

        conn.execute(text(
            "UPDATE additional_materials SET category = 'front' WHERE category = 'glass'"
        ))
        conn.commit()
