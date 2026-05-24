import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.dependencies import get_admin_user
from app.models.models import User, GlobalSupplier, Moulding
from app.database import get_db

router = APIRouter()


# ─── Użytkownicy ─────────────────────────────────────────────────────────────

class AdminUserOut(BaseModel):
    id:            int
    email:         str
    is_superadmin: bool
    is_paid:       bool
    trial_expires: Optional[datetime]
    created_at:    Optional[datetime]

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
    is_paid:       Optional[bool] = None
    is_superadmin: Optional[bool] = None


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
    db.commit()
    db.refresh(target)
    return target


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
