from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from app.dependencies import get_active_user
from app.models.models import User, AdditionalMaterial
from app.database import get_db

router = APIRouter()

ALLOWED_CATEGORIES = {"front", "backing", "foam", "passepartout", "frame_price", "glass"}


class MaterialOut(BaseModel):
    id:       int
    name:     str
    category: str
    price:    float
    margin:   float

    class Config:
        from_attributes = True


class MaterialCreate(BaseModel):
    name:     str
    category: str
    price:    float = 0.0
    margin:   float = 1.0


class MaterialUpdate(BaseModel):
    price:  float
    margin: float = 1.0


class MaterialUpsert(BaseModel):
    name:     str
    category: str
    price:    float = 0.0
    margin:   float = 1.0


def _validate_category(category: str):
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail=f"category musi być jednym z: {sorted(ALLOWED_CATEGORIES)}"
        )


@router.get("", response_model=List[MaterialOut])
async def list_materials(
    user: User = Depends(get_active_user),
    db:   Session = Depends(get_db)
):
    return db.query(AdditionalMaterial).filter_by(user_id=user.id).all()


@router.post("", response_model=MaterialOut, status_code=201)
async def create_material(
    body: MaterialCreate,
    user: User = Depends(get_active_user),
    db:   Session = Depends(get_db)
):
    _validate_category(body.category)
    mat = AdditionalMaterial(user_id=user.id, **body.dict())
    db.add(mat)
    db.commit()
    db.refresh(mat)
    return mat


# NOTE: /upsert MUST be registered before /{mat_id} to avoid path collision
@router.post("/upsert", response_model=MaterialOut)
async def upsert_material(
    body: MaterialUpsert,
    user: User = Depends(get_active_user),
    db:   Session = Depends(get_db)
):
    _validate_category(body.category)
    mat = (
        db.query(AdditionalMaterial)
        .filter_by(user_id=user.id, name=body.name, category=body.category)
        .first()
    )
    if mat:
        mat.price  = body.price
        mat.margin = body.margin
    else:
        mat = AdditionalMaterial(user_id=user.id, **body.dict())
        db.add(mat)
    db.commit()
    db.refresh(mat)
    return mat


@router.put("/{mat_id}", response_model=MaterialOut)
async def update_material(
    mat_id: int,
    body:   MaterialUpdate,
    user:   User = Depends(get_active_user),
    db:     Session = Depends(get_db)
):
    mat = db.query(AdditionalMaterial).filter_by(id=mat_id, user_id=user.id).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Materiał nie istnieje")
    mat.price  = body.price
    mat.margin = body.margin
    db.commit()
    db.refresh(mat)
    return mat


@router.delete("/{mat_id}", status_code=204)
async def delete_material(
    mat_id: int,
    user: User = Depends(get_active_user),
    db:   Session = Depends(get_db)
):
    mat = db.query(AdditionalMaterial).filter_by(id=mat_id, user_id=user.id).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Materiał nie istnieje")
    db.delete(mat)
    db.commit()
