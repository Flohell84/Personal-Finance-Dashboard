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

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .models_user import User

class Transaction(TransactionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)

class TransactionCreate(TransactionBase):
    pass
