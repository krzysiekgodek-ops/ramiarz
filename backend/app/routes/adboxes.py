from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.dependencies import get_admin_user, get_current_user
from app.models.models import User, AdBox
from app.database import get_db

router = APIRouter()


class AdBoxOut(BaseModel):
    slot:        str
    is_active:   bool
    title:       Optional[str]
    body:        Optional[str]
    link_url:    Optional[str]
    link_label:  Optional[str]
    bg_color:    Optional[str]
    custom_html: Optional[str]

    class Config:
        from_attributes = True


class AdBoxUpdate(BaseModel):
    is_active:   Optional[bool]   = None
    title:       Optional[str]    = None
    body:        Optional[str]    = None
    link_url:    Optional[str]    = None
    link_label:  Optional[str]    = None
    bg_color:    Optional[str]    = None
    custom_html: Optional[str]    = None


@router.get("/{slot}", response_model=AdBoxOut)
async def get_ad_box(
    slot: str,
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db)
):
    box = db.query(AdBox).filter_by(slot=slot).first()
    if not box or not box.is_active:
        raise HTTPException(status_code=404, detail="Brak aktywnego boxu")
    return box


@router.put("/{slot}", response_model=AdBoxOut)
async def upsert_ad_box(
    slot: str,
    body: AdBoxUpdate,
    admin: User = Depends(get_admin_user),
    db:    Session = Depends(get_db)
):
    box = db.query(AdBox).filter_by(slot=slot).first()
    if not box:
        box = AdBox(slot=slot)
        db.add(box)
    for field, val in body.dict(exclude_unset=True).items():
        setattr(box, field, val)
    db.commit()
    db.refresh(box)
    return box
