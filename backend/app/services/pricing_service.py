from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.models import Moulding, UserSupplierConfig, AdditionalMaterial
from app.schemas.schemas import OrderCreate

# Stałe biznesowe
VAT_RATE = 1.23

def calculate_order_total(db: Session, user_id: int, data: OrderCreate):
    # 1. Pobieramy profil ramy (Używamy nowoczesnego db.get) [cite: 3]
    moulding = db.get(Moulding, data.moulding_id)
    if not moulding:
        raise HTTPException(status_code=404, detail="Nie znaleziono wybranego profilu ramy") # 

    # 2. Pobieramy konfigurację marż użytkownika dla tego dostawcy [cite: 8]
    cfg = db.query(UserSupplierConfig).filter(
        UserSupplierConfig.user_id == user_id,
        UserSupplierConfig.supplier_id == moulding.supplier_id
    ).first()

    # 3. Ustalanie rabatu i marży (zabezpieczenie SaaS) 
    discount = cfg.discount if cfg else 0.0
    if cfg:
        margin = cfg.m_strip if data.choice == 'B' else cfg.m_framed
    else:
        # Bezpieczne domyślne wartości jeśli ramiarz nic nie ustawił 
        margin = 1.6 if data.choice == 'B' else 2.0

    # 4. Obliczanie metrów bieżących (Mb) 
    # mm -> cm dla szerokości felcu
    width_cm = moulding.width_mm / 10
    # Wzór: 2*(W+H) + 8*szerokość profilu (narożniki)
    need_mb = (2 * (data.width + data.height) + (8 * width_cm)) / 100

    # 5. Koszt bazowy i cena sprzedaży ramy
    base_price = moulding.price_strip if data.choice == 'B' else moulding.price_framed
    cost_netto = need_mb * base_price * (1 - discount / 100)
    sell_brutto_frame = cost_netto * margin * VAT_RATE

    # 6. Obliczanie dodatków (Szkło, tyły, PP) 
    ext_sum_brutto = 0.0
    area_m2 = (data.width * data.height) / 10000

    for e_id in data.extras:
        # Weryfikacja właściciela materiału - KLUCZOWE DLA SaaS 
        ext = db.query(AdditionalMaterial).filter(
            AdditionalMaterial.id == e_id,
            AdditionalMaterial.user_id == user_id
        ).first()
        
        if ext:
            ext_sum_brutto += (area_m2 * ext.price * ext.margin * VAT_RATE)

    # 7. Suma końcowa
    manual_extra_brutto = data.manual_extra * VAT_RATE
    total_brutto = sell_brutto_frame + ext_sum_brutto + manual_extra_brutto

    details = f"Profil: {moulding.code} | Wymiary: {data.width}x{data.height} cm | Typ: {data.choice}"

    return round(total_brutto, 2), details