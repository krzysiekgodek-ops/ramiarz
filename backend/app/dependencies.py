import os
import logging

# Naprawia SSL na Windowsie — certyfikat Google nie przechodzi przez systemowy store
# (odpowiednik npm strict-ssl false). Patch na HTTPAdapter.send — właściwy poziom.
import urllib3 as _urllib3
from requests.adapters import HTTPAdapter as _HTTPAdapter
_urllib3.disable_warnings(_urllib3.exceptions.InsecureRequestWarning)

_orig_adapter_send = _HTTPAdapter.send
def _ssl_patched_adapter_send(self, request,
                               stream=False, timeout=None,
                               verify=True, cert=None, proxies=None):
    return _orig_adapter_send(self, request,
                              stream=stream, timeout=timeout,
                              verify=False, cert=cert, proxies=proxies)
_HTTPAdapter.send = _ssl_patched_adapter_send

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User

logger = logging.getLogger(__name__)
security = HTTPBearer()
_firebase_initialized = False

# Bezwzględna ścieżka do katalogu pliku dependencies.py (app/)
_APP_DIR = os.path.dirname(os.path.abspath(__file__))
# backend/ = katalog nadrzędny
_BACKEND_DIR = os.path.dirname(_APP_DIR)

def init_firebase():
    global _firebase_initialized
    if _firebase_initialized:
        return
    try:
        # Ścieżka z .env lub domyślnie relative do katalogu backend/
        raw_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "./firebase_service_account.json")

        # Jeśli ścieżka relative — rozwiązuj względem backend/
        if not os.path.isabs(raw_path):
            cred_path = os.path.normpath(os.path.join(_BACKEND_DIR, raw_path.lstrip("./")))
        else:
            cred_path = raw_path

        # Fallback: sprawdź też w katalogu secret/ (dla pliku z Firebase Console)
        if not os.path.exists(cred_path):
            project_dir = os.path.dirname(_BACKEND_DIR)
            secret_files = []
            secret_dir = os.path.join(project_dir, "secret")
            if os.path.isdir(secret_dir):
                secret_files = [
                    os.path.join(secret_dir, f)
                    for f in os.listdir(secret_dir)
                    if f.endswith(".json")
                ]
            if secret_files:
                cred_path = secret_files[0]
                logger.warning(f"Używam service account z katalogu secret/: {cred_path}")

        logger.info(f"Inicjalizacja Firebase z: {cred_path}")
        print(f">>> Firebase service account path: {cred_path}")
        print(f">>> Plik istnieje: {os.path.exists(cred_path)}")

        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        _firebase_initialized = True
        logger.info("Firebase Admin SDK zainicjalizowany pomyślnie")
        print(">>> Firebase zainicjalizowany OK")

    except ValueError as e:
        if "already exists" in str(e):
            _firebase_initialized = True
            logger.info("Firebase już zainicjalizowany")
        else:
            logger.error(f"Błąd inicjalizacji Firebase: {e}")
            print(f">>> BŁĄD inicjalizacji Firebase: {e}")
            raise


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    print(">>> get_current_user wywołany")
    print(f">>> Token prefix: {creds.credentials[:30] if creds else 'BRAK'}")
    init_firebase()
    token = creds.credentials
    try:
        # check_revoked=False: pomija weryfikację odwołania tokenu przez sieć
        # (eliminuje błędy przy braku dostępu do googleapis.com)
        decoded = firebase_auth.verify_id_token(token, check_revoked=False)
        print(f">>> Token OK, UID: {decoded.get('uid')}, email: {decoded.get('email')}")
        logger.info(f"Token zweryfikowany dla UID: {decoded.get('uid')}")
    except firebase_auth.ExpiredIdTokenError:
        print(">>> BŁĄD: Token wygasł")
        raise HTTPException(status_code=401, detail="Token wygasł — zaloguj się ponownie")
    except firebase_auth.InvalidIdTokenError as e:
        print(f">>> BŁĄD: Nieprawidłowy token: {e}")
        raise HTTPException(status_code=401, detail=f"Nieprawidłowy token Firebase: {str(e)[:100]}")
    except Exception as e:
        err_type = type(e).__name__
        err_msg  = str(e)
        print(f">>> BŁĄD FIREBASE: {err_type}: {err_msg}")
        logger.error(f"Błąd weryfikacji tokenu: {err_type}: {err_msg}")
        if "CertificateFetchError" in err_type or "googleapis.com" in err_msg:
            raise HTTPException(
                status_code=503,
                detail="Backend nie może połączyć się z serwerami Google (SSL/sieć). Spróbuj ponownie."
            )
        raise HTTPException(status_code=401, detail=f"Błąd autoryzacji: {err_type}: {err_msg[:100]}")

    firebase_uid = decoded["uid"]
    email = decoded.get("email", "")

    # Lista emaili które automatycznie dostają rolę admina (z .env)
    initial_admins = [
        e.strip().lower()
        for e in os.getenv("INITIAL_ADMINS", "krzysiekgodek@gmail.com").split(",")
        if e.strip()
    ]

    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if not user:
        is_admin = email.lower() in initial_admins
        user = User(
            firebase_uid=firebase_uid,
            email=email,
            is_superadmin=is_admin,
            is_paid=is_admin,    # admin ma zawsze aktywny dostęp
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"Nowy użytkownik utworzony: {email}")
        if is_admin:
            print(f">>> Nowy użytkownik ADMIN: {email}")
        else:
            print(f">>> Nowy użytkownik w bazie: {email}")
    else:
        # Jeśli konto już istnieje ale jeszcze nie ma roli admina — nadaj
        if email.lower() in initial_admins and not user.is_superadmin:
            user.is_superadmin = True
            user.is_paid = True
            db.commit()
            db.refresh(user)
            print(f">>> Użytkownik '{email}' — nadano rolę admina (INITIAL_ADMINS)")
    return user


async def get_active_user(user: User = Depends(get_current_user)) -> User:
    from datetime import datetime, timezone
    if user.is_superadmin or user.is_paid:
        return user
    if user.trial_expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=402, detail="Trial wygasł — wymagana subskrypcja")
    return user


async def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_superadmin:
        raise HTTPException(status_code=403, detail="Brak uprawnień administratora")
    return user
