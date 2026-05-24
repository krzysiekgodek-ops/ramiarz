"""
Skrypt jednorazowy — nadaje rolę administratora podanemu emailowi.
Pobiera firebase_uid bezpośrednio z Firebase Admin SDK (nie wymaga wcześniejszego logowania).

Uruchom z folderu backend/:
    cd D:\DEV\APLIKACJE\ramiarz-master\backend
    venv\Scripts\activate
    python set_admin.py
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

# ── Inicjalizacja Firebase Admin ─────────────────────────────────────────────
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

_APP_DIR    = os.path.dirname(os.path.abspath(__file__))
cred_path   = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "./firebase_service_account.json")
if not os.path.isabs(cred_path):
    cred_path = os.path.normpath(os.path.join(_APP_DIR, cred_path.lstrip("./")))

if not os.path.exists(cred_path):
    # fallback: secret/
    secret_dir = os.path.join(os.path.dirname(_APP_DIR), "secret")
    jsons = [os.path.join(secret_dir, f) for f in os.listdir(secret_dir) if f.endswith(".json")] if os.path.isdir(secret_dir) else []
    if jsons:
        cred_path = jsons[0]

print(f"Firebase service account: {cred_path}")

try:
    firebase_admin.initialize_app(credentials.Certificate(cred_path))
except ValueError:
    pass  # już zainicjalizowany

# ── Baza danych ───────────────────────────────────────────────────────────────
from app.database import SessionLocal, engine
from app.models.models import Base, User

Base.metadata.create_all(bind=engine)
db = SessionLocal()

ADMIN_EMAIL = "krzysiekgodek@gmail.com"

try:
    # Pobierz użytkownika z Firebase po emailu
    try:
        fb_user = firebase_auth.get_user_by_email(ADMIN_EMAIL)
        firebase_uid = fb_user.uid
        print(f"Firebase UID: {firebase_uid}")
    except firebase_auth.UserNotFoundError:
        print(f"\n❌  Email '{ADMIN_EMAIL}' nie istnieje w Firebase.")
        print("    Sprawdź czy konto zostało założone w Firebase Console.\n")
        sys.exit(1)

    # Znajdź lub utwórz rekord w lokalnej bazie
    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if not user:
        user = db.query(User).filter(User.email == ADMIN_EMAIL).first()

    if user:
        user.is_superadmin = True
        user.is_paid = True
        print(f"Zaktualizowano istniejący rekord.")
    else:
        user = User(
            firebase_uid=firebase_uid,
            email=ADMIN_EMAIL,
            is_superadmin=True,
            is_paid=True,
        )
        db.add(user)
        print(f"Utworzono nowy rekord admina.")

    db.commit()
    print(f"\n✅  '{ADMIN_EMAIL}' jest teraz administratorem. Możesz się zalogować.\n")

finally:
    db.close()
