from ..rules import check_plausibility
from datetime import date
from ..models import Transaction


def test_zero_amount():
    t = Transaction(date=date.today(), amount=0.0)
    issues = check_plausibility(t)
    assert any(i['id']=='zero_amount' for i in issues)


def test_large_amount():
    t = Transaction(date=date.today(), amount=20000.0)
    issues = check_plausibility(t)
    assert any(i['id']=='very_large' for i in issues)
