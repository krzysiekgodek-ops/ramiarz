from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.dependencies import get_active_user
from app.models.models import User, Order
from app.database import get_db

router = APIRouter()


class OrderOut(BaseModel):
    id:           int
    order_nr:     str
    date:         Optional[datetime]
    customer:     Optional[str]
    phone:        Optional[str]
    details:      Optional[str]
    pickup_date:  Optional[str]
    total_brutto: float
    deposit:      float

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    order_nr:     str
    customer:     Optional[str] = None
    phone:        Optional[str] = None
    details:      Optional[str] = None
    pickup_date:  Optional[str] = None
    total_brutto: float
    deposit:      float = 0.0


class OrderPatch(BaseModel):
    deposit:      Optional[float] = None
    details:      Optional[str]  = None
    customer:     Optional[str]  = None
    phone:        Optional[str]  = None
    pickup_date:  Optional[str]  = None


@router.get("", response_model=List[OrderOut])
async def list_orders(
    user: User = Depends(get_active_user),
    db:   Session = Depends(get_db)
):
    return db.query(Order).filter_by(user_id=user.id).order_by(Order.date.desc()).all()


@router.post("", response_model=OrderOut, status_code=201)
async def create_order(
    body: OrderCreate,
    user: User = Depends(get_active_user),
    db:   Session = Depends(get_db)
):
    order = Order(user_id=user.id, **body.dict())
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.patch("/{order_id}", response_model=OrderOut)
async def patch_order(
    order_id: int,
    body: OrderPatch,
    user: User = Depends(get_active_user),
    db:   Session = Depends(get_db)
):
    order = db.query(Order).filter_by(id=order_id, user_id=user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Zlecenie nie istnieje")
    if body.deposit      is not None: order.deposit      = body.deposit
    if body.details      is not None: order.details      = body.details
    if body.customer     is not None: order.customer     = body.customer
    if body.phone        is not None: order.phone        = body.phone
    if body.pickup_date  is not None: order.pickup_date  = body.pickup_date
    db.commit()
    db.refresh(order)
    return order


@router.delete("/{order_id}", status_code=204)
async def delete_order(
    order_id: int,
    user: User = Depends(get_active_user),
    db:   Session = Depends(get_db)
):
    order = db.query(Order).filter_by(id=order_id, user_id=user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Zlecenie nie istnieje")
    db.delete(order)
    db.commit()
