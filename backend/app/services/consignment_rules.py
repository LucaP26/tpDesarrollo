from __future__ import annotations

from datetime import date, timedelta


INSPECTION_ADDRESS = "Av. Santa Fe 3858"
INSPECTION_DEADLINE_BUSINESS_DAYS = 3
REJECTION_RETURN_BUSINESS_DAYS = 5
CONSIGNMENT_ADMIN_EMAIL = "m@gmail.com"
DEFAULT_CONSIGNMENT_BASE_PRICE = 10000.0
DEFAULT_CONSIGNMENT_COMMISSION_RATE = 0.12
DEFAULT_CONSIGNMENT_STORAGE_LOCATION = "Deposito Atelier Palermo"


def add_business_days(start: date, days: int) -> date:
    current = start
    remaining = days
    while remaining > 0:
        current += timedelta(days=1)
        if current.weekday() < 5:
            remaining -= 1
    return current
