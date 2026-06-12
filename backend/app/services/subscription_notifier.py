"""
Powiadomienia o wygasającym abonamencie.

Raz dziennie (przez zewnętrzny cron → endpoint /api/cron/notify-expiring)
szukamy płacących użytkowników, których abonament kończy się za 5 dni lub za
1 dzień, i wysyłamy im maila z prośbą o odnowienie. Wysyłka jest fire-and-forget
(wątek daemon), identycznie jak mail powitalny — nigdy nie blokuje żądania.
"""
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import or_, and_

from app.database import SessionLocal
from app.models.models import User
from app.services import email_service

logger = logging.getLogger(__name__)

# Dni przed wygaśnięciem, w których wysyłamy przypomnienie
NOTIFY_DAYS = (5, 1)
# Tolerancja porównania — porównujemy tylko datę, bez godziny
TOLERANCE = timedelta(hours=12)

PLAN_LABELS = {"monthly": "miesięczny", "yearly": "roczny"}


def _day_word(days_left: int) -> str:
    """Polska odmiana: 1 → 'dzień', pozostałe → 'dni'."""
    return "dzień" if days_left == 1 else "dni"


def _build_expiry_html(days_left: int, plan: str) -> str:
    """HTML maila o wygasającym abonamencie. Styl wzorowany na WELCOME_HTML."""
    plan_label = PLAN_LABELS.get(plan, plan)
    word = _day_word(days_left)
    return f"""\
<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6;max-width:560px">
  <h2 style="margin:0 0 12px">Twój abonament wkrótce wygasa ⏳</h2>
  <p>Abonament <strong>{plan_label}</strong> w Ramiarz Master wygasa
     za <strong>{days_left} {word}</strong>.</p>
  <p>Aby zachować ciągły dostęp do kalkulatora i zapisanych zleceń,
     odnów abonament przed upływem tego terminu.</p>
  <p>Odnowienia dokonasz w aplikacji w zakładce <strong>Ustawienia</strong>
     lub kontaktując się z nami.</p>
  <p style="color:#888;font-size:12px;margin-top:18px">Wiadomość wysłana automatycznie.</p>
</div>
"""


def _build_expiry_subject(days_left: int) -> str:
    return f"Ramiarz Master — Twój abonament wygasa za {days_left} {_day_word(days_left)}"


def send_expiry_notifications() -> None:
    """Znajduje płacących użytkowników z abonamentem kończącym się za 5 lub 1 dzień
    i wysyła im przypomnienie. Każdy mail w osobnym try/except — błąd jednego nie
    blokuje pozostałych."""
    if not email_service.is_configured():
        logger.info("Powiadomienia o abonamencie pominięte — Gmail nieskonfigurowany.")
        return

    now = datetime.now(timezone.utc).replace(tzinfo=None)  # naive UTC (spójne z bazą)

    # Okno ±12h wokół każdego progu (porównujemy w praktyce tylko datę)
    windows = []
    for days in NOTIFY_DAYS:
        target = now + timedelta(days=days)
        windows.append((days, target - TOLERANCE, target + TOLERANCE))

    range_filter = or_(*[
        and_(User.subscription_expires >= lo, User.subscription_expires <= hi)
        for (_days, lo, hi) in windows
    ])

    db = SessionLocal()
    try:
        users = (
            db.query(User)
            .filter(
                User.is_paid.is_(True),
                User.subscription_plan.in_(("monthly", "yearly")),
                User.subscription_expires.isnot(None),
                range_filter,
            )
            .all()
        )

        for user in users:
            # Ustal, do którego progu pasuje (najbliższy moment wygaśnięcia)
            days_left = None
            for days, lo, hi in windows:
                if lo <= user.subscription_expires <= hi:
                    days_left = days
                    break
            if days_left is None or not user.email:
                continue

            try:
                email_service.send_email(
                    user.email,
                    _build_expiry_subject(days_left),
                    _build_expiry_html(days_left, user.subscription_plan),
                )
                logger.info(
                    f"Powiadomienie o abonamencie ({days_left} dni) wysłane do {user.email}"
                )
            except Exception as e:  # noqa: BLE001 — błąd jednego maila nie blokuje reszty
                logger.warning(
                    f"Nie udało się wysłać powiadomienia o abonamencie do {user.email}: {e}"
                )
    finally:
        db.close()


def run_notifier() -> None:
    """Fire-and-forget — uruchamia wysyłkę w wątku daemon, nigdy nie blokuje."""
    import threading

    def _worker():
        try:
            send_expiry_notifications()
        except Exception as e:  # noqa: BLE001 — celowo łykamy każdy błąd
            logger.warning(f"Błąd powiadomień o abonamencie: {e}")

    threading.Thread(target=_worker, daemon=True).start()
