import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.dependencies import get_admin_user
from app.models.models import User, GlobalSupplier, Moulding, UserSupplierConfig
from app.database import get_db
from app.services import email_service

router = APIRouter()


# ─── Użytkownicy ─────────────────────────────────────────────────────────────

class AdminUserOut(BaseModel):
    id:                   int
    email:                str
    is_superadmin:        bool
    is_paid:              bool
    trial_expires:        Optional[datetime]
    created_at:           Optional[datetime]
    subscription_plan:    Optional[str]      # "monthly" | "yearly" | None
    subscription_expires: Optional[datetime] # data końca opłaconego okresu

    class Config:
        from_attributes = True


@router.get("/users", response_model=List[AdminUserOut])
async def list_users(
    admin: User = Depends(get_admin_user),
    db:    Session = Depends(get_db)
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.get("/stats")
async def get_stats(
    admin: User = Depends(get_admin_user),
    db:    Session = Depends(get_db)
):
    total     = db.query(User).count()
    paid      = db.query(User).filter(User.is_paid == True).count()
    admins    = db.query(User).filter(User.is_superadmin == True).count()
    mouldings = db.query(Moulding).count()
    suppliers = db.query(GlobalSupplier).count()
    return {
        "total_users":  total,
        "paid_users":   paid,
        "trial_users":  total - paid,
        "admins":       admins,
        "mouldings":    mouldings,
        "suppliers":    suppliers,
    }


class PatchUser(BaseModel):
    is_paid:              Optional[bool]     = None
    is_superadmin:        Optional[bool]     = None
    subscription_plan:    Optional[str]      = None   # "monthly" | "yearly" | "none"
    subscription_expires: Optional[datetime] = None   # ISO datetime lub None
    clear_subscription:   Optional[bool]     = None   # True → usuwa plan i datę


@router.patch("/users/{user_id}", response_model=AdminUserOut)
async def patch_user(
    user_id: int,
    body:  PatchUser,
    admin: User = Depends(get_admin_user),
    db:    Session = Depends(get_db)
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")
    if body.is_paid is not None:
        target.is_paid = body.is_paid
    if body.is_superadmin is not None:
        target.is_superadmin = body.is_superadmin

    if body.clear_subscription:
        target.subscription_plan    = None
        target.subscription_expires = None
        target.is_paid              = False
    elif body.subscription_plan is not None:
        plan = body.subscription_plan if body.subscription_plan != "none" else None
        target.subscription_plan = plan
        if body.subscription_expires is not None:
            target.subscription_expires = body.subscription_expires
        if plan is not None:
            target.is_paid = True

    db.commit()
    db.refresh(target)
    return target


# ─── Wysyłka maili do użytkowników ─────────────────────────────────────────────

class SendEmailBody(BaseModel):
    subject:     str
    body:        str                       # tekst (zamieniany na prosty HTML)
    target:      str                       # all | paid | supplier | selected
    supplier_id: Optional[int]       = None
    user_ids:    Optional[List[int]] = None


def _email_config_status():
    return {"configured": email_service.is_configured()}


@router.get("/email-status")
async def email_status(admin: User = Depends(get_admin_user)):
    return _email_config_status()


def _resolve_recipients(db: Session, body: SendEmailBody) -> List[User]:
    q = db.query(User)
    if body.target == "paid":
        q = q.filter(User.is_paid == True)
    elif body.target == "selected":
        ids = body.user_ids or []
        if not ids:
            return []
        q = q.filter(User.id.in_(ids))
    elif body.target == "supplier":
        if not body.supplier_id:
            return []
        sub = db.query(UserSupplierConfig.user_id).filter(
            UserSupplierConfig.supplier_id == body.supplier_id
        )
        q = q.filter(User.id.in_(sub))
    # "all" — bez dodatkowego filtra
    return [u for u in q.all() if u.email]


def _text_to_html(text: str) -> str:
    import html
    safe = html.escape(text).replace("\n", "<br>")
    return (
        '<div style="font-family:Arial,sans-serif;font-size:14px;'
        f'color:#222;line-height:1.6;max-width:560px">{safe}</div>'
    )


@router.post("/send-email")
async def send_email_to_users(
    body:  SendEmailBody,
    admin: User = Depends(get_admin_user),
    db:    Session = Depends(get_db)
):
    if not email_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Wysyłka maili nie jest skonfigurowana (GMAIL_SENDER + konto serwisowe z delegacją domenową).",
        )
    if not body.subject.strip() or not body.body.strip():
        raise HTTPException(status_code=422, detail="Temat i treść są wymagane.")

    recipients = _resolve_recipients(db, body)
    if not recipients:
        raise HTTPException(status_code=422, detail="Brak odbiorców dla wybranego kryterium.")

    html_body = _text_to_html(body.body)
    sent = 0
    failed: List[str] = []
    for u in recipients:
        try:
            email_service.send_email(u.email, body.subject, html_body)
            sent += 1
        except Exception:  # noqa: BLE001
            failed.append(u.email)

    return {"total": len(recipients), "sent": sent, "failed": failed}


# ─── Producenci listew ────────────────────────────────────────────────────────

class SupplierOut(BaseModel):
    id:             int
    name:           str
    moulding_count: int = 0

    class Config:
        from_attributes = True


class SupplierCreate(BaseModel):
    name: str


@router.get("/suppliers", response_model=List[SupplierOut])
async def list_suppliers(
    admin: User = Depends(get_admin_user),
    db:    Session = Depends(get_db)
):
    rows = (
        db.query(GlobalSupplier, func.count(Moulding.id).label("moulding_count"))
        .outerjoin(Moulding, Moulding.supplier_id == GlobalSupplier.id)
        .group_by(GlobalSupplier.id)
        .order_by(GlobalSupplier.name)
        .all()
    )
    return [
        SupplierOut(id=s.id, name=s.name, moulding_count=cnt)
        for s, cnt in rows
    ]


@router.post("/suppliers", response_model=SupplierOut, status_code=201)
async def create_supplier(
    body:  SupplierCreate,
    admin: User = Depends(get_admin_user),
    db:    Session = Depends(get_db)
):
    existing = db.query(GlobalSupplier).filter(GlobalSupplier.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Producent '{body.name}' już istnieje")
    supplier = GlobalSupplier(name=body.name)
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.delete("/suppliers/{supplier_id}", status_code=204)
async def delete_supplier(
    supplier_id: int,
    admin: User = Depends(get_admin_user),
    db:    Session = Depends(get_db)
):
    supplier = db.query(GlobalSupplier).filter(GlobalSupplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Producent nie istnieje")
    db.delete(supplier)
    db.commit()


# ─── Import cennika CSV ───────────────────────────────────────────────────────

def _upsert_moulding(db, code, price_strip, price_framed, width_mm, supplier_id):
    existing = db.query(Moulding).filter(
        Moulding.code == code,
        Moulding.supplier_id == supplier_id,
    ).first()
    if existing:
        existing.price_strip  = price_strip
        existing.price_framed = price_framed
        existing.width_mm     = width_mm
        return "updated"
    db.add(Moulding(
        code=code,
        price_strip=price_strip,
        price_framed=price_framed,
        width_mm=width_mm,
        supplier_id=supplier_id,
    ))
    return "imported"


def _import_eurorama(lines: list, supplier_id: int, db: Session) -> dict:
    """
    Format Eurorama:
      Wiersz 1: nagłówki kolumn (pominięty)
      Wiersz 2: polskie nazwy kolumn (pominięty)
      Wiersz 3+: kod;mb_w_paczce;cena_listew/mb;cena_ramy/mb;szerokość_cm
    Separator: ;  |  Dziesiętny: ,  |  Szerokość: cm → mm (×10)
    """
    imported = updated = 0
    errors = []

    for i, line in enumerate(lines[2:], start=3):
        parts = [p.strip() for p in line.split(";")]
        if len(parts) < 5:
            continue

        code   = parts[0]
        raw_ps = parts[2]
        raw_pf = parts[3]
        raw_w  = parts[4]

        if not code or not raw_w:
            continue

        try:
            price_strip  = float(raw_ps.replace(",", "."))
            price_framed = float(raw_pf.replace(",", "."))
            width_mm     = float(raw_w.replace(",", ".")) * 10  # cm → mm
        except ValueError as e:
            errors.append(f"Wiersz {i} ({code!r}): błąd wartości — {e}")
            continue

        result = _upsert_moulding(db, code, price_strip, price_framed, width_mm, supplier_id)
        if result == "updated":
            updated += 1
        else:
            imported += 1

    db.commit()
    return {"ok": True, "imported": imported, "updated": updated, "errors": errors}


def _import_standard(text: str, supplier_id: int, db: Session) -> dict:
    """
    Format standardowy:
      Nagłówek: code,price_strip,price_framed,width_mm
      Separator: , lub ;  |  Dziesiętny: ,
    """
    sample    = text[:500]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","
    reader    = csv.DictReader(io.StringIO(text), delimiter=delimiter)

    required = {"code", "price_strip", "price_framed", "width_mm"}
    imported = updated = 0
    errors   = []

    for i, row in enumerate(reader, start=2):
        row = {k.strip().lower(): v.strip() for k, v in row.items()}

        missing = required - row.keys()
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Brak kolumn: {missing}. Wymagane: code, price_strip, price_framed, width_mm"
            )

        try:
            code         = row["code"]
            price_strip  = float(row["price_strip"].replace(",", "."))
            price_framed = float(row["price_framed"].replace(",", "."))
            width_mm     = float(row["width_mm"].replace(",", "."))
        except (ValueError, KeyError) as e:
            errors.append(f"Wiersz {i}: błąd wartości — {e}")
            continue

        result = _upsert_moulding(db, code, price_strip, price_framed, width_mm, supplier_id)
        if result == "updated":
            updated += 1
        else:
            imported += 1

    db.commit()
    return {"ok": True, "imported": imported, "updated": updated, "errors": errors}


@router.post("/mouldings/import")
async def import_mouldings(
    file:        UploadFile = File(...),
    supplier_id: int        = Form(...),
    admin: User = Depends(get_admin_user),
    db:    Session = Depends(get_db)
):
    supplier = db.query(GlobalSupplier).filter(GlobalSupplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Producent nie istnieje")

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=422, detail="Wymagany plik .csv")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("cp1250")

    lines = [l for l in text.splitlines() if l.strip()]
    if not lines:
        raise HTTPException(status_code=422, detail="Plik jest pusty")

    if "kolumna 1" in lines[0].lower() or "profil listwy" in lines[0].lower():
        return _import_eurorama(lines, supplier_id, db)

    return _import_standard(text, supplier_id, db)
