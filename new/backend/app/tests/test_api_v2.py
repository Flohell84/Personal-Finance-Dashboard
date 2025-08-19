from fastapi.testclient import TestClient
from ..main import app
from datetime import date

client = TestClient(app)

def test_health_v2():
    r = client.get("/health")
    assert r.status_code == 200


def test_create_transaction_v2():
    payload = {
        "date": date.today().isoformat(),
        "amount": 50.0
    }
    r = client.post("/transactions", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert "transaction" in data
