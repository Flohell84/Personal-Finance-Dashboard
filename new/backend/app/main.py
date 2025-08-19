


from fastapi import FastAPI, Depends, HTTPException, APIRouter, Response, UploadFile, File, Query, Path, Body
from sqlmodel import Session, select, desc, Field
from .db import engine, get_session, init_db
from .models import Transaction, TransactionCreate
from .models_user import User
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
import os
from .rules import check_plausibility
import csv
from io import StringIO
import codecs
from collections import defaultdict
from datetime import datetime
from .auth import router as auth_router

app = FastAPI(title="Personal Finance Dashboard - Backend")
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
api_router = APIRouter(prefix="/api")

# Auth-Utils
SECRET_KEY = os.environ.get("SECRET_KEY", "devsecret")
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)) -> User:
    from fastapi import HTTPException
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Token ungültig")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token ungültig")
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User nicht gefunden")
    return user

# CSV-Import-Endpunkt
@api_router.post("/transactions/import")
async def import_transactions_csv(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user)
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
                category=row.get('category') or None,
                user_id=user.id
            )
            session.add(t)
            imported += 1
        except Exception:
            continue  # Fehlerhafte Zeile überspringen
    session.commit()
    return {"imported": imported}

# CSV-Export-Endpunkt
@api_router.get("/transactions/export")
def export_transactions_csv(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    statement = select(Transaction).where(Transaction.user_id == user.id).order_by(desc(Transaction.date))
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
def create_transaction(payload: TransactionCreate, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    t = Transaction.from_orm(payload)
    t.user_id = user.id
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
    user: User = Depends(get_current_user),
    q: Optional[str] = Query(None, description="Suchtext in Beschreibung"),
    category: Optional[str] = Query(None, description="Kategorie filtern"),
    min_amount: Optional[float] = Query(None, description="Minimaler Betrag"),
    max_amount: Optional[float] = Query(None, description="Maximaler Betrag"),
    from_date: Optional[str] = Query(None, description="Startdatum (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="Enddatum (YYYY-MM-DD)")
):
    statement = select(Transaction).where(Transaction.user_id == user.id)
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
def stats_monthly_category(session: Session = Depends(get_session), user: User = Depends(get_current_user), year: int = Query(None)):
    statement = select(Transaction).where(Transaction.user_id == user.id)
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
def delete_duplicate_transactions(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    # Nur Transaktionen des Users laden
    statement = select(Transaction).where(Transaction.user_id == user.id)
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
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user)
):
    transaction = session.get(Transaction, transaction_id)
    if not transaction or transaction.user_id != user.id:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden oder nicht erlaubt")
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
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user)
):
    transaction = session.get(Transaction, transaction_id)
    if not transaction or transaction.user_id != user.id:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden oder nicht erlaubt")
    session.delete(transaction)
    session.commit()
    return {"deleted": True}

app.include_router(api_router)

def seed_demo_data():
    # Alle benötigten Imports und Initialisierungen an den Anfang der Funktion
    from .models_user import User
    from .models import Transaction
    from sqlmodel import Session, select
    from .db import engine
    from passlib.context import CryptContext
    from datetime import date, timedelta

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    demo_users = [
        ("alice", "alice123", [
            ("Gehalt", 2100, "Einnahmen"),
            ("Supermarkt", -120, "Lebensmittel"),
            ("Miete", -800, "Wohnen"),
            ("Fitnessstudio", -40, "Freizeit"),
            ("Bahn", -60, "Mobilität"),
        ]),
        ("bob", "bob123", [
            ("Gehalt", 1800, "Einnahmen"),
            ("Restaurant", -55, "Freizeit"),
            ("Miete", -650, "Wohnen"),
            ("Handyvertrag", -25, "Kommunikation"),
            ("Benzin", -90, "Mobilität"),
        ]),
        ("carla", "carla123", [
            ("Gehalt", 2500, "Einnahmen"),
            ("Supermarkt", -200, "Lebensmittel"),
            ("Miete", -950, "Wohnen"),
            ("Kino", -30, "Freizeit"),
            ("Fahrrad", -150, "Mobilität"),
        ]),
    ]

    with Session(engine) as session:
        # Zusätzliche Demo-User und Daten
        for username, pw, txs in demo_users:
            user = session.exec(select(User).where(User.username == username)).first()
            if not user:
                user = User(username=username, hashed_password=pwd_context.hash(pw), is_active=True)
                session.add(user)
                session.commit()
                session.refresh(user)
            tx_count = session.exec(select(Transaction).where(Transaction.user_id == user.id)).all()
            if not tx_count:
                today = date.today()
                for i, (desc, amount, cat) in enumerate(txs):
                    t = Transaction(date=today-timedelta(days=i*3), amount=amount, description=desc, category=cat, user_id=user.id)
                    session.add(t)
                session.commit()

        # Demo-User anlegen, falls nicht vorhanden
        user = session.exec(select(User).where(User.username == "demo")).first()
        if not user:
            user = User(username="demo", hashed_password=pwd_context.hash("demo123"), is_active=True)
            session.add(user)
            session.commit()
            session.refresh(user)
        # Beispiel-Transaktionen nur anlegen, wenn User noch keine hat
        tx_count = session.exec(select(Transaction).where(Transaction.user_id == user.id)).all()
        if not tx_count:
            today = date.today()
            beispiel = [
                Transaction(date=today, amount=1200, description="Gehalt", category="Einnahmen", user_id=user.id),
                Transaction(date=today-timedelta(days=2), amount=-50, description="Supermarkt", category="Lebensmittel", user_id=user.id),
                Transaction(date=today-timedelta(days=5), amount=-700, description="Miete", category="Wohnen", user_id=user.id),
                Transaction(date=today-timedelta(days=8), amount=-30, description="Internet", category="Kommunikation", user_id=user.id),
                Transaction(date=today-timedelta(days=10), amount=-80, description="Tanken", category="Mobilität", user_id=user.id),
            ]
            for t in beispiel:
                session.add(t)
            session.commit()
    print("Demo-User: demo / demo123 (mit Beispiel-Daten)")

if __name__ == "__main__":
    seed_demo_data()
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
