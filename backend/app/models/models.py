from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone, timedelta
from app.database import Base

# [Audyt: 2] Wszystkie daty domyślnie w UTC
def get_utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    is_superadmin = Column(Boolean, default=False)
    
    # [Audyt: 13] Logika SaaS - trial i status płatności
    created_at = Column(DateTime, default=get_utc_now)
    trial_expires = Column(DateTime, default=lambda: get_utc_now() + timedelta(days=21))
    is_paid = Column(Boolean, default=False)
    
    # Relacje - [Audyt: 1] czytelna struktura
    settings = relationship("WorkshopSettings", back_populates="owner", uselist=False, cascade="all, delete-orphan")
    configs = relationship("UserSupplierConfig", back_populates="user", cascade="all, delete-orphan")
    materials = relationship("AdditionalMaterial", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")

class WorkshopSettings(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    company_name = Column(String, default="Mój Warsztat")
    address = Column(String, default="")
    phone = Column(String, default="")
    email = Column(String, default="")
    website = Column(String, default="")

    owner = relationship("User", back_populates="settings")

class GlobalSupplier(Base):
    __tablename__ = "global_suppliers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    
    configs = relationship("UserSupplierConfig", back_populates="supplier")
    mouldings = relationship("Moulding", back_populates="supplier")

class UserSupplierConfig(Base):
    """[Audyt: 8] Izolacja marż per użytkownik"""
    __tablename__ = "user_supplier_configs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    supplier_id = Column(Integer, ForeignKey("global_suppliers.id"))
    discount = Column(Float, default=0.0)
    m_strip = Column(Float, default=1.6)
    m_framed = Column(Float, default=2.0)
    
    user = relationship("User", back_populates="configs")
    supplier = relationship("GlobalSupplier", back_populates="configs")

class AdditionalMaterial(Base):
    """[Audyt: 7] Materiały dodatkowe przypisane do konkretnego użytkownika"""
    __tablename__ = "additional_materials"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    category = Column(String, nullable=False) # glass, backing, passepartout
    price = Column(Float, default=0.0)
    margin = Column(Float, default=1.0)
    
    user = relationship("User", back_populates="materials")

class Moulding(Base):
    """[Audyt: 8] Globalna baza profili dostępna dla wszystkich"""
    __tablename__ = "mouldings"
    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("global_suppliers.id"))
    code = Column(String, index=True, nullable=False)
    price_strip = Column(Float, nullable=False)
    price_framed = Column(Float, nullable=False)
    width_mm = Column(Float, nullable=False)
    # Wycofana z produkcji — ramiarz dostaje ostrzeżenie przy wycenie
    discontinued = Column(Boolean, default=False, nullable=False)

    supplier = relationship("GlobalSupplier", back_populates="mouldings")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    order_nr = Column(String, nullable=False)
    # [Audyt: 10] Zmiana na DateTime
    date = Column(DateTime, default=get_utc_now)
    customer = Column(String)
    phone = Column(String, nullable=True)
    details = Column(String)
    pickup_date = Column(String, nullable=True)
    total_brutto = Column(Float, nullable=False)
    deposit = Column(Float, default=0.0)
    
    user = relationship("User", back_populates="orders")

class Advertisement(Base):
    """[Audyt: 9] System reklam globalnych"""
    __tablename__ = "advertisements"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    link_url = Column(String, nullable=True)
    pdf_filename = Column(String, nullable=True)
    active_until = Column(DateTime, nullable=False)