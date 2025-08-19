import pytest
from sqlmodel import SQLModel
from ..db import engine, init_db


@pytest.fixture(autouse=True)
def prepare_db():
    # create tables fresh for tests
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    yield
    SQLModel.metadata.drop_all(engine
)
