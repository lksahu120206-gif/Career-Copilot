from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Make sure it says 'postgresql://' at the start, not just 'postgres://'
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:Lal%40supabaseit12@db.cwavsvftxlyhcazgyddk.supabase.co:5432/postgres"

# Create the engine (PostgreSQL doesn't need the extra check_same_thread argument)
engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()