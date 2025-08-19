


from fastapi import FastAPI, Depends, HTTPException, APIRouter, Response, UploadFile, File, Query, Path, Body
from sqlmodel import Session, select, desc, Field
from .db import engine, get_session, init_db
from .models import Transaction, TransactionCreate
from .rules import check_plausibility
import csv
from io import StringIO
import codecs
from collections import defaultdict
from datetime import datetime

app = FastAPI(title="Personal Finance Dashboard - Backend")
api_router = APIRouter(prefix="/api")

# CSV-Import-Endpunkt
@api_router.post("/transactions/import")
async def import_transactions_csv(
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Nur CSV-Dateien erlaubt.")
    content = await file.read()
    decoded = codecs.decode(content, 'utf-8')
    reader = csv.DictReader(decoded.splitlines())
    imported = 0
    for row in reader:
        try:
            t = Transaction(
                date=datetime.strptime(row['date'], "%Y-%m-%d"),
                amount=float(row['amount']),
                description=row['description'],
                category=row.get('category') or None
            )
            session.add(t)
            imported += 1
        except Exception:
            continue  # Fehlerhafte Zeile überspringen
    session.commit()
    return {"imported": imported}

# CSV-Export-Endpunkt
@api_router.get("/transactions/export")
def export_transactions_csv(session: Session = Depends(get_session)):
    statement = select(Transaction).order_by(desc(Transaction.date))
    results = session.exec(statement).all()
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "date", "amount", "description", "category"])
    for t in results:
        writer.writerow([
            t.id,
            t.date.strftime("%Y-%m-%d"),
            t.amount,
            t.description,
            t.category or ""
        ])
    csv_content = output.getvalue()
    output.close()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=transactions.csv"
        }
    )

@app.on_event("startup")
def on_startup():
    init_db()

@api_router.get("/health")
def health():
    return {"status": "ok"}

@api_router.post("/transactions")
def create_transaction(payload: TransactionCreate, session: Session = Depends(get_session)):
    t = Transaction.from_orm(payload)
    session.add(t)
    session.commit()
    session.refresh(t)
    issues = check_plausibility(t)
    return {"transaction": t, "plausibility_issues": issues}


from typing import Optional
from fastapi import Query

@api_router.get("/transactions")
def list_transactions(
    session: Session = Depends(get_session),
    q: Optional[str] = Query(None, description="Suchtext in Beschreibung"),
    category: Optional[str] = Query(None, description="Kategorie filtern"),
    min_amount: Optional[float] = Query(None, description="Minimaler Betrag"),
    max_amount: Optional[float] = Query(None, description="Maximaler Betrag"),
    from_date: Optional[str] = Query(None, description="Startdatum (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Enddatum (YYYY-MM-DD)")
):
    statement = select(Transaction)
    filters = []
    if q:
        filters.append(getattr(Transaction, 'description') != None)
        filters.append(getattr(Transaction, 'description').ilike(f"%{q}%"))
    if category:
        filters.append(Transaction.category == category)
    if min_amount is not None:
        filters.append(Transaction.amount >= min_amount)
    if max_amount is not None:
        filters.append(Transaction.amount <= max_amount)
    if from_date:
        try:
            from_dt = datetime.strptime(from_date, "%Y-%m-%d")
            filters.append(Transaction.date >= from_dt)
        except Exception:
            pass
    if to_date:
        try:
            to_dt = datetime.strptime(to_date, "%Y-%m-%d")
            filters.append(Transaction.date <= to_dt)
        except Exception:
            pass
    if filters:
        for f in filters:
            statement = statement.where(f)
    statement = statement.order_by(desc(Transaction.date))
    results = session.exec(statement).all()
    return results





@api_router.get("/stats/monthly-category")
def stats_monthly_category(session: Session = Depends(get_session), year: int = Query(None)):
    statement = select(Transaction)
    results = session.exec(statement).all()
    stats = defaultdict(lambda: defaultdict(float))  # {"2023-01": {"Miete": 123, ...}, ...}
    for t in results:
        if year and t.date.year != year:
            continue
        month = t.date.strftime("%Y-%m")
        cat = t.category or "Unbekannt"
        stats[month][cat] += t.amount
    # Rückgabe als Liste für einfaches Frontend-Mapping
    out = []
    for month, cats in sorted(stats.items()):
        for cat, summe in cats.items():
            out.append({"month": month, "category": cat, "sum": summe})
    return out

# Endpunkt zum Löschen doppelter Transaktionen
@api_router.delete("/transactions/duplicates")
def delete_duplicate_transactions(session: Session = Depends(get_session)):
    # Alle Transaktionen laden
    statement = select(Transaction)
    results = session.exec(statement).all()
    seen = set()
    to_delete = []
    for t in results:
        key = (t.date, t.amount, t.description, t.category)
        if key in seen:
            to_delete.append(t)
        else:
            seen.add(key)
    # Löschen
    for obj in to_delete:
        session.delete(obj)
    if to_delete:
        session.commit()
    return {"deleted": len(to_delete)}


# Transaktion bearbeiten (PUT/PATCH)
@api_router.patch("/transactions/{transaction_id}")
def update_transaction(
    transaction_id: int = Path(..., description="ID der Transaktion"),
    payload: TransactionCreate = Body(...),
    session: Session = Depends(get_session)
):
    transaction = session.get(Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden")
    data = payload.dict(exclude_unset=True)
    for key, value in data.items():
        setattr(transaction, key, value)
    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return transaction

# Transaktion löschen
@api_router.delete("/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: int = Path(..., description="ID der Transaktion"),
    session: Session = Depends(get_session)
):
    transaction = session.get(Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden")
    session.delete(transaction)
    session.commit()
    return {"deleted": True}

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
