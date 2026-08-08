import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.getenv("TOKUP_DATABASE_URL", "sqlite:///./tokup.db")

connect_args = {}
kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    connect_args["timeout"] = 30
    kwargs["pool_size"] = 20
    kwargs["max_overflow"] = 30
    kwargs["pool_pre_ping"] = True

engine = create_engine(DATABASE_URL, connect_args=connect_args, **kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
