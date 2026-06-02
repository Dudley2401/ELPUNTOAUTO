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

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, BackgroundTasks
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

import emailer

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
    technician_id: Optional[str] = None
    technician_name: Optional[str] = None


class StatusUpdate(BaseModel):
    status: Literal["new", "in_progress", "completed", "cancelled", "contacted"]


class TechnicianIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(default="", max_length=40)
    specialty: str = Field(default="", max_length=120)
    active: bool = True


class TechnicianOut(BaseModel):
    id: str
    name: str
    phone: str
    specialty: str
    active: bool
    created_at: str


class AssignTechnician(BaseModel):
    technician_id: Optional[str] = None


class InvoiceItemIn(BaseModel):
    description: str = Field(min_length=1, max_length=300)
    quantity: float = Field(default=1, ge=0)
    unit_price: float = Field(default=0, ge=0)


class InvoiceItemOut(InvoiceItemIn):
    total: float


class InvoiceIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    work_performed: str = Field(default="", max_length=4000)
    items: List[InvoiceItemIn] = Field(default_factory=list)
    tax_rate: float = Field(default=0.18, ge=0, le=1)
    discount: float = Field(default=0, ge=0)
    notes: str = Field(default="", max_length=1000)


class InvoiceOut(BaseModel):
    id: str
    number: str
    appointment_id: str
    client_name: str
    client_email: EmailStr
    client_phone: str
    vehicle: str
    service: str
    technician_name: Optional[str] = None
    work_performed: str
    items: List[InvoiceItemOut]
    subtotal: float
    tax_rate: float
    tax_amount: float
    discount: float
    total: float
    status: str  # draft | sent | paid | cancelled
    notes: str
    created_at: str
    sent_at: Optional[str] = None
    paid_at: Optional[str] = None


class InvoiceStatusUpdate(BaseModel):
    status: Literal["draft", "sent", "paid", "cancelled"]


# ------ Products / Inventory ------
class ProductIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(min_length=1, max_length=200)
    sku: str = Field(default="", max_length=80)
    category: str = Field(default="general", max_length=80)
    unit: str = Field(default="unidad", max_length=40)
    cost: float = Field(default=0, ge=0)
    price: float = Field(default=0, ge=0)
    current_stock: float = Field(default=0, ge=0)
    min_stock: float = Field(default=0, ge=0)
    notes: str = Field(default="", max_length=500)


class ProductOut(BaseModel):
    id: str
    name: str
    sku: str
    category: str
    unit: str
    cost: float
    price: float
    current_stock: float
    min_stock: float
    notes: str
    low_stock: bool
    created_at: str
    updated_at: str


class StockMovementIn(BaseModel):
    quantity: float = Field(gt=0)
    note: str = Field(default="", max_length=300)
    unit_cost: Optional[float] = Field(default=None, ge=0)


class StockMovementOut(BaseModel):
    id: str
    product_id: str
    product_name: str
    type: str  # restock | use | adjustment
    quantity: float
    unit_cost: Optional[float] = None
    note: str
    created_at: str


def _compute_invoice_totals(items: List[dict], tax_rate: float, discount: float) -> tuple:
    items_out = []
    subtotal = 0.0
    for it in items:
        qty = float(it.get("quantity", 1) or 0)
        price = float(it.get("unit_price", 0) or 0)
        total = round(qty * price, 2)
        items_out.append({
            "description": it["description"].strip(),
            "quantity": qty,
            "unit_price": price,
            "total": total,
        })
        subtotal += total
    subtotal = round(subtotal, 2)
    discount = round(min(discount, subtotal), 2)
    taxable = max(subtotal - discount, 0)
    tax_amount = round(taxable * tax_rate, 2)
    total = round(taxable + tax_amount, 2)
    return items_out, subtotal, tax_amount, total


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
async def create_contact(payload: ContactIn, background: BackgroundTasks):
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
    background.add_task(emailer.send_contact_created_client, doc)
    background.add_task(emailer.send_contact_created_admin, doc)
    return ContactOut(**doc)


