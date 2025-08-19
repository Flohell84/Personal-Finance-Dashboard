from fastapi.testclient import TestClient
from ..main import app
from datetime import date

client = TestClient(app)

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

def test_create_transaction():
    payload = {
        "date": date.today().isoformat(),
        "amount": 123.45,
        "currency": "EUR",
        "description": "Test payment",
        "merchant": "Example Store",
        "category": "shopping"
    }
    r = client.post("/transactions", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert "transaction" in data
    assert data["transaction"]["amount"] == 123.45
