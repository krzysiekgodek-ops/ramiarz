import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.database import engine
from app.models import models
from app.routes import auth, calculator, orders, mouldings, materials, admin, help

load_dotenv()

models.Base.metadata.create_all(bind=engine)

from app.migrations import run_migrations
run_migrations()

app = FastAPI(title="Ramiarz Master API", version="2.0.0")

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,       prefix="/api/auth",       tags=["auth"])
app.include_router(calculator.router, prefix="/api/calculator", tags=["calculator"])
app.include_router(orders.router,     prefix="/api/orders",     tags=["orders"])
app.include_router(mouldings.router,  prefix="/api/mouldings",  tags=["mouldings"])
app.include_router(materials.router,  prefix="/api/materials",  tags=["materials"])
app.include_router(admin.router,      prefix="/api/admin",      tags=["admin"])
app.include_router(help.router,       prefix="/api/help",       tags=["help"])

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}

@app.get("/api/debug/ssl")
async def debug_ssl():
    import requests
    try:
        r = requests.get(
            "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com",
            timeout=8
        )
        return {"ssl": "ok", "status": r.status_code, "keys": len(r.json())}
    except Exception as e:
        return {"ssl": "error", "type": type(e).__name__, "msg": str(e)[:200]}

@app.get("/api/debug/firebase")
async def debug_firebase():
    from app.dependencies import init_firebase
    from firebase_admin import auth as firebase_auth
    try:
        init_firebase()
        firebase_auth.verify_id_token("invalid.token.here", check_revoked=False)
        return {"firebase": "unexpected_ok"}
    except firebase_auth.InvalidIdTokenError as e:
        return {"firebase": "initialized_ok", "note": "InvalidIdTokenError = Firebase działa, tylko token był zły"}
    except Exception as e:
        return {"firebase": "error", "type": type(e).__name__, "msg": str(e)[:300]}
