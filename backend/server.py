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
import invoice_scanner
import chat_service

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
    tracking_token: Optional[str] = None
    status_history: List[dict] = Field(default_factory=list)


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


# ------ Suppliers / Purchase Invoices ------
class SupplierIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(default="", max_length=40)
    rnc: str = Field(default="", max_length=40)
    notes: str = Field(default="", max_length=500)


class SupplierOut(BaseModel):
    id: str
    name: str
    phone: str
    rnc: str
    notes: str
    created_at: str


class PurchaseItemIn(BaseModel):
    description: str = Field(min_length=1, max_length=300)
    quantity: float = Field(default=1, ge=0)
    unit_price: float = Field(default=0, ge=0)
    unit: str = Field(default="unidad")
    product_id: Optional[str] = None  # link to existing product, or None to create new


class PurchaseItemOut(BaseModel):
    description: str
    quantity: float
    unit_price: float
    unit: str
    total: float
    product_id: Optional[str] = None
    product_name: Optional[str] = None


class PurchaseInvoiceIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    supplier_id: Optional[str] = None
    supplier_name: str = Field(min_length=1, max_length=200)
    supplier_phone: str = Field(default="", max_length=40)
    supplier_rnc: str = Field(default="", max_length=40)
    invoice_number: str = Field(default="", max_length=80)
    date: str = Field(default="")
    items: List[PurchaseItemIn] = Field(default_factory=list)
    notes: str = Field(default="", max_length=500)


class PurchaseInvoiceOut(BaseModel):
    id: str
    supplier_id: str
    supplier_name: str
    supplier_phone: str
    supplier_rnc: str
    invoice_number: str
    date: str
    items: List[PurchaseItemOut]
    subtotal: float
    total: float
    notes: str
    created_at: str


class ScanInvoiceIn(BaseModel):
    image_base64: str


class ChatIn(BaseModel):
    session_id: str
    message: str = Field(min_length=1, max_length=2000)


class ChatOut(BaseModel):
    reply: str
    session_id: str


# ------ Reviews ------
class ReviewIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(min_length=1, max_length=120)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=5, max_length=1000)
    vehicle: str = Field(default="", max_length=120)
    service: str = Field(default="", max_length=120)
    appointment_id: Optional[str] = None


class ReviewOut(BaseModel):
    id: str
    name: str
    rating: int
    comment: str
    vehicle: str
    service: str
    status: str
    created_at: str


class ReviewStatusUpdate(BaseModel):
    status: Literal["pending", "approved", "rejected"]


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
        "tracking_token": str(uuid.uuid4()),
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
        "status_history": [
            {"status": "new", "at": datetime.now(timezone.utc).isoformat(), "note": "Cita creada"}
        ],
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
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Not found")
    entry = {"status": body.status, "at": datetime.now(timezone.utc).isoformat(), "note": ""}
    await db.appointments.update_one(
        {"id": appt_id},
        {"$set": {"status": body.status}, "$push": {"status_history": entry}},
    )
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
# Routes — Admin / Products & Inventory
# ------------------------------------------------------------
def _product_to_out(p: dict) -> ProductOut:
    return ProductOut(
        id=p["id"], name=p["name"], sku=p.get("sku", ""), category=p.get("category", "general"),
        unit=p.get("unit", "unidad"), cost=p.get("cost", 0), price=p.get("price", 0),
        current_stock=p.get("current_stock", 0), min_stock=p.get("min_stock", 0),
        notes=p.get("notes", ""), low_stock=p.get("current_stock", 0) <= p.get("min_stock", 0),
        created_at=p["created_at"], updated_at=p.get("updated_at", p["created_at"]),
    )


@api.get("/admin/products/low-stock", response_model=List[ProductOut])
async def list_low_stock(admin=Depends(get_current_admin)):
    items = await db.products.find(
        {"$expr": {"$lte": ["$current_stock", "$min_stock"]}}, {"_id": 0}
    ).sort("name", 1).to_list(1000)
    return [_product_to_out(p) for p in items]


@api.get("/admin/products", response_model=List[ProductOut])
async def list_products(admin=Depends(get_current_admin)):
    items = await db.products.find({}, {"_id": 0}).sort("name", 1).to_list(2000)
    return [_product_to_out(p) for p in items]


