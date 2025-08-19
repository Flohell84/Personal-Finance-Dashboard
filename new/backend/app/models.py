from typing import Optional
from datetime import date
from sqlmodel import SQLModel, Field

class TransactionBase(SQLModel):
    date: date
    amount: float
    currency: str = "EUR"
    description: Optional[str] = None
    merchant: Optional[str] = None
    category: Optional[str] = None

class Transaction(TransactionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

class TransactionCreate(TransactionBase):
    pass
