"""LLM-powered invoice OCR/parsing using emergentintegrations."""
import os
import json
import logging
import re
import uuid
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

logger = logging.getLogger("elpunto.scanner")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

SYSTEM_PROMPT = """You are an expert at reading purchase invoices (facturas de compra) from
Dominican Republic auto parts suppliers. The user will send an image of an invoice.

Extract the data and return ONLY valid JSON (no markdown, no commentary) matching this exact schema:

{
  "supplier_name": string,         // company / supplier name issuing the invoice
  "supplier_phone": string|null,   // phone if present
  "supplier_rnc": string|null,     // RNC / tax id if present
  "invoice_number": string|null,   // # factura
  "date": string|null,             // YYYY-MM-DD if you can infer
  "currency": "DOP"|"USD"|null,
  "items": [
    {
      "description": string,       // product name as on invoice
      "quantity": number,          // unit count (default 1)
      "unit_price": number,        // price per unit in numbers (no currency symbol)
      "total": number,             // line total (qty * unit_price). If only one of unit_price/total is present, compute the other.
      "unit": string|null          // e.g. "litro", "unidad", "galon", "kg" — infer from description if obvious
    }
  ],
  "subtotal": number|null,
  "tax": number|null,
  "total": number|null,
  "notes": string|null             // anything important (payment terms, condition)
}

Rules:
- Currency values must be plain numbers (e.g. 1450.50 — never "RD$1,450.50").
- If the image is NOT an invoice / unreadable, return {"error": "<reason>"} as JSON.
- Translate common Spanish abbreviations (e.g. "Pza" → unit, "Lt" → litro).
- Use 0.18 ITBIS only if shown on invoice. Don't invent numbers.
- Return STRICT JSON only, no prose, no code fences.
"""


def _strip_json(raw: str) -> str:
    """Remove markdown fences if model returns them."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
    return raw.strip()


async def scan_invoice(image_base64: str) -> dict:
    """Send an invoice image to GPT-5.4 vision and return parsed JSON."""
    if not EMERGENT_LLM_KEY:
        raise RuntimeError("EMERGENT_LLM_KEY not set")
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"invoice-scan-{uuid.uuid4()}",
        system_message=SYSTEM_PROMPT,
    ).with_model("openai", "gpt-4o")
    msg = UserMessage(
        text="Read this purchase invoice and return the JSON.",
        file_contents=[ImageContent(image_base64=image_base64)],
    )
    try:
        raw = await chat.send_message(msg)
    except Exception as e:
        logger.error("Scanner LLM error: %s", e)
        raise ValueError(f"Error de la AI: {e}")
    raw = raw if isinstance(raw, str) else str(raw)
    cleaned = _strip_json(raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to find JSON object in text
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if m:
            return json.loads(m.group(0))
        logger.error("Invoice scan returned invalid JSON: %s", cleaned[:500])
        raise ValueError("La AI no pudo leer la factura. Inténtalo con una foto más clara.")
