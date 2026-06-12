import os
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from app.dependencies import get_current_user
from app.models.models import User
from app.database import get_db

router = APIRouter()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET  = os.getenv("STRIPE_WEBHOOK_SECRET", "")
PRICE_MONTHLY   = os.getenv("STRIPE_PRICE_MONTHLY")
PRICE_YEARLY    = os.getenv("STRIPE_PRICE_YEARLY")
APP_URL         = os.getenv("VITE_APP_URL", "https://ramiarz.ebra.pl")


class CheckoutRequest(BaseModel):
    plan: str  # "monthly" | "yearly"


@router.post("/create-checkout")
async def create_checkout(
    body: CheckoutRequest,
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db)
):
    if body.plan not in ("monthly", "yearly"):
        raise HTTPException(status_code=422, detail="plan musi być 'monthly' lub 'yearly'")

    price_id = PRICE_MONTHLY if body.plan == "monthly" else PRICE_YEARLY

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{APP_URL}/settings?stripe=success",
            cancel_url=f"{APP_URL}/settings?stripe=cancel",
            client_reference_id=str(user.id),
            customer_email=user.email,
            metadata={"user_id": str(user.id), "plan": body.plan},
            # Stripe nie kopiuje metadata sesji na obiekt Subscription —
            # przekazujemy je jawnie, aby webhooki odnowień (invoice.payment_succeeded)
            # mogły zmapować subskrypcję na użytkownika.
            subscription_data={"metadata": {"user_id": str(user.id), "plan": body.plan}},
        )
        return {"url": session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Błąd Stripe: {str(e)}")


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    payload = await request.body()

    # Weryfikacja podpisu
    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Nieprawidłowy podpis webhooka")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    event_type = event["type"]
    data = event["data"]["object"]

    # ── checkout.session.completed — pierwsza płatność ──────────────────────
    if event_type == "checkout.session.completed":
        user_id = data.get("metadata", {}).get("user_id")
        plan    = data.get("metadata", {}).get("plan")
        if user_id and plan:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user:
                months = 1 if plan == "monthly" else 12
                user.is_paid             = True
                user.subscription_plan   = plan
                user.subscription_expires = datetime.now(timezone.utc) + timedelta(days=30 * months)
                db.commit()

    # ── invoice.payment_succeeded — odnowienie ───────────────────────────────
    elif event_type == "invoice.payment_succeeded":
        # W nowym schemacie faktur (API "basil", 2025+) pole `subscription` nie jest
        # już na najwyższym poziomie — przeniesiono je pod parent.subscription_details.
        # Fallback aktywuje się tylko gdy pole nadrzędne jest puste (stary schemat działa bez zmian).
        sub_id = data.get("subscription") or (
            (data.get("parent") or {}).get("subscription_details", {}).get("subscription")
        )
        if sub_id:
            try:
                sub = stripe.Subscription.retrieve(sub_id)
                user_id = sub.get("metadata", {}).get("user_id")
                plan    = sub.get("metadata", {}).get("plan")
                # Użyj daty końca okresu ze Stripe. W nowszych wersjach API
                # current_period_end zniknęło z obiektu Subscription i jest na
                # poziomie pozycji (items) — bierzemy pierwszą dostępną wartość.
                period_end = sub.get("current_period_end")
                if not period_end:
                    items = (sub.get("items") or {}).get("data") or []
                    if items:
                        period_end = items[0].get("current_period_end")
                if user_id and period_end:
                    user = db.query(User).filter(User.id == int(user_id)).first()
                    if user:
                        user.is_paid             = True
                        user.subscription_plan   = plan or user.subscription_plan
                        user.subscription_expires = datetime.fromtimestamp(period_end, tz=timezone.utc)
                        db.commit()
            except Exception:
                pass  # nie blokuj odpowiedzi dla Stripe

    # ── customer.subscription.deleted — anulowanie ──────────────────────────
    elif event_type == "customer.subscription.deleted":
        user_id = data.get("metadata", {}).get("user_id")
        if user_id:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user:
                user.is_paid             = False
                user.subscription_plan   = None
                user.subscription_expires = None
                db.commit()

    return {"ok": True}
