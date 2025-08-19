from fastapi import FastAPI, Depends, HTTPException
from sqlmodel import Session, select
from .db import engine, get_session, init_db
from .models import Transaction, TransactionCreate
from .rules import check_plausibility

app = FastAPI(title="Personal Finance Dashboard - Backend")

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/transactions")
def create_transaction(payload: TransactionCreate, session: Session = Depends(get_session)):
    t = Transaction.from_orm(payload)
    session.add(t)
    session.commit()
    session.refresh(t)
    issues = check_plausibility(t)
    return {"transaction": t, "plausibility_issues": issues}

@app.get("/transactions")
def list_transactions(session: Session = Depends(get_session)):
    statement = select(Transaction)
    results = session.exec(statement).all()
    return results
