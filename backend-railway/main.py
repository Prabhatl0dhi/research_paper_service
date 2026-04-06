"""
main.py — PaperFormat FastAPI Backend
Deploy on Railway. All data stored in SQLite (orders.db).
File uploads saved to ./uploads/ directory.
"""

import os
import uuid
import secrets
import base64
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import (
    FastAPI, UploadFile, File, Form, HTTPException,
    Depends, status, Request
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import databases
import sqlalchemy

# ── Config ─────────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./orders.db")
UPLOAD_DIR   = Path(os.getenv("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Admin credentials — set via Railway env vars or use these defaults
ADMIN_USER   = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS   = os.getenv("ADMIN_PASS", "paperformat2024")

# Allowed file types and max size (10 MB)
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
MAX_FILE_SIZE      = 10 * 1024 * 1024  # 10 MB

# ── Database setup ──────────────────────────────────────────────────────────────

database = databases.Database(DATABASE_URL)
metadata = sqlalchemy.MetaData()

orders_table = sqlalchemy.Table(
    "orders",
    metadata,
    sqlalchemy.Column("id",               sqlalchemy.Integer, primary_key=True, autoincrement=True),
    sqlalchemy.Column("full_name",         sqlalchemy.String(200), nullable=False),
    sqlalchemy.Column("phone",             sqlalchemy.String(50),  nullable=False),
    sqlalchemy.Column("topic",             sqlalchemy.String(500), nullable=False),
    sqlalchemy.Column("formatting_type",   sqlalchemy.String(100), nullable=True),
    sqlalchemy.Column("instructions",      sqlalchemy.Text,        nullable=True),
    sqlalchemy.Column("file_url",          sqlalchemy.String(500), nullable=True),
    sqlalchemy.Column("original_filename", sqlalchemy.String(300), nullable=True),
    sqlalchemy.Column("status",            sqlalchemy.String(20),  default="pending"),
    sqlalchemy.Column("created_at",        sqlalchemy.DateTime,    default=datetime.utcnow),
)

engine = sqlalchemy.create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
metadata.create_all(engine)

# ── App setup ───────────────────────────────────────────────────────────────────

app = FastAPI(title="PaperFormat API", version="1.0.0")

# CORS — allow all origins for Vercel frontend (lock this down in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files statically
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ── Auth ────────────────────────────────────────────────────────────────────────

def verify_basic_auth(request: Request):
    """
    Validates HTTP Basic Auth header for admin endpoints.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Basic "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Basic"},
        )
    try:
        decoded = base64.b64decode(auth_header[6:]).decode("utf-8")
        username, password = decoded.split(":", 1)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not (secrets.compare_digest(username, ADMIN_USER) and
            secrets.compare_digest(password, ADMIN_PASS)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

# ── Schemas ─────────────────────────────────────────────────────────────────────

class StatusUpdate(BaseModel):
    status: str  # "pending" or "completed"

# ── Lifecycle ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

# ── Endpoints ───────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "PaperFormat API"}

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}


@app.post("/orders", tags=["Orders"], status_code=201)
async def create_order(
    full_name:       str  = Form(...),
    phone:           str  = Form(...),
    topic:           str  = Form(...),
    formatting_type: Optional[str]        = Form(None),
    instructions:    Optional[str]        = Form(None),
    draft_file:      Optional[UploadFile] = File(None),
):
    """
    Receive a new formatting order. Mandatory: full_name, phone, topic.
    Optional: formatting_type, instructions, draft_file.
    """

    # ── Basic validation ──
    if not full_name.strip():
        raise HTTPException(status_code=422, detail="full_name is required.")
    if not phone.strip():
        raise HTTPException(status_code=422, detail="phone is required.")
    if not topic.strip():
        raise HTTPException(status_code=422, detail="topic is required.")

    # ── Handle optional file upload ──
    file_url          = None
    original_filename = None

    if draft_file and draft_file.filename:
        suffix = Path(draft_file.filename).suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=422,
                detail=f"File type '{suffix}' not allowed. Use .pdf, .docx, or .txt."
            )

        # Read and size-check
        contents = await draft_file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File exceeds 10 MB limit.")

        # Save with a unique name to avoid collisions
        safe_name = f"{uuid.uuid4().hex}{suffix}"
        dest_path = UPLOAD_DIR / safe_name
        dest_path.write_bytes(contents)

        original_filename = draft_file.filename
        file_url          = f"/uploads/{safe_name}"

    # ── Insert into DB ──
    query = orders_table.insert().values(
        full_name         = full_name.strip(),
        phone             = phone.strip(),
        topic             = topic.strip(),
        formatting_type   = formatting_type.strip() if formatting_type else None,
        instructions      = instructions.strip()    if instructions    else None,
        file_url          = file_url,
        original_filename = original_filename,
        status            = "pending",
        created_at        = datetime.utcnow(),
    )
    order_id = await database.execute(query)

    return {
        "id":      order_id,
        "message": "Order received successfully.",
        "status":  "pending",
    }


@app.get("/orders", tags=["Orders"])
async def list_orders(_: None = Depends(verify_basic_auth)):
    """
    Return all orders. Requires Basic Auth.
    """
    query  = orders_table.select().order_by(orders_table.c.created_at.desc())
    rows   = await database.fetch_all(query)
    result = []
    for row in rows:
        d = dict(row)
        # Serialize datetime to ISO string
        if isinstance(d.get("created_at"), datetime):
            d["created_at"] = d["created_at"].isoformat()
        result.append(d)
    return result


@app.patch("/orders/{order_id}/status", tags=["Orders"])
async def update_order_status(
    order_id: int,
    body:     StatusUpdate,
    _:        None = Depends(verify_basic_auth),
):
    """
    Update the status of an order. Requires Basic Auth.
    Accepted values: 'pending', 'completed'
    """
    if body.status not in ("pending", "completed"):
        raise HTTPException(status_code=422, detail="status must be 'pending' or 'completed'.")

    # Check order exists
    select_query = orders_table.select().where(orders_table.c.id == order_id)
    order = await database.fetch_one(select_query)
    if not order:
        raise HTTPException(status_code=404, detail=f"Order #{order_id} not found.")

    update_query = (
        orders_table.update()
        .where(orders_table.c.id == order_id)
        .values(status=body.status)
    )
    await database.execute(update_query)

    return {"id": order_id, "status": body.status, "message": "Status updated."}


@app.get("/orders/{order_id}", tags=["Orders"])
async def get_order(order_id: int, _: None = Depends(verify_basic_auth)):
    """
    Fetch a single order by ID. Requires Basic Auth.
    """
    query = orders_table.select().where(orders_table.c.id == order_id)
    row   = await database.fetch_one(query)
    if not row:
        raise HTTPException(status_code=404, detail=f"Order #{order_id} not found.")
    d = dict(row)
    if isinstance(d.get("created_at"), datetime):
        d["created_at"] = d["created_at"].isoformat()
    return d


@app.delete("/orders/{order_id}", tags=["Orders"])
async def delete_order(order_id: int, _: None = Depends(verify_basic_auth)):
    """
    Delete an order by ID. Requires Basic Auth.
    """
    # Check if order exists
    select_query = orders_table.select().where(orders_table.c.id == order_id)
    order = await database.fetch_one(select_query)
    
    if not order:
        raise HTTPException(status_code=404, detail=f"Order #{order_id} not found.")

    # Optional: Delete the physical file from /uploads if it exists
    if order["file_url"]:
        file_path = UPLOAD_DIR / Path(order["file_url"]).name
        if file_path.exists():
            file_path.unlink()

    # Delete from DB
    delete_query = orders_table.delete().where(orders_table.c.id == order_id)
    await database.execute(delete_query)

    return {"id": order_id, "message": "Order and associated files deleted."}