@api.post("/appointments", response_model=AppointmentOut)
async def create_appointment(payload: AppointmentIn, background: BackgroundTasks):
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
        "technician_id": None,
        "technician_name": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.appointments.insert_one(doc)
    background.add_task(emailer.send_appointment_created_client, doc)
    background.add_task(emailer.send_appointment_created_admin, doc)
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
async def update_appointment(appt_id: str, body: StatusUpdate, background: BackgroundTasks, admin=Depends(get_current_admin)):
    res = await db.appointments.update_one({"id": appt_id}, {"$set": {"status": body.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if appt:
        background.add_task(emailer.send_appointment_status_update, appt, body.status)
    return {"ok": True}


@api.delete("/admin/appointments/{appt_id}")
async def delete_appointment(appt_id: str, admin=Depends(get_current_admin)):
    res = await db.appointments.delete_one({"id": appt_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api.patch("/admin/appointments/{appt_id}/assign")
async def assign_appointment_technician(appt_id: str, body: AssignTechnician, admin=Depends(get_current_admin)):
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if body.technician_id:
        tech = await db.technicians.find_one({"id": body.technician_id}, {"_id": 0})
        if not tech:
            raise HTTPException(status_code=404, detail="Technician not found")
        update = {"technician_id": tech["id"], "technician_name": tech["name"]}
    else:
        update = {"technician_id": None, "technician_name": None}
    await db.appointments.update_one({"id": appt_id}, {"$set": update})
    return {"ok": True, **update}


# ------------------------------------------------------------
# Routes — Admin / Technicians
# ------------------------------------------------------------
@api.get("/admin/technicians", response_model=List[TechnicianOut])
async def list_technicians(admin=Depends(get_current_admin)):
    items = await db.technicians.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [TechnicianOut(**i) for i in items]


@api.post("/admin/technicians", response_model=TechnicianOut)
async def create_technician(payload: TechnicianIn, admin=Depends(get_current_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "phone": (payload.phone or "").strip(),
        "specialty": (payload.specialty or "").strip(),
        "active": payload.active,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.technicians.insert_one(doc)
    return TechnicianOut(**doc)


@api.patch("/admin/technicians/{tech_id}", response_model=TechnicianOut)
async def update_technician(tech_id: str, payload: TechnicianIn, admin=Depends(get_current_admin)):
    update = {
        "name": payload.name.strip(),
        "phone": (payload.phone or "").strip(),
        "specialty": (payload.specialty or "").strip(),
        "active": payload.active,
    }
    res = await db.technicians.update_one({"id": tech_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    # If name changed, propagate to existing appointments
    await db.appointments.update_many({"technician_id": tech_id}, {"$set": {"technician_name": update["name"]}})
    tech = await db.technicians.find_one({"id": tech_id}, {"_id": 0})
    return TechnicianOut(**tech)


@api.delete("/admin/technicians/{tech_id}")
async def delete_technician(tech_id: str, admin=Depends(get_current_admin)):
    res = await db.technicians.delete_one({"id": tech_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    # Unassign from any appointment
    await db.appointments.update_many({"technician_id": tech_id}, {"$set": {"technician_id": None, "technician_name": None}})
    return {"ok": True}


# ------------------------------------------------------------
# Routes — Admin / Invoices
# ------------------------------------------------------------
async def _next_invoice_number() -> str:
    year = datetime.now(timezone.utc).year
    counter = await db.counters.find_one_and_update(
        {"_id": f"invoice_{year}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = (counter or {}).get("seq", 1)
    return f"EP-{year}-{seq:04d}"


def _serialize_invoice(doc: dict) -> dict:
    out = {**doc}
    out.pop("_id", None)
    return out


@api.get("/admin/invoices", response_model=List[InvoiceOut])
async def list_invoices(admin=Depends(get_current_admin)):
    items = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [InvoiceOut(**i) for i in items]


@api.get("/admin/appointments/{appt_id}/invoice", response_model=InvoiceOut)
async def get_appointment_invoice(appt_id: str, admin=Depends(get_current_admin)):
    inv = await db.invoices.find_one({"appointment_id": appt_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="No invoice")
    return InvoiceOut(**inv)


@api.post("/admin/appointments/{appt_id}/invoice", response_model=InvoiceOut)
async def create_or_update_invoice(appt_id: str, payload: InvoiceIn, admin=Depends(get_current_admin)):
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    items_data = [it.model_dump() for it in payload.items]
    items_out, subtotal, tax_amount, total = _compute_invoice_totals(items_data, payload.tax_rate, payload.discount)

    existing = await db.invoices.find_one({"appointment_id": appt_id}, {"_id": 0})
    now = datetime.now(timezone.utc).isoformat()
    if existing:
        update = {
            "client_name": appt["name"],
            "client_email": appt["email"],
            "client_phone": appt["phone"],
            "vehicle": appt["vehicle"],
            "service": appt["service"],
            "technician_name": appt.get("technician_name"),
            "work_performed": payload.work_performed.strip(),
            "items": items_out,
            "subtotal": subtotal,
            "tax_rate": payload.tax_rate,
            "tax_amount": tax_amount,
            "discount": payload.discount,
            "total": total,
            "notes": payload.notes.strip(),
        }
        await db.invoices.update_one({"id": existing["id"]}, {"$set": update})
        inv = await db.invoices.find_one({"id": existing["id"]}, {"_id": 0})
        return InvoiceOut(**inv)
    else:
        number = await _next_invoice_number()
        doc = {
            "id": str(uuid.uuid4()),
            "number": number,
            "appointment_id": appt_id,
            "client_name": appt["name"],
            "client_email": appt["email"],
            "client_phone": appt["phone"],
            "vehicle": appt["vehicle"],
            "service": appt["service"],
            "technician_name": appt.get("technician_name"),
            "work_performed": payload.work_performed.strip(),
            "items": items_out,
            "subtotal": subtotal,
            "tax_rate": payload.tax_rate,
            "tax_amount": tax_amount,
            "discount": payload.discount,
            "total": total,
            "status": "draft",
            "notes": payload.notes.strip(),
            "created_at": now,
            "sent_at": None,
            "paid_at": None,
        }
        await db.invoices.insert_one(doc)
        return InvoiceOut(**doc)


@api.patch("/admin/invoices/{invoice_id}/status")
async def update_invoice_status(invoice_id: str, body: InvoiceStatusUpdate, admin=Depends(get_current_admin)):
    now = datetime.now(timezone.utc).isoformat()
    update = {"status": body.status}
    if body.status == "sent":
        update["sent_at"] = now
    elif body.status == "paid":
        update["paid_at"] = now
    res = await db.invoices.update_one({"id": invoice_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api.delete("/admin/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, admin=Depends(get_current_admin)):
    res = await db.invoices.delete_one({"id": invoice_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api.post("/admin/invoices/{invoice_id}/send-email")
async def send_invoice_email(invoice_id: str, background: BackgroundTasks, admin=Depends(get_current_admin)):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Not found")
    public_url = _build_invoice_public_url(inv["id"])
    background.add_task(emailer.send_invoice_email, inv, public_url)
    await db.invoices.update_one({"id": invoice_id}, {"$set": {"status": "sent", "sent_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True}


def _build_invoice_public_url(invoice_id: str) -> str:
    base = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
    if not base:
        # Fallback: relative path. Email will use this; admin UI will rebuild absolute URL client-side.
        return f"/invoice/{invoice_id}"
    return f"{base}/invoice/{invoice_id}"


# Public route for clients to view invoice (no auth, unguessable UUID)
@api.get("/public/invoices/{invoice_id}", response_model=InvoiceOut)
async def public_invoice(invoice_id: str):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Not found")
    return InvoiceOut(**inv)


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
    await db.technicians.create_index("created_at")
    await db.invoices.create_index("created_at")
    await db.invoices.create_index("appointment_id")
    await db.products.create_index("name")
    await db.stock_movements.create_index("product_id")
    await db.stock_movements.create_index("created_at")
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
