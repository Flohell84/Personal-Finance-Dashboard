


from fastapi import FastAPI, Depends, HTTPException, APIRouter, Response, UploadFile, File, Query, Path, Body, Form
MOBILITAET = "Mobilität"
BUECHER = "Bücher"

from sqlmodel import Session, select, desc
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
from datetime import datetime, date
from .auth import router as auth_router

app = FastAPI(title="Personal Finance Dashboard - Backend")
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
api_router = APIRouter(prefix="/api")

SECRET_KEY = os.environ.get("SECRET_KEY", "devsecret")
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")
USER_NOT_FOUND = "User nicht gefunden"

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
        raise HTTPException(status_code=404, detail=USER_NOT_FOUND)
    return user

def require_admin(user: User = Depends(get_current_user)) -> User:
    if not getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Adminrechte erforderlich")
    return user

def require_regular_user(user: User = Depends(get_current_user)) -> User:
    if getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Für Admins nicht erlaubt")
    return user

@api_router.post("/transactions/import")
async def import_transactions_csv(
    file: UploadFile = File(...),
    date_field: str = Form("date"),
    amount_field: str = Form("amount"),
    description_field: str = Form("description"),
    category_field: str = Form("category"),
    session: Session = Depends(get_session),
    user: User = Depends(require_regular_user)
):
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Nur CSV-Dateien erlaubt.")
    content = await file.read()
    decoded = codecs.decode(content, 'utf-8')
    reader = csv.DictReader(decoded.splitlines())
    imported = 0
    skipped_duplicates = 0
    df = (date_field or 'date').strip()
    af = (amount_field or 'amount').strip()
    descf = (description_field or 'description').strip()
    catf = (category_field or 'category').strip()

    def parse_row(row):
        parsed_date = datetime.strptime((row.get(df) or '').strip(), "%Y-%m-%d")
        amount_raw = (row.get(af) or '0').strip().replace(',', '.')
        parsed_amount = float(amount_raw)
        desc = (row.get(descf) or '').strip()
        cat = (row.get(catf) or '').strip() or None
        return parsed_date, parsed_amount, desc, cat

    def is_duplicate(d, amt, desc, cat):
        existing = session.exec(
            select(Transaction).where(
                Transaction.user_id == user.id,
                Transaction.date == d,
                Transaction.amount == amt,
                Transaction.description == desc,
                Transaction.category == cat,
            )
        ).first()
        return existing is not None

    for row in reader:
        try:
            parsed_date, parsed_amount, desc, cat = parse_row(row)
            if is_duplicate(parsed_date, parsed_amount, desc, cat):
                skipped_duplicates += 1
                continue

            session.add(Transaction(
                date=parsed_date,
                amount=parsed_amount,
                description=desc,
                category=cat,
                user_id=user.id
            ))
            imported += 1
        except Exception:
            continue
    session.commit()
    return {"imported": imported, "skipped_duplicates": skipped_duplicates}

@api_router.get("/transactions/export")
def export_transactions_csv(session: Session = Depends(get_session), user: User = Depends(require_regular_user)):
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
    try:
        with engine.connect() as conn:
            cols = [row[1] for row in conn.exec_driver_sql("PRAGMA table_info('user')").fetchall()]
            if 'is_admin' not in cols:
                conn.exec_driver_sql("ALTER TABLE user ADD COLUMN is_admin INTEGER DEFAULT 0")
                conn.exec_driver_sql("UPDATE user SET is_admin = 0 WHERE is_admin IS NULL")
                conn.commit()
    except Exception:
        pass
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    with Session(engine) as session:
        admin = session.exec(select(User).where(User.username == "admin")).first()
        if not admin:
            admin = User(username="admin", hashed_password=pwd_context.hash("admin123"), is_active=True, is_admin=True)
            session.add(admin)
            session.commit()

@api_router.get("/health")
def health():
    return {"status": "ok"}

@api_router.post("/transactions")
def create_transaction(payload: TransactionCreate, session: Session = Depends(get_session), user: User = Depends(require_regular_user)):
    t = Transaction.from_orm(payload)
    t.user_id = user.id
    session.add(t)
    session.commit()
    session.refresh(t)
    issues = check_plausibility(t)
    return {"transaction": t, "plausibility_issues": issues}


