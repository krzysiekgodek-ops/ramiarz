VAT_RATE = 1.23


class CalculatorService:
    @staticmethod
    def calculate_price(
        width_cm: float,
        height_cm: float,
        main_price: float,
        main_width_mm: float,
        main_margin: float,
        liner_price: float = 0.0,
        liner_width_mm: float = 0.0,
        liner_margin: float = 1.6,
        has_liner: bool = False,
        front: dict = None,
        backing: dict = None,
        foam: dict = None,
        pp: dict = None,
        frame_price_flat: float = 0.0,
        extra_fee: float = 0.0,
        discount_pct: float = 0.0,
    ) -> dict:
        area_sqm = (width_cm / 100) * (height_cm / 100)

        if has_liner:
            liner_needed_m = (2 * (width_cm + height_cm) / 100) + 8 * (liner_width_mm / 1000)
            inner_w = width_cm + 2 * (liner_width_mm / 10)
            inner_h = height_cm + 2 * (liner_width_mm / 10)
            main_needed_m = (2 * (inner_w + inner_h) / 100) + 8 * (main_width_mm / 1000)
        else:
            liner_needed_m = 0.0
            main_needed_m = (2 * (width_cm + height_cm) / 100) + 8 * (main_width_mm / 1000)

        # Purchase costs (brutto = netto × VAT)
        liner_cost   = liner_needed_m * liner_price * VAT_RATE if has_liner else 0.0
        main_cost    = main_needed_m  * main_price  * VAT_RATE

        def mat_cost(mat):
            return area_sqm * mat["price"] * VAT_RATE if mat else 0.0

        front_cost   = mat_cost(front)
        backing_cost = mat_cost(backing)
        foam_cost    = mat_cost(foam)
        pp_cost      = mat_cost(pp)
        total_cost_brutto = liner_cost + main_cost + front_cost + backing_cost + foam_cost + pp_cost

        # Client prices (netto × margin × VAT)
        liner_part    = liner_needed_m * liner_price * liner_margin * VAT_RATE if has_liner else 0.0
        moulding_part = main_needed_m  * main_price  * main_margin  * VAT_RATE

        def mat_part(mat):
            return area_sqm * mat["price"] * mat["margin"] * VAT_RATE if mat else 0.0

        front_part   = mat_part(front)
        backing_part = mat_part(backing)
        foam_part    = mat_part(foam)
        pp_part      = mat_part(pp)

        # frame_price_flat i extra_fee są już kwotami finalnymi brutto — bez dodatkowego VAT
        total_before_discount = (
            liner_part + moulding_part
            + front_part + backing_part + foam_part + pp_part
            + frame_price_flat + extra_fee
        )
        discount_amount = total_before_discount * (discount_pct / 100)
        total = total_before_discount - discount_amount

        def r(v):
            return round(v, 2)

        return {
            "liner_needed_m":    r(liner_needed_m),
            "main_needed_m":     r(main_needed_m),
            "area_sqm":          r(area_sqm),
            "liner_cost":        r(liner_cost),
            "main_cost":         r(main_cost),
            "front_cost":        r(front_cost),
            "backing_cost":      r(backing_cost),
            "foam_cost":         r(foam_cost),
            "pp_cost":           r(pp_cost),
            "total_cost_brutto": r(total_cost_brutto),
            "liner_part":        r(liner_part),
            "moulding_part":     r(moulding_part),
            "front_part":        r(front_part),
            "backing_part":      r(backing_part),
            "foam_part":         r(foam_part),
            "pp_part":           r(pp_part),
            "frame_price_part":  r(frame_price_flat),
            "extra_fee_brutto":  r(extra_fee),
            "total_before_discount": r(total_before_discount),
            "discount_amount":   r(discount_amount),
            "total":             r(total),
        }
