from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.dependencies import get_current_user
from app.models.models import User, WorkshopSettings, GlobalSupplier, UserSupplierConfig
from app.database import get_db

router = APIRouter()


@router.get("/me")
async def get_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    settings = db.query(WorkshopSettings).filter_by(user_id=user.id).first()
    return {
        "id":            user.id,
        "email":         user.email,
        "firebase_uid":  user.firebase_uid,
        "is_superadmin": user.is_superadmin,
        "is_paid":       user.is_paid,
        "trial_expires": user.trial_expires,
        "settings": {
            "company_name": settings.company_name if settings else "Mój Warsztat",
            "address":      settings.address      if settings else "",
            "phone":        settings.phone        if settings else "",
            "email":        settings.email        if settings else "",
            "website":      settings.website      if settings else "",
        } if settings else None,
    }


class SettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    address:      Optional[str] = None
    phone:        Optional[str] = None
    email:        Optional[str] = None
    website:      Optional[str] = None


@router.put("/settings")
async def update_settings(
    body: SettingsUpdate,
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db)
):
    settings = db.query(WorkshopSettings).filter_by(user_id=user.id).first()
    if not settings:
        settings = WorkshopSettings(user_id=user.id)
        db.add(settings)
    if body.company_name is not None:
        settings.company_name = body.company_name
    if body.address is not None:
        settings.address = body.address
    if body.phone is not None:
        settings.phone = body.phone
    if body.email is not None:
        settings.email = body.email
    if body.website is not None:
        settings.website = body.website
    db.commit()
    db.refresh(settings)
    return {"ok": True}


# ─── Konfiguracja dostawców użytkownika ──────────────────────────────────────

class SupplierConfigBody(BaseModel):
    discount: float = 0.0   # 0.0–1.0 (np. 0.05 = 5%)
    m_strip:  float = 1.6
    m_framed: float = 2.0


@router.get("/supplier-configs")
async def list_supplier_configs(
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db)
):
    suppliers = db.query(GlobalSupplier).order_by(GlobalSupplier.name).all()
    result = []
    for s in suppliers:
        cfg = db.query(UserSupplierConfig).filter_by(
            user_id=user.id, supplier_id=s.id
        ).first()
        result.append({
            "supplier_id":   s.id,
            "supplier_name": s.name,
            "config": {
                "discount": cfg.discount,
                "m_strip":  cfg.m_strip,
                "m_framed": cfg.m_framed,
            } if cfg else None,
        })
    return result


@router.put("/supplier-configs/{supplier_id}")
async def upsert_supplier_config(
    supplier_id: int,
    body: SupplierConfigBody,
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db)
):
    supplier = db.query(GlobalSupplier).filter(GlobalSupplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Producent nie istnieje")

    cfg = db.query(UserSupplierConfig).filter_by(
        user_id=user.id, supplier_id=supplier_id
    ).first()
    if not cfg:
        cfg = UserSupplierConfig(user_id=user.id, supplier_id=supplier_id)
        db.add(cfg)

    cfg.discount = body.discount
    cfg.m_strip  = body.m_strip
    cfg.m_framed = body.m_framed
    db.commit()
    return {"ok": True}


@router.delete("/supplier-configs/{supplier_id}", status_code=204)
async def delete_supplier_config(
    supplier_id: int,
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db)
):
    cfg = db.query(UserSupplierConfig).filter_by(
        user_id=user.id, supplier_id=supplier_id
    ).first()
    if cfg:
        db.delete(cfg)
        db.commit()
