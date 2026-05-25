from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# --- SCHEMATY UŻYTKOWNIKA ---
class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: int
    is_superadmin: bool
    is_paid: bool
    trial_expires: datetime

    class Config:
        from_attributes = True # Pozwala Pydantic czytać dane bezpośrednio z modeli SQLAlchemy

# --- SCHEMATY ZAMÓWIEŃ ---
# [Audyt: 6, 7] Walidacja danych wejściowych - blokujemy wartości ujemne
class OrderCreate(BaseModel):
    nr: str = Field(..., min_length=1)
    customer: str = Field(default="Detal")
    moulding_id: int
    width: float = Field(..., gt=0)   # Szerokość musi być większa od 0
    height: float = Field(..., gt=0)  # Wysokość musi być większa od 0
    choice: str                       # 'B' (listwa) lub 'C' (rama)
    extras: List[int] = []            # Lista ID wybranych materiałów dodatkowych
    manual_extra: float = Field(0.0, ge=0) # Dodatkowa opłata nie może być ujemna
    deposit: float = Field(0.0, ge=0)

class OrderOut(BaseModel):
    id: int
    order_nr: str
    date: datetime
    customer: str
    total_brutto: float
    deposit: float

    class Config:
        from_attributes = True

# --- SCHEMATY KONFIGURACJI ---
class SupplierConfigUpdate(BaseModel):
    discount: float = Field(0.0, ge=0, le=100)
    m_strip: float = Field(1.6, ge=1.0)
    m_framed: float = Field(2.0, ge=1.0)

# --- SCHEMATY REKLAM ---
class AdCreate(BaseModel):
    title: str
    link_url: Optional[str] = None
    days: int = Field(..., gt=0)