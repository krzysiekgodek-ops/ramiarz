from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.dependencies import get_active_user, get_admin_user
from app.models.models import User, HelpArticle
from app.database import get_db

router = APIRouter()


class HelpArticleOut(BaseModel):
    id:         int
    title:      str
    content:    str
    position:   int
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class HelpArticleCreate(BaseModel):
    title:    str
    content:  str = ""
    position: Optional[int] = None


class HelpArticleUpdate(BaseModel):
    title:    Optional[str] = None
    content:  Optional[str] = None
    position: Optional[int] = None


@router.get("", response_model=List[HelpArticleOut])
async def list_articles(
    user: User = Depends(get_active_user),
    db:   Session = Depends(get_db)
):
    return (
        db.query(HelpArticle)
        .order_by(HelpArticle.position, HelpArticle.id)
        .all()
    )


@router.post("", response_model=HelpArticleOut, status_code=201)
async def create_article(
    body:  HelpArticleCreate,
    admin: User = Depends(get_admin_user),
    db:    Session = Depends(get_db)
):
    position = body.position
    if position is None:
        max_pos = db.query(HelpArticle).count()
        position = max_pos
    article = HelpArticle(title=body.title, content=body.content, position=position)
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.put("/{article_id}", response_model=HelpArticleOut)
async def update_article(
    article_id: int,
    body:  HelpArticleUpdate,
    admin: User = Depends(get_admin_user),
    db:    Session = Depends(get_db)
):
    article = db.query(HelpArticle).filter(HelpArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artykuł nie istnieje")
    if body.title is not None:
        article.title = body.title
    if body.content is not None:
        article.content = body.content
    if body.position is not None:
        article.position = body.position
    db.commit()
    db.refresh(article)
    return article


@router.delete("/{article_id}", status_code=204)
async def delete_article(
    article_id: int,
    admin: User = Depends(get_admin_user),
    db:    Session = Depends(get_db)
):
    article = db.query(HelpArticle).filter(HelpArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artykuł nie istnieje")
    db.delete(article)
    db.commit()
