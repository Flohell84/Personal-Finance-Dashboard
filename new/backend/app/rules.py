from .models import Transaction
from typing import List
from .rules_engine import evaluate_rules

def check_plausibility(t: Transaction) -> List[dict]:
    ctx = {
        "date": t.date,
        "amount": t.amount,
        "currency": t.currency,
        "description": t.description,
        "merchant": t.merchant,
        "category": t.category,
    }
    return evaluate_rules(ctx)