@api.post("/admin/products", response_model=ProductOut)
async def create_product(payload: ProductIn, admin=Depends(get_current_admin)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "sku": payload.sku.strip(),
        "category": payload.category.strip() or "general",
        "unit": payload.unit.strip() or "unidad",
        "cost": payload.cost,
        "price": payload.price,
        "current_stock": payload.current_stock,
        "min_stock": payload.min_stock,
        "notes": payload.notes.strip(),
        "created_at": now,
        "updated_at": now,
    }
    await db.products.insert_one(doc)
    return _product_to_out(doc)


@api.patch("/admin/products/{product_id}", response_model=ProductOut)
async def update_product(product_id: str, payload: ProductIn, background: BackgroundTasks, admin=Depends(get_current_admin)):
    update = {
        "name": payload.name.strip(),
        "sku": payload.sku.strip(),
        "category": payload.category.strip() or "general",
        "unit": payload.unit.strip() or "unidad",
        "cost": payload.cost,
        "price": payload.price,
        "current_stock": payload.current_stock,
        "min_stock": payload.min_stock,
        "notes": payload.notes.strip(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.products.update_one({"id": product_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if p["current_stock"] <= p["min_stock"]:
        background.add_task(emailer.send_low_stock_alert, p)
    return _product_to_out(p)


@api.delete("/admin/products/{product_id}")
async def delete_product(product_id: str, admin=Depends(get_current_admin)):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


async def _record_movement(product: dict, mtype: str, quantity: float, note: str, unit_cost: Optional[float] = None) -> None:
    await db.stock_movements.insert_one({
        "id": str(uuid.uuid4()),
        "product_id": product["id"],
        "product_name": product["name"],
        "type": mtype,
        "quantity": quantity,
        "unit_cost": unit_cost,
        "note": note,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


@api.post("/admin/products/{product_id}/restock", response_model=ProductOut)
async def restock_product(product_id: str, payload: StockMovementIn, admin=Depends(get_current_admin)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Not found")
    new_stock = product["current_stock"] + payload.quantity
    update = {"current_stock": new_stock, "updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.unit_cost is not None and payload.unit_cost > 0:
        update["cost"] = payload.unit_cost
    await db.products.update_one({"id": product_id}, {"$set": update})
    await _record_movement(product, "restock", payload.quantity, payload.note.strip(), payload.unit_cost)
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    return _product_to_out(p)


@api.post("/admin/products/{product_id}/use", response_model=ProductOut)
async def use_product(product_id: str, payload: StockMovementIn, background: BackgroundTasks, admin=Depends(get_current_admin)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Not found")
    new_stock = max(product["current_stock"] - payload.quantity, 0)
    was_above = product["current_stock"] > product["min_stock"]
    await db.products.update_one(
        {"id": product_id},
        {"$set": {"current_stock": new_stock, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    await _record_movement(product, "use", payload.quantity, payload.note.strip())
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if was_above and p["current_stock"] <= p["min_stock"]:
        background.add_task(emailer.send_low_stock_alert, p)
    return _product_to_out(p)


@api.get("/admin/products/{product_id}/movements", response_model=List[StockMovementOut])
async def list_product_movements(product_id: str, admin=Depends(get_current_admin)):
    items = await db.stock_movements.find({"product_id": product_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [StockMovementOut(**i) for i in items]


# ------------------------------------------------------------
# Routes — Suppliers
# ------------------------------------------------------------
@api.get("/admin/suppliers", response_model=List[SupplierOut])
async def list_suppliers(admin=Depends(get_current_admin)):
    items = await db.suppliers.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return [SupplierOut(**i) for i in items]


@api.post("/admin/suppliers", response_model=SupplierOut)
async def create_supplier(payload: SupplierIn, admin=Depends(get_current_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "phone": payload.phone.strip(),
        "rnc": payload.rnc.strip(),
        "notes": payload.notes.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.suppliers.insert_one(doc)
    return SupplierOut(**doc)


@api.patch("/admin/suppliers/{supplier_id}", response_model=SupplierOut)
async def update_supplier(supplier_id: str, payload: SupplierIn, admin=Depends(get_current_admin)):
    update = {
        "name": payload.name.strip(),
        "phone": payload.phone.strip(),
        "rnc": payload.rnc.strip(),
        "notes": payload.notes.strip(),
    }
    res = await db.suppliers.update_one({"id": supplier_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    s = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    return SupplierOut(**s)


@api.delete("/admin/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, admin=Depends(get_current_admin)):
    res = await db.suppliers.delete_one({"id": supplier_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ------------------------------------------------------------
# Routes — Purchase Invoices (compras a proveedores)
# ------------------------------------------------------------
@api.post("/admin/inventory/scan-invoice")
async def scan_purchase_invoice(payload: ScanInvoiceIn, admin=Depends(get_current_admin)):
    try:
        result = await invoice_scanner.scan_invoice(payload.image_base64)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error escaneando: {e}")
    if isinstance(result, dict) and result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    # Try to match supplier by name to suggest
    suggested_supplier_id = None
    name = (result.get("supplier_name") or "").strip().lower()
    if name:
        existing = await db.suppliers.find_one(
            {"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}, {"_id": 0}
        )
        if existing:
            suggested_supplier_id = existing["id"]
    # Try to match each item to existing products by name (fuzzy contains)
    all_products = await db.products.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(2000)
    products_lookup = [(p["id"], p["name"], p["name"].lower()) for p in all_products]
    items = result.get("items", []) or []
    enriched_items = []
    for it in items:
        desc = (it.get("description") or "").strip()
        match_id = None
        desc_l = desc.lower()
        for pid, pname, pname_l in products_lookup:
            if pname_l == desc_l or pname_l in desc_l or desc_l in pname_l:
                match_id = pid
                break
        enriched_items.append({
            "description": desc,
            "quantity": float(it.get("quantity") or 1),
            "unit_price": float(it.get("unit_price") or 0),
            "unit": (it.get("unit") or "unidad").strip() or "unidad",
            "product_id": match_id,
        })
    return {
        "supplier_name": result.get("supplier_name") or "",
        "supplier_phone": result.get("supplier_phone") or "",
        "supplier_rnc": result.get("supplier_rnc") or "",
        "suggested_supplier_id": suggested_supplier_id,
        "invoice_number": result.get("invoice_number") or "",
        "date": result.get("date") or "",
        "currency": result.get("currency") or "DOP",
        "items": enriched_items,
        "subtotal": result.get("subtotal"),
        "total": result.get("total"),
        "notes": result.get("notes") or "",
    }


import re  # noqa: E402  (used by scan_purchase_invoice above)


@api.get("/admin/purchase-invoices", response_model=List[PurchaseInvoiceOut])
async def list_purchase_invoices(admin=Depends(get_current_admin)):
    items = await db.purchase_invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [PurchaseInvoiceOut(**i) for i in items]


@api.post("/admin/purchase-invoices", response_model=PurchaseInvoiceOut)
async def create_purchase_invoice(payload: PurchaseInvoiceIn, background: BackgroundTasks, admin=Depends(get_current_admin)):
    # Resolve / create supplier
    supplier = None
    if payload.supplier_id:
        supplier = await db.suppliers.find_one({"id": payload.supplier_id}, {"_id": 0})
    if not supplier:
        supplier = {
            "id": str(uuid.uuid4()),
            "name": payload.supplier_name.strip(),
            "phone": payload.supplier_phone.strip(),
            "rnc": payload.supplier_rnc.strip(),
            "notes": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.suppliers.insert_one(supplier)

    # Process each item: link to existing product or create a new one, then add stock
    items_out: list = []
    subtotal = 0.0
    low_stock_alerts: list = []
    for it in payload.items:
        qty = float(it.quantity)
        price = float(it.unit_price)
        unit = it.unit or "unidad"
        line_total = round(qty * price, 2)
        subtotal += line_total

        if it.product_id:
            prod = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        else:
            prod = None
        if not prod:
            # Create new product
            prod = {
                "id": str(uuid.uuid4()),
                "name": it.description.strip(),
                "sku": "",
                "category": "Otros",
                "unit": unit,
                "cost": price,
                "price": round(price * 1.4, 2),  # default 40% markup
                "current_stock": 0,
                "min_stock": 0,
                "notes": "",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.products.insert_one(prod)

        # Apply restock
        new_stock = float(prod.get("current_stock", 0)) + qty
        update = {"current_stock": new_stock, "updated_at": datetime.now(timezone.utc).isoformat()}
        if price > 0:
            update["cost"] = price
        await db.products.update_one({"id": prod["id"]}, {"$set": update})
        await _record_movement(prod, "restock", qty, f"Factura {payload.invoice_number or '—'} - {supplier['name']}", price)

        items_out.append({
            "description": it.description.strip(),
            "quantity": qty,
            "unit_price": price,
            "unit": unit,
            "total": line_total,
            "product_id": prod["id"],
            "product_name": prod["name"],
        })

    subtotal = round(subtotal, 2)
    doc = {
        "id": str(uuid.uuid4()),
        "supplier_id": supplier["id"],
        "supplier_name": supplier["name"],
        "supplier_phone": supplier.get("phone", ""),
        "supplier_rnc": supplier.get("rnc", ""),
        "invoice_number": payload.invoice_number.strip(),
        "date": payload.date.strip() or datetime.now(timezone.utc).date().isoformat(),
        "items": items_out,
        "subtotal": subtotal,
        "total": subtotal,
        "notes": payload.notes.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.purchase_invoices.insert_one(doc)
    return PurchaseInvoiceOut(**doc)


@api.delete("/admin/purchase-invoices/{invoice_id}")
async def delete_purchase_invoice(invoice_id: str, admin=Depends(get_current_admin)):
    res = await db.purchase_invoices.delete_one({"id": invoice_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ------------------------------------------------------------
# Routes — Public Chat (Pancho AI) + Live Tracking
# ------------------------------------------------------------
@api.post("/chat", response_model=ChatOut)
async def chat(body: ChatIn):
    sid = body.session_id or str(uuid.uuid4())
    try:
        reply = await chat_service.chat_reply(sid, body.message)
    except Exception as e:
        logger.error("Chat error: %s", e)
        raise HTTPException(status_code=500, detail="No pude responder ahora. Llámanos al " + os.environ.get("BUSINESS_PHONE", ""))
    # Persist messages for analytics
    now = datetime.now(timezone.utc).isoformat()
    await db.chat_messages.insert_many([
        {"id": str(uuid.uuid4()), "session_id": sid, "role": "user", "text": body.message, "created_at": now},
        {"id": str(uuid.uuid4()), "session_id": sid, "role": "assistant", "text": reply, "created_at": now},
    ])
    return ChatOut(reply=reply, session_id=sid)


@api.get("/public/track/{token}")
async def track_appointment(token: str):
    appt = await db.appointments.find_one({"tracking_token": token}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "id": appt["id"],
        "name": appt["name"],
        "service": appt["service"],
        "vehicle": appt["vehicle"],
        "date": appt["date"],
        "time": appt["time"],
        "status": appt["status"],
        "technician_name": appt.get("technician_name"),
        "status_history": appt.get("status_history", []),
        "created_at": appt["created_at"],
    }


# ------------------------------------------------------------
# Routes — Reviews
# ------------------------------------------------------------
@api.get("/reviews", response_model=List[ReviewOut])
async def list_public_reviews():
    items = await db.reviews.find({"status": "approved"}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return [ReviewOut(**i) for i in items]


@api.post("/reviews", response_model=ReviewOut)
async def create_review(payload: ReviewIn):
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "rating": payload.rating,
        "comment": payload.comment.strip(),
        "vehicle": payload.vehicle.strip(),
        "service": payload.service.strip(),
        "appointment_id": payload.appointment_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reviews.insert_one(doc)
    return ReviewOut(**doc)


@api.get("/admin/reviews", response_model=List[ReviewOut])
async def list_admin_reviews(admin=Depends(get_current_admin)):
    items = await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [ReviewOut(**i) for i in items]


@api.patch("/admin/reviews/{review_id}")
async def update_review_status(review_id: str, body: ReviewStatusUpdate, admin=Depends(get_current_admin)):
    res = await db.reviews.update_one({"id": review_id}, {"$set": {"status": body.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api.delete("/admin/reviews/{review_id}")
async def delete_review(review_id: str, admin=Depends(get_current_admin)):
    res = await db.reviews.delete_one({"id": review_id})
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
    await db.technicians.create_index("created_at")
    await db.invoices.create_index("created_at")
    await db.invoices.create_index("appointment_id")
    await db.products.create_index("name")
    await db.stock_movements.create_index("product_id")
    await db.stock_movements.create_index("created_at")
    await db.suppliers.create_index("name")
    await db.purchase_invoices.create_index("created_at")
    await db.chat_messages.create_index("session_id")
    await db.appointments.create_index("tracking_token")
    await db.reviews.create_index("status")
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
gex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)
