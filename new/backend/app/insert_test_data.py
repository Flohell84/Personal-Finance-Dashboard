import random
from datetime import datetime, timedelta
from app.db import get_session, init_db
from app.models import Transaction

# Kategorien für Einnahmen und Ausgaben
INCOME_CATEGORIES = ["Gehalt", "Bonus", "Zinsen", "Dividende", "Sonstige Einnahmen"]
EXPENSE_CATEGORIES = ["Miete", "Lebensmittel", "Freizeit", "Versicherung", "Auto", "Reisen", "Gesundheit", "Shopping", "Sonstige Ausgaben"]

BESCHREIBUNGEN = {
    "Gehalt": "Monatliches Gehalt",
    "Bonus": "Jahresbonus",
    "Zinsen": "Zinsertrag Sparkonto",
    "Dividende": "Dividende Aktien",
    "Sonstige Einnahmen": "Nebenverdienst",
    "Miete": "Wohnungsmiete",
    "Lebensmittel": "Supermarkt Einkauf",
    "Freizeit": "Kino, Restaurant, Sport",
    "Versicherung": "Haftpflichtversicherung",
    "Auto": "Benzin, Reparatur",
    "Reisen": "Urlaub, Hotel",
    "Gesundheit": "Arzt, Medikamente",
    "Shopping": "Kleidung, Elektronik",
    "Sonstige Ausgaben": "Sonstiges"
}

random.seed(42)


def random_date(start, end):
    """Gibt ein zufälliges Datum zwischen start und end zurück."""
    delta = end - start
    return start + timedelta(days=random.randint(0, delta.days))


def generate_transactions(n=500):
    """Erzeugt n zufällige Transaktionen zwischen 1.1.2020 und heute."""
    start = datetime(2020, 1, 1)
    end = datetime.now()
    transactions = []
    for _ in range(n):
        if random.random() < 0.4:
            # Einnahme
            cat = random.choice(INCOME_CATEGORIES)
            amount = round(random.uniform(500, 4000), 2)
        else:
            # Ausgabe
            cat = random.choice(EXPENSE_CATEGORIES)
            amount = round(random.uniform(-300, -20), 2)
        date = random_date(start, end).date()
        desc = BESCHREIBUNGEN[cat]
        transactions.append(Transaction(date=date, amount=amount, description=desc, category=cat))
    return transactions


def insert_transactions():
    init_db()
    with next(get_session()) as session:
        for t in generate_transactions(500):
            session.add(t)
        session.commit()
    print("500 Test-Transaktionen eingefügt.")

if __name__ == "__main__":
    insert_transactions()