from typing import Optional

@api_router.get("/transactions")
def list_transactions(
    session: Session = Depends(get_session),
    user: User = Depends(require_regular_user),
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
def stats_monthly_category(session: Session = Depends(get_session), user: User = Depends(require_regular_user), year: int = Query(None)):
    statement = select(Transaction).where(Transaction.user_id == user.id)
    results = session.exec(statement).all()
    stats = defaultdict(lambda: defaultdict(float))
    for t in results:
        if year and t.date.year != year:
            continue
        month = t.date.strftime("%Y-%m")
        cat = t.category or "Unbekannt"
        stats[month][cat] += t.amount
    out = []
    for month, cats in sorted(stats.items()):
        for cat, summe in cats.items():
            out.append({"month": month, "category": cat, "sum": summe})
    return out

@api_router.delete("/transactions/duplicates")
def delete_duplicate_transactions(session: Session = Depends(get_session), user: User = Depends(require_regular_user)):
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
    for obj in to_delete:
        session.delete(obj)
    if to_delete:
        session.commit()
    return {"deleted": len(to_delete)}


@api_router.patch("/transactions/{transaction_id}")
def update_transaction(
    transaction_id: int = Path(..., description="ID der Transaktion"),
    payload: TransactionCreate = Body(...),
    session: Session = Depends(get_session),
    user: User = Depends(require_regular_user)
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

@api_router.delete("/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: int = Path(..., description="ID der Transaktion"),
    session: Session = Depends(get_session),
    user: User = Depends(require_regular_user)
):
    transaction = session.get(Transaction, transaction_id)
    if not transaction or transaction.user_id != user.id:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden oder nicht erlaubt")
    session.delete(transaction)
    session.commit()
    return {"deleted": True}


@api_router.post("/seed-demo-data")
def trigger_seed_demo_data(user: User = Depends(require_regular_user)):
    seed_demo_data()
    return {"status": "ok", "message": "Demo-Daten wurden eingefügt."}

from pydantic import BaseModel

class AdminUserCreate(BaseModel):
    username: str
    password: str
    is_admin: bool = False
    is_active: bool = True

@api_router.get("/admin/users")
def admin_list_users(session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    users = session.exec(select(User)).all()
    return [{"id": u.id, "username": u.username, "is_active": u.is_active, "is_admin": getattr(u, "is_admin", False)} for u in users]

@api_router.post("/admin/users")
def admin_create_user(payload: AdminUserCreate, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    existing = session.exec(select(User).where(User.username == payload.username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username bereits vergeben")
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    user = User(username=payload.username, hashed_password=pwd_context.hash(payload.password), is_active=payload.is_active, is_admin=payload.is_admin)
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"id": user.id, "username": user.username, "is_active": user.is_active, "is_admin": getattr(user, "is_admin", False)}

class AdminUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    password: Optional[str] = None

@api_router.patch("/admin/users/{user_id}")
def admin_update_user(user_id: int, payload: AdminUserUpdate, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail=USER_NOT_FOUND)
    data = payload.dict(exclude_unset=True)
    if "is_active" in data and data["is_active"] is not None:
        user.is_active = data["is_active"]
    if "is_admin" in data and data["is_admin"] is not None:
        user.is_admin = data["is_admin"]
    if "password" in data and data["password"]:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        user.hashed_password = pwd_context.hash(str(data["password"]))
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"id": user.id, "username": user.username, "is_active": user.is_active, "is_admin": getattr(user, "is_admin", False)}

@api_router.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail=USER_NOT_FOUND)
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Eigenes Konto kann nicht gelöscht werden")
    session.delete(user)
    session.commit()
    return {"deleted": True}

app.include_router(api_router)

def seed_demo_data():
    from .models_user import User
    from .models import Transaction
    from sqlmodel import Session, select
    from .db import engine
    from passlib.context import CryptContext
    from datetime import date, timedelta
    import random
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    with Session(engine) as session:
        _create_demo_users(session, pwd_context, DEMO_USERS_ALL)
        _seed_monthly_transactions(session, DEMO_USERS_ALL, INCOME_MAP, INCOME_CATEGORIES, EXPENSE_MAP, SEED_START, date.today())
        _seed_example_transactions(session, pwd_context, DEMO_USERS)
        _seed_demo_user_if_needed(session, pwd_context)
    print("Demo-User: demo / demo123 (mit Beispiel-Daten)")

SEED_START = date(2020, 1, 1)
DEMO_USERS_ALL = [
    ("demo", "demo123"),
    ("alice", "alice123"),
    ("bob", "bob123"),
    ("carla", "carla123"),
]
INCOME_MAP = {
    "demo": 3500,
    "alice": 4200,
    "bob": 3900,
    "carla": 4800,
}
INCOME_CATEGORIES = [
    ("Gehalt", "Einnahmen"),
    ("Nebenjob", "Einnahmen"),
    ("Zinsen", "Kapitalerträge"),
    ("Steuerrückzahlung", "Sonstiges"),
    ("Verkauf", "Sonstiges"),
    ("Mieteinnahmen", "Einnahmen"),
    ("Dividende", "Kapitalerträge"),
    ("Elterngeld", "Sozialleistungen"),
    ("Kindergeld", "Sozialleistungen"),
    ("Bonus", "Einnahmen"),
    ("Geschenk", "Sonstiges"),
    ("Rückerstattung", "Sonstiges"),
]
EXPENSE_MAP = {
    "demo": [
        ("Supermarkt", -50, "Lebensmittel"),
        ("Miete", -700, "Wohnen"),
        ("Internet", -30, "Kommunikation"),
        ("Tanken", -80, MOBILITAET),
        ("Strom", -60, "Versorgung"),
        ("Kino", -20, "Freizeit"),
        ("Arzt", -30, "Gesundheit"),
        (BUECHER, -15, "Bildung"),
        ("Restaurant", -40, "Freizeit"),
        ("Urlaub", -150, "Reisen"),
        ("Kleidung", -45, "Shopping"),
        ("Versicherung", -90, "Versicherung"),
    ],
    "alice": [
        ("Supermarkt", -120, "Lebensmittel"),
        ("Miete", -800, "Wohnen"),
        ("Fitnessstudio", -40, "Freizeit"),
        ("Bahn", -60, MOBILITAET),
        ("Strom", -70, "Versorgung"),
        ("Arzt", -50, "Gesundheit"),
        (BUECHER, -25, "Bildung"),
        ("Konzert", -35, "Freizeit"),
        ("Urlaub", -200, "Reisen"),
        ("Kleidung", -60, "Shopping"),
        ("Versicherung", -100, "Versicherung"),
        ("Drogerie", -30, "Haushalt"),
    ],
    "bob": [
        ("Restaurant", -55, "Freizeit"),
        ("Miete", -650, "Wohnen"),
        ("Handyvertrag", -25, "Kommunikation"),
        ("Benzin", -90, MOBILITAET),
        ("Strom", -55, "Versorgung"),
        ("Kino", -25, "Freizeit"),
        ("Arzt", -20, "Gesundheit"),
        (BUECHER, -10, "Bildung"),
        ("Urlaub", -120, "Reisen"),
        ("Kleidung", -40, "Shopping"),
        ("Versicherung", -80, "Versicherung"),
        ("Haushalt", -35, "Haushalt"),
    ],
    "carla": [
        ("Supermarkt", -200, "Lebensmittel"),
        ("Miete", -950, "Wohnen"),
        ("Kino", -30, "Freizeit"),
        ("Fahrrad", -150, MOBILITAET),
        ("Strom", -80, "Versorgung"),
        ("Arzt", -60, "Gesundheit"),
        (BUECHER, -35, "Bildung"),
        ("Konzert", -45, "Freizeit"),
        ("Urlaub", -250, "Reisen"),
        ("Kleidung", -90, "Shopping"),
        ("Versicherung", -120, "Versicherung"),
        ("Haushalt", -50, "Haushalt"),
    ],
}
DEMO_USERS = [
    ("alice", "alice123", [
        ("Gehalt", 2100, "Einnahmen"),
        ("Supermarkt", -120, "Lebensmittel"),
        ("Miete", -800, "Wohnen"),
        ("Fitnessstudio", -40, "Freizeit"),
        ("Bahn", -60, MOBILITAET),
    ]),
    ("bob", "bob123", [
        ("Gehalt", 1800, "Einnahmen"),
        ("Restaurant", -55, "Freizeit"),
        ("Miete", -650, "Wohnen"),
        ("Handyvertrag", -25, "Kommunikation"),
        ("Benzin", -90, MOBILITAET),
    ]),
    ("carla", "carla123", [
        ("Gehalt", 2500, "Einnahmen"),
        ("Supermarkt", -200, "Lebensmittel"),
        ("Miete", -950, "Wohnen"),
        ("Kino", -30, "Freizeit"),
        ("Fahrrad", -150, MOBILITAET),
    ]),
]

def _create_demo_users(session, pwd_context, demo_users_all):
    from .models_user import User
    from sqlmodel import select
    for username, pw in demo_users_all:
        user = session.exec(select(User).where(User.username == username)).first()
        if not user:
            user = User(username=username, hashed_password=pwd_context.hash(pw), is_active=True)
            session.add(user)
            session.commit()
            session.refresh(user)

def _seed_monthly_transactions(session, demo_users_all, income_map, income_categories, expense_map, start, today):
    from .models_user import User
    from .models import Transaction
    from sqlmodel import select
    from calendar import monthrange
    import random
    for username, _ in demo_users_all:
        user = session.exec(select(User).where(User.username == username)).first()
        if not user:
            continue
        tx_count = session.exec(select(Transaction).where(Transaction.user_id == user.id, Transaction.date <= today, Transaction.date >= start)).all()
        if len(tx_count) > 50:
            continue
        d = start
        while d <= today:
            random.seed(f"{username}-{d.year}-{d.month}-income")
            income_cat = random.choice(income_categories)
            income_var = income_map[username] + random.randint(-100, 100)
            session.add(Transaction(
                date=d.replace(day=1),
                amount=income_var,
                description=income_cat[0],
                category=income_cat[1],
                user_id=user.id
            ))
            expense_list = expense_map[username][:]
            random.seed(f"{username}-{d.year}-{d.month}-expenses")
            random.shuffle(expense_list)
            for i, (desc, amount, cat) in enumerate(expense_list):
                day = min(3 + i*2, monthrange(d.year, d.month)[1])
                random.seed(f"{username}-{d.year}-{d.month}-{i}")
                expense_var = amount + random.randint(-20, 20)
                session.add(Transaction(
                    date=d.replace(day=day),
                    amount=expense_var,
                    description=desc,
                    category=cat,
                    user_id=user.id
                ))
            if d.month == 12:
                d = d.replace(year=d.year+1, month=1)
            else:
                d = d.replace(month=d.month+1)
        session.commit()

def _seed_example_transactions(session, pwd_context, demo_users):
    from .models_user import User
    from .models import Transaction
    from sqlmodel import select
    from datetime import date, timedelta
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

def _seed_demo_user_if_needed(session, pwd_context):
    from .models_user import User
    from .models import Transaction
    from sqlmodel import select
    from datetime import date, timedelta
    user = session.exec(select(User).where(User.username == "demo")).first()
    if not user:
        user = User(username="demo", hashed_password=pwd_context.hash("demo123"), is_active=True)
        session.add(user)
        session.commit()
        session.refresh(user)
    tx_count = session.exec(select(Transaction).where(Transaction.user_id == user.id)).all()
    if not tx_count:
        today = date.today()
        beispiel = [
            Transaction(date=today, amount=1200, description="Gehalt", category="Einnahmen", user_id=user.id),
            Transaction(date=today-timedelta(days=2), amount=-50, description="Supermarkt", category="Lebensmittel", user_id=user.id),
            Transaction(date=today-timedelta(days=5), amount=-700, description="Miete", category="Wohnen", user_id=user.id),
            Transaction(date=today-timedelta(days=8), amount=-30, description="Internet", category="Kommunikation", user_id=user.id),
            Transaction(date=today-timedelta(days=10), amount=-80, description="Tanken", category=MOBILITAET, user_id=user.id),
        ]
        for t in beispiel:
            session.add(t)
        session.commit()
