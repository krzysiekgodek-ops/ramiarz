from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.dependencies import get_active_user, get_admin_user
from app.models.models import User, Moulding, GlobalSupplier
from app.database import get_db

router = APIRouter()


class MouldingOut(BaseModel):
    id:            int
    code:          str
    price_strip:   float
    price_framed:  float
    width_mm:      float
    supplier_id:   Optional[int]
    supplier_name: Optional[str]

    class Config:
        from_attributes = True


@router.get("", response_model=List[MouldingOut])
async def list_mouldings(
    supplier_id: Optional[int] = Query(None),
    user: User = Depends(get_active_user),
    db:   Session = Depends(get_db)
):
    query = db.query(Moulding)
    if supplier_id is not None:
        query = query.filter(Moulding.supplier_id == supplier_id)
    rows = query.all()

    # Batch-load suppliers to avoid N+1
    supplier_ids = {m.supplier_id for m in rows if m.supplier_id}
    suppliers = {}
    if supplier_ids:
        for sup in db.query(GlobalSupplier).filter(GlobalSupplier.id.in_(supplier_ids)).all():
            suppliers[sup.id] = sup.name

    return [
        MouldingOut(
            id=m.id, code=m.code,
            price_strip=m.price_strip, price_framed=m.price_framed,
            width_mm=m.width_mm, supplier_id=m.supplier_id,
            supplier_name=suppliers.get(m.supplier_id),
        )
        for m in rows
    ]


class MouldingCreate(BaseModel):
    code:         str
    price_strip:  float
    price_framed: float
    width_mm:     float
    supplier_id:  Optional[int] = None


@router.post("", response_model=MouldingOut, status_code=201)
async def create_moulding(
    body: MouldingCreate,
    user: User = Depends(get_admin_user),
    db:   Session = Depends(get_db)
):
    m = Moulding(**body.dict())
    db.add(m)
    db.commit()
    db.refresh(m)
    supplier_name = None
    if m.supplier_id:
        sup = db.query(GlobalSupplier).filter(GlobalSupplier.id == m.supplier_id).first()
        supplier_name = sup.name if sup else None
    return MouldingOut(
        id=m.id, code=m.code, price_strip=m.price_strip,
        price_framed=m.price_framed, width_mm=m.width_mm,
        supplier_id=m.supplier_id, supplier_name=supplier_name,
    )
