from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ------------------------------------------------------------
# Config
# ------------------------------------------------------------
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 12  # 12h for admin convenience
REFRESH_TOKEN_DAYS = 7

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="El Punto Autoservices API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("elpunto")


# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=ACCESS_TOKEN_MINUTES * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=REFRESH_TOKEN_DAYS * 86400, path="/")


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


async def get_current_admin(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user or user.get("role") != "admin":
            raise HTTPException(status_code=401, detail="Not authorized")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ------------------------------------------------------------
# Models
# ------------------------------------------------------------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AdminOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str


class ContactIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=5, max_length=40)
    message: str = Field(min_length=1, max_length=2000)


class ContactOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    phone: str
    message: str
    status: str
    created_at: str


class AppointmentIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=5, max_length=40)
    service: str = Field(min_length=1, max_length=100)
    vehicle: str = Field(min_length=1, max_length=120)
    date: str  # ISO date YYYY-MM-DD
    time: str  # HH:MM
    notes: Optional[str] = Field(default="", max_length=1000)


class AppointmentOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    phone: str
    service: str
    vehicle: str
    date: str
    time: str
    notes: str
    status: str
    created_at: str


class StatusUpdate(BaseModel):
    status: Literal["new", "in_progress", "completed", "cancelled", "contacted"]


# ------------------------------------------------------------
# Services data (static)
# ------------------------------------------------------------
SERVICES = [
    {"id": "engine-diagnostics", "icon": "Activity", "name_es": "Diagnóstico de Motor", "name_en": "Engine Diagnostics", "desc_es": "Escaneo computarizado avanzado para detectar fallas con precisión.", "desc_en": "Advanced computerized scans to detect faults with precision."},
    {"id": "oil-change", "icon": "Droplet", "name_es": "Cambio de Aceite", "name_en": "Oil Changes", "desc_es": "Aceites sintéticos premium y filtros originales para tu motor.", "desc_en": "Premium synthetic oils and OEM filters for your engine."},
    {"id": "brake-service", "icon": "Disc", "name_es": "Servicio de Frenos", "name_en": "Brake Service", "desc_es": "Pastillas, discos y líquido. Tu seguridad es nuestra prioridad.", "desc_en": "Pads, rotors and fluid. Your safety is our priority."},
    {"id": "suspension", "icon": "Waves", "name_es": "Suspensión", "name_en": "Suspension Repair", "desc_es": "Amortiguadores, bujes y alineación para un manejo perfecto.", "desc_en": "Shocks, bushings and alignment for a perfect ride."},
    {"id": "transmission", "icon": "Cog", "name_es": "Transmisión", "name_en": "Transmission Service", "desc_es": "Reparación y mantenimiento de cajas automáticas y manuales.", "desc_en": "Repair and service of automatic and manual transmissions."},
    {"id": "electrical", "icon": "Zap", "name_es": "Sistema Eléctrico", "name_en": "Electrical Repairs", "desc_es": "Alternador, batería, arranque y diagnóstico eléctrico completo.", "desc_en": "Alternator, battery, starter and full electrical diagnostics."},
    {"id": "preventive", "icon": "ShieldCheck", "name_es": "Mantenimiento Preventivo", "name_en": "Preventive Maintenance", "desc_es": "Planes a la medida para extender la vida de tu vehículo.", "desc_en": "Tailored plans to extend the life of your vehicle."},
    {"id": "general-repair", "icon": "Wrench", "name_es": "Reparación General", "name_en": "General Auto Repair", "desc_es": "Mecánica integral con técnicos certificados y garantía.", "desc_en": "Full-service mechanics with certified technicians and warranty."},
]


# ------------------------------------------------------------
# Routes — Public
# ------------------------------------------------------------
@api.get("/")
async def root():
    return {"name": "El Punto Autoservices API", "ok": True}


@api.get("/services")
async def list_services():
    return SERVICES


@api.post("/contact", response_model=ContactOut)
async def create_contact(payload: ContactIn):
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "phone": payload.phone.strip(),
        "message": payload.message.strip(),
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.contacts.insert_one(doc)
    return ContactOut(**doc)


@api.post("/appointments", response_model=AppointmentOut)
async def create_appointment(payload: AppointmentIn):
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "phone": payload.phone.strip(),
        "service": payload.service,
        "vehicle": payload.vehicle.strip(),
        "date": payload.date,
        "time": payload.time,
        "notes": (payload.notes or "").strip(),
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.appointments.insert_one(doc)
    return AppointmentOut(**doc)


# ------------------------------------------------------------
# Routes — Auth
# ------------------------------------------------------------
@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="No autorizado")
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"id": user["id"], "email": email, "name": user["name"], "role": user["role"], "access_token": access}


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me", response_model=AdminOut)
async def me(admin=Depends(get_current_admin)):
    return AdminOut(**admin)


# ------------------------------------------------------------
# Routes — Admin
# ------------------------------------------------------------
@api.get("/admin/stats")
async def admin_stats(admin=Depends(get_current_admin)):
    contacts = await db.contacts.count_documents({})
    new_contacts = await db.contacts.count_documents({"status": "new"})
    appts = await db.appointments.count_documents({})
    new_appts = await db.appointments.count_documents({"status": "new"})
    return {"contacts_total": contacts, "contacts_new": new_contacts, "appointments_total": appts, "appointments_new": new_appts}


@api.get("/admin/contacts", response_model=List[ContactOut])
async def list_contacts(admin=Depends(get_current_admin)):
    items = await db.contacts.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [ContactOut(**i) for i in items]


@api.patch("/admin/contacts/{contact_id}")
async def update_contact(contact_id: str, body: StatusUpdate, admin=Depends(get_current_admin)):
    res = await db.contacts.update_one({"id": contact_id}, {"$set": {"status": body.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api.delete("/admin/contacts/{contact_id}")
async def delete_contact(contact_id: str, admin=Depends(get_current_admin)):
    res = await db.contacts.delete_one({"id": contact_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api.get("/admin/appointments", response_model=List[AppointmentOut])
async def list_appointments(admin=Depends(get_current_admin)):
    items = await db.appointments.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [AppointmentOut(**i) for i in items]


@api.patch("/admin/appointments/{appt_id}")
async def update_appointment(appt_id: str, body: StatusUpdate, admin=Depends(get_current_admin)):
    res = await db.appointments.update_one({"id": appt_id}, {"$set": {"status": body.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api.delete("/admin/appointments/{appt_id}")
async def delete_appointment(appt_id: str, admin=Depends(get_current_admin)):
    res = await db.appointments.delete_one({"id": appt_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ------------------------------------------------------------
# Startup
# ------------------------------------------------------------
async def seed_admin() -> None:
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": email,
            "password_hash": hash_password(password),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded admin user %s", email)
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password)}})
        logger.info("Updated admin password for %s", email)


@app.on_event("startup")
async def startup() -> None:
    await db.users.create_index("email", unique=True)
    await db.contacts.create_index("created_at")
    await db.appointments.create_index("created_at")
    await seed_admin()


@app.on_event("shutdown")
async def shutdown() -> None:
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)
