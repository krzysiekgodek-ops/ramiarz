from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.dependencies import get_active_user
from app.models.models import User, Moulding, AdditionalMaterial, UserSupplierConfig
from app.services.calculator_service import CalculatorService
from app.database import get_db

router = APIRouter()


class CalculateRequest(BaseModel):
    width_cm:  float
    height_cm: float
    moulding_id:            Optional[int]  = None
    liner_id:               Optional[int]  = None
    use_frame_price_main:   bool           = False
    use_frame_price_liner:  bool           = False
    front_id:               Optional[int]  = None
    backing_id:             Optional[int]  = None
    foam_id:                Optional[int]  = None
    pp_id:                  Optional[int]  = None
    frame_price_id:         Optional[int]  = None
    extra_fee:              float          = 0.0
    discount_pct:           float          = 0.0


@router.get("/ping")
async def ping(user: User = Depends(get_active_user)):
    return {"status": "ok", "user": user.email}


def _get_config(db: Session, user_id: int, supplier_id: Optional[int]) -> Optional[UserSupplierConfig]:
    if not supplier_id:
        return None
    return db.query(UserSupplierConfig).filter_by(user_id=user_id, supplier_id=supplier_id).first()


def _moulding_price(moulding: Moulding, config: Optional[UserSupplierConfig], use_framed: bool) -> float:
    discount = config.discount if config else 0.0
    base = moulding.price_framed if use_framed else moulding.price_strip
    return base * (1 - discount)


def _moulding_margin(config: Optional[UserSupplierConfig], use_framed: bool) -> float:
    if not config:
        return 2.0 if use_framed else 1.6
    return config.m_framed if use_framed else config.m_strip


def _get_material(db: Session, mat_id: Optional[int], user_id: int) -> Optional[dict]:
    if not mat_id:
        return None
    mat = db.query(AdditionalMaterial).filter(
        AdditionalMaterial.id == mat_id,
        AdditionalMaterial.user_id == user_id,
    ).first()
    if not mat:
        return None
    return {"price": mat.price, "margin": mat.margin}


@router.post("/calculate")
async def calculate(
    req: CalculateRequest,
    user: User = Depends(get_active_user),
    db:   Session = Depends(get_db)
):
    if not req.moulding_id:
        raise HTTPException(status_code=422, detail="Wymagany moulding_id")

    moulding = db.query(Moulding).filter(Moulding.id == req.moulding_id).first()
    if not moulding:
        raise HTTPException(status_code=404, detail="Profil listwy nie istnieje")

    main_config = _get_config(db, user.id, moulding.supplier_id)
    main_price  = _moulding_price(moulding, main_config, req.use_frame_price_main)
    main_margin = _moulding_margin(main_config, req.use_frame_price_main)

    has_liner    = req.liner_id is not None
    liner_price  = 0.0
    liner_width  = 0.0
    liner_margin = 1.6

    if has_liner:
        liner = db.query(Moulding).filter(Moulding.id == req.liner_id).first()
        if not liner:
            raise HTTPException(status_code=404, detail="Profil wkładki nie istnieje")
        liner_config = _get_config(db, user.id, liner.supplier_id)
        liner_price  = _moulding_price(liner, liner_config, req.use_frame_price_liner)
        liner_width  = liner.width_mm
        liner_margin = _moulding_margin(liner_config, req.use_frame_price_liner)

    front   = _get_material(db, req.front_id,   user.id)
    backing = _get_material(db, req.backing_id,  user.id)
    foam    = _get_material(db, req.foam_id,     user.id)
    pp      = _get_material(db, req.pp_id,       user.id)

    frame_price_flat = 0.0
    if req.frame_price_id:
        fp = db.query(AdditionalMaterial).filter(
            AdditionalMaterial.id == req.frame_price_id,
            AdditionalMaterial.user_id == user.id,
        ).first()
        if fp:
            frame_price_flat = fp.price

    return CalculatorService.calculate_price(
        width_cm         = req.width_cm,
        height_cm        = req.height_cm,
        main_price       = main_price,
        main_width_mm    = moulding.width_mm,
        main_margin      = main_margin,
        liner_price      = liner_price,
        liner_width_mm   = liner_width,
        liner_margin     = liner_margin,
        has_liner        = has_liner,
        front            = front,
        backing          = backing,
        foam             = foam,
        pp               = pp,
        frame_price_flat = frame_price_flat,
        extra_fee        = req.extra_fee,
        discount_pct     = req.discount_pct,
    )
