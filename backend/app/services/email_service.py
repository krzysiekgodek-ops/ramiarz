"""
Wysyłka maili przez Gmail API (Google Workspace) z kontem serwisowym
i delegacją domenową (impersonacja GMAIL_SENDER, np. biuro@antyramy.eu).

Świadomie używamy `requests` zamiast google-api-python-client/httplib2 — dzięki
temu transport jest objęty patchem SSL z app/dependencies.py (verify=False na
Windowsie). W produkcji (Linux/mydevil.net) działa standardowo.

Konfiguracja (zmienne środowiskowe):
  GMAIL_SENDER                  – adres nadawcy w domenie Workspace (wymagany)
  GMAIL_SERVICE_ACCOUNT_PATH    – ścieżka do JSON konta serwisowego
                                  (opcjonalnie; domyślnie FIREBASE_SERVICE_ACCOUNT_PATH)

W panelu admina Google Workspace należy nadać client_id konta serwisowego
delegację domenową z zakresem: https://www.googleapis.com/auth/gmail.send
"""
import os
import base64
import logging
from typing import Optional
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"

_APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # app/
_BACKEND_DIR = os.path.dirname(_APP_DIR)                               # backend/


def _resolve_sa_path() -> Optional[str]:
    raw = os.getenv("GMAIL_SERVICE_ACCOUNT_PATH") or os.getenv(
        "FIREBASE_SERVICE_ACCOUNT_PATH", "./firebase_service_account.json"
    )
    path = raw if os.path.isabs(raw) else os.path.normpath(
        os.path.join(_BACKEND_DIR, raw.lstrip("./"))
    )
    if os.path.exists(path):
        return path
    # Fallback: katalog secret/
    secret_dir = os.path.join(os.path.dirname(_BACKEND_DIR), "secret")
    if os.path.isdir(secret_dir):
        for f in os.listdir(secret_dir):
            if f.endswith(".json"):
                return os.path.join(secret_dir, f)
    return None


def is_configured() -> bool:
    """True gdy ustawiony jest nadawca i istnieje plik konta serwisowego."""
    return bool(os.getenv("GMAIL_SENDER")) and _resolve_sa_path() is not None


def _build_credentials():
    from google.oauth2 import service_account
    sender = os.getenv("GMAIL_SENDER")
    sa_path = _resolve_sa_path()
    if not sender or not sa_path:
        raise RuntimeError("Brak konfiguracji Gmail (GMAIL_SENDER / konto serwisowe).")
    creds = service_account.Credentials.from_service_account_file(
        sa_path, scopes=SCOPES, subject=sender
    )
    return creds, sender


def send_email(to: str, subject: str, html_body: str) -> dict:
    """Wysyła pojedynczy mail HTML. Rzuca wyjątek przy błędzie."""
    import requests
    from google.auth.transport.requests import Request as GoogleRequest

    creds, sender = _build_credentials()
    creds.refresh(GoogleRequest())  # requests -> objęte patchem SSL

    msg = MIMEText(html_body, "html", "utf-8")
    msg["To"] = to
    msg["From"] = sender
    msg["Subject"] = subject
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

    resp = requests.post(
        SEND_URL,
        headers={
            "Authorization": f"Bearer {creds.token}",
            "Content-Type": "application/json",
        },
        json={"raw": raw},
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()


# ─── Mail powitalny ────────────────────────────────────────────────────────────

WELCOME_SUBJECT = "Witamy w Ramiarz Master — szybki start"

WELCOME_HTML = """\
<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6;max-width:560px">
  <h2 style="margin:0 0 12px">Witamy w Ramiarz Master 👋</h2>
  <p>Cieszymy się, że jesteś z nami! Poniżej kilka kroków na dobry początek:</p>
  <ol>
    <li><strong>Ustawienia → Dane warsztatu</strong> — uzupełnij nazwę, adres i telefon (pojawią się na wydrukach).</li>
    <li><strong>Ustawienia → Dostawcy listew</strong> — aktywuj producentów, z którymi pracujesz, i ustaw swoje marże.</li>
    <li><strong>Ustawienia → moduły materiałów</strong> — wpisz ceny szkła, tyłów, passepartout itd. (pozycje z ceną 0 są ukrywane w wycenie).</li>
    <li><strong>Kalkulator</strong> — wybierz dostawcę, profil listwy, podaj wymiary i policz wycenę. Możesz zapisać zlecenie i wydrukować potwierdzenie.</li>
  </ol>
  <p>Pełna instrukcja krok po kroku jest w aplikacji w zakładce <strong>Pomoc</strong>.</p>
  <p style="color:#888;font-size:12px;margin-top:18px">Wiadomość wysłana automatycznie po założeniu konta.</p>
</div>
"""


def send_welcome_email_async(to: str) -> None:
    """Fire-and-forget — nigdy nie blokuje i nie wywraca tworzenia konta."""
    if not to or not is_configured():
        return
    import threading

    def _worker():
        try:
            send_email(to, WELCOME_SUBJECT, WELCOME_HTML)
            logger.info(f"Mail powitalny wysłany do {to}")
        except Exception as e:  # noqa: BLE001 — celowo łykamy każdy błąd
            logger.warning(f"Nie udało się wysłać maila powitalnego do {to}: {e}")

    threading.Thread(target=_worker, daemon=True).start()
