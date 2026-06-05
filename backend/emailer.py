"""Resend email helpers for El Punto Autoservices."""
import os
import asyncio
import logging
from typing import Optional

import resend

logger = logging.getLogger("elpunto.email")

resend.api_key = os.environ.get("RESEND_API_KEY", "")

SENDER = os.environ.get("SENDER_EMAIL", "El Punto Autoservices <onboarding@resend.dev>")
ADMIN_NOTIFY = os.environ.get("NOTIFY_ADMIN_EMAIL", "")
BIZ_NAME = os.environ.get("BUSINESS_NAME", "El Punto Autoservices")
BIZ_PHONE = os.environ.get("BUSINESS_PHONE", "(809) 619-8595")
BIZ_ADDRESS = os.environ.get("BUSINESS_ADDRESS", "Santo Domingo, R.D.")

STATUS_LABEL = {
    "new": ("Recibida", "Received"),
    "in_progress": ("En progreso", "In progress"),
    "completed": ("Completada", "Completed"),
    "cancelled": ("Cancelada", "Cancelled"),
    "contacted": ("Contactado", "Contacted"),
}

STATUS_COLOR = {
    "new": "#E10600",
    "in_progress": "#F59E0B",
    "completed": "#10B981",
    "cancelled": "#71717A",
    "contacted": "#0EA5E9",
}


def _wrapper(title: str, intro: str, content_html: str, footer_note: str = "") -> str:
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#111;border:1px solid #222;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:24px 28px;border-bottom:1px solid #222;">
        <table role="presentation" width="100%"><tr>
          <td style="font-family:'Bebas Neue',Arial,sans-serif;letter-spacing:0.12em;font-size:22px;color:#fff;">
            <span style="display:inline-block;width:28px;height:28px;background:#E10600;color:#fff;text-align:center;line-height:28px;border-radius:6px;font-weight:700;font-size:13px;margin-right:10px;vertical-align:middle;">EP</span>
            EL PUNTO AUTOSERVICES
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:32px 28px 12px;">
        <h1 style="margin:0 0 8px;font-size:24px;color:#fff;font-weight:700;letter-spacing:-0.01em;">{title}</h1>
        <p style="margin:0;color:#A1A1AA;font-size:15px;line-height:1.55;">{intro}</p>
      </td></tr>
      <tr><td style="padding:18px 28px 8px;">
        {content_html}
      </td></tr>
      <tr><td style="padding:24px 28px 28px;">
        <p style="margin:0 0 6px;color:#A1A1AA;font-size:13px;line-height:1.6;">{footer_note}</p>
        <p style="margin:14px 0 0;color:#71717A;font-size:12px;line-height:1.6;">
          {BIZ_NAME} · {BIZ_ADDRESS}<br>
          Tel: <a href="tel:+18096198595" style="color:#E10600;text-decoration:none;">{BIZ_PHONE}</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""


def _info_row(label: str, value: str) -> str:
    return (
        f'<tr><td style="padding:10px 16px;border-bottom:1px solid #1f1f1f;color:#71717A;font-size:12px;'
        f'text-transform:uppercase;letter-spacing:0.12em;width:140px;">{label}</td>'
        f'<td style="padding:10px 16px;border-bottom:1px solid #1f1f1f;color:#fff;font-size:14px;">{value}</td></tr>'
    )


def _details_table(rows_html: str) -> str:
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#0A0A0A;border:1px solid #222;border-radius:10px;overflow:hidden;">'
        f'{rows_html}</table>'
    )


def _status_pill(status: str) -> str:
    es, en = STATUS_LABEL.get(status, (status, status))
    color = STATUS_COLOR.get(status, "#E10600")
    return (
        f'<span style="display:inline-block;padding:6px 14px;border-radius:999px;'
        f'background:{color}22;color:{color};border:1px solid {color}66;'
        f'font-size:12px;text-transform:uppercase;letter-spacing:0.16em;font-weight:600;">{es} · {en}</span>'
    )


async def _send(to: str, subject: str, html: str) -> Optional[str]:
    if not resend.api_key:
        logger.warning("RESEND_API_KEY not set, skipping email")
        return None
    if not to:
        return None
    try:
        params = {"from": SENDER, "to": [to], "subject": subject, "html": html}
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info("Email sent to %s (id=%s)", to, result.get("id") if isinstance(result, dict) else result)
        return result.get("id") if isinstance(result, dict) else None
    except Exception as e:
        logger.error("Resend send failed for %s: %s", to, e)
        return None


# ---------- APPOINTMENT EMAILS ----------
async def send_appointment_created_client(appt: dict) -> None:
    rows = (
        _info_row("Servicio / Service", appt["service"])
        + _info_row("Vehículo / Vehicle", appt["vehicle"])
        + _info_row("Fecha / Date", appt["date"])
        + _info_row("Hora / Time", appt["time"])
        + (_info_row("Notas / Notes", appt["notes"]) if appt.get("notes") else "")
    )
    base = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
    track_link = f"{base}/track/{appt['tracking_token']}" if appt.get("tracking_token") and base else ""
    track_btn = (
        f'<p style="margin:18px 0 0;text-align:center;"><a href="{track_link}" '
        f'style="display:inline-block;background:#E10600;color:#fff;text-decoration:none;'
        f'padding:14px 28px;border-radius:999px;font-weight:600;font-size:14px;letter-spacing:0.05em;">'
        f'🔴 Ver estado de mi cita en vivo</a></p>'
    ) if track_link else ""
    html = _wrapper(
        title=f"¡Hola {appt['name'].split()[0]}! Recibimos tu solicitud.",
        intro=(
            "Gracias por confiar en El Punto Autoservices. Tu cita está <b style='color:#fff;'>registrada</b> "
            "y un asesor te contactará en breve para confirmarla.<br><br>"
            "<span style='color:#71717A;'>Thank you for choosing us. Your appointment is registered and an advisor will contact you soon to confirm.</span>"
        ),
        content_html=_details_table(rows) + track_btn,
        footer_note="¿Dudas? Llámanos o escríbenos por WhatsApp.<br>Questions? Call us or message us on WhatsApp.",
    )
    await _send(appt["email"], "Hemos recibido tu reserva — El Punto Autoservices", html)


async def send_appointment_created_admin(appt: dict) -> None:
    if not ADMIN_NOTIFY:
        return
    rows = (
        _info_row("Cliente", appt["name"])
        + _info_row("Email", appt["email"])
        + _info_row("Teléfono", appt["phone"])
        + _info_row("Servicio", appt["service"])
        + _info_row("Vehículo", appt["vehicle"])
        + _info_row("Fecha", appt["date"])
        + _info_row("Hora", appt["time"])
        + (_info_row("Notas", appt["notes"]) if appt.get("notes") else "")
    )
    html = _wrapper(
        title="Nueva reserva recibida",
        intro="Un cliente acaba de solicitar una cita desde el sitio web.",
        content_html=_details_table(rows),
        footer_note="Ingresa al panel admin para confirmar o actualizar el estado.",
    )
    await _send(ADMIN_NOTIFY, f"Nueva cita: {appt['name']} — {appt['service']}", html)


async def send_appointment_status_update(appt: dict, new_status: str) -> None:
    rows = (
        _info_row("Servicio", appt["service"])
        + _info_row("Vehículo", appt["vehicle"])
        + _info_row("Fecha", appt["date"])
        + _info_row("Hora", appt["time"])
        + _info_row("Estado", _status_pill(new_status))
    )
    es, en = STATUS_LABEL.get(new_status, (new_status, new_status))
    title_map = {
        "in_progress": ("Tu cita está en progreso", "Your appointment is in progress"),
        "completed": ("Tu cita fue completada", "Your appointment is completed"),
        "cancelled": ("Tu cita fue cancelada", "Your appointment was cancelled"),
        "new": ("Tu cita fue actualizada", "Your appointment was updated"),
    }
    t_es, t_en = title_map.get(new_status, ("Actualización de tu cita", "Appointment update"))
    intro_map = {
        "in_progress": "Nuestro equipo está trabajando en tu vehículo. Te avisamos cuando esté listo.",
        "completed": "¡Tu vehículo está listo! Gracias por confiar en nosotros. Esperamos verte pronto de nuevo.",
        "cancelled": "Tu cita ha sido cancelada. Si necesitas reagendar, contáctanos cuando gustes.",
        "new": "Hemos actualizado el estado de tu cita.",
    }
    html = _wrapper(
        title=f"{t_es}",
        intro=(
            f"<b style='color:#fff;'>{appt['name'].split()[0]}</b>, {intro_map.get(new_status, '')}<br><br>"
            f"<span style='color:#71717A;'>{t_en}</span>"
        ),
        content_html=_details_table(rows),
        footer_note="Si tienes alguna pregunta, no dudes en contactarnos.",
    )
    await _send(appt["email"], f"Actualización de tu cita — {es}", html)


# ---------- CONTACT EMAILS ----------
async def send_contact_created_client(contact: dict) -> None:
    rows = (
        _info_row("Mensaje", contact["message"].replace("\n", "<br>"))
        + _info_row("Teléfono", contact["phone"])
    )
    html = _wrapper(
        title=f"Hola {contact['name'].split()[0]}, recibimos tu mensaje",
        intro=(
            "Gracias por contactarnos. Un asesor te responderá en menos de 24 horas.<br><br>"
            "<span style='color:#71717A;'>Thanks for reaching out. An advisor will get back to you within 24 hours.</span>"
        ),
        content_html=_details_table(rows),
    )
    await _send(contact["email"], "Recibimos tu mensaje — El Punto Autoservices", html)


async def send_contact_created_admin(contact: dict) -> None:
    if not ADMIN_NOTIFY:
        return
    rows = (
        _info_row("Nombre", contact["name"])
        + _info_row("Email", contact["email"])
        + _info_row("Teléfono", contact["phone"])
        + _info_row("Mensaje", contact["message"].replace("\n", "<br>"))
    )
    html = _wrapper(
        title="Nuevo mensaje de contacto",
        intro="Un visitante envió un mensaje desde el sitio web.",
        content_html=_details_table(rows),
    )
    await _send(ADMIN_NOTIFY, f"Nuevo mensaje: {contact['name']}", html)


# ---------- INVOICE EMAILS ----------
def _format_money(v: float) -> str:
    return f"RD${v:,.2f}"


def _invoice_items_html(items: list) -> str:
    rows = ""
    for it in items:
        rows += (
            f'<tr>'
            f'<td style="padding:10px 14px;border-bottom:1px solid #1f1f1f;color:#fff;font-size:13px;">{it["description"]}</td>'
            f'<td style="padding:10px 14px;border-bottom:1px solid #1f1f1f;color:#A1A1AA;font-size:13px;text-align:center;">{it["quantity"]:g}</td>'
            f'<td style="padding:10px 14px;border-bottom:1px solid #1f1f1f;color:#A1A1AA;font-size:13px;text-align:right;">{_format_money(it["unit_price"])}</td>'
            f'<td style="padding:10px 14px;border-bottom:1px solid #1f1f1f;color:#fff;font-size:13px;text-align:right;font-weight:600;">{_format_money(it["total"])}</td>'
            f'</tr>'
        )
    return rows


async def send_invoice_email(invoice: dict, public_url: str) -> None:
    items_rows = _invoice_items_html(invoice["items"]) or (
        '<tr><td colspan="4" style="padding:14px;color:#71717A;font-size:13px;text-align:center;">Sin items</td></tr>'
    )
    discount_row = ""
    if invoice.get("discount", 0) > 0:
        discount_row = (
            f'<tr><td colspan="3" style="padding:6px 14px;color:#A1A1AA;font-size:13px;text-align:right;">Descuento</td>'
            f'<td style="padding:6px 14px;color:#fff;font-size:13px;text-align:right;">- {_format_money(invoice["discount"])}</td></tr>'
        )
    work_block = ""
    if invoice.get("work_performed"):
        work_block = (
            '<div style="margin:18px 0 10px;padding:14px 16px;background:#0A0A0A;border:1px solid #222;border-radius:10px;">'
            '<div style="color:#71717A;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;margin-bottom:6px;">Trabajo realizado</div>'
            f'<div style="color:#fff;font-size:13px;line-height:1.6;white-space:pre-wrap;">{invoice["work_performed"]}</div>'
            '</div>'
        )

    content = f'''
{work_block}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;border:1px solid #222;border-radius:10px;overflow:hidden;margin-top:8px;">
  <thead>
    <tr style="background:#161617;">
      <th style="padding:10px 14px;text-align:left;color:#71717A;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;font-weight:600;">Descripción</th>
      <th style="padding:10px 14px;text-align:center;color:#71717A;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;font-weight:600;">Cant.</th>
      <th style="padding:10px 14px;text-align:right;color:#71717A;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;font-weight:600;">Precio</th>
      <th style="padding:10px 14px;text-align:right;color:#71717A;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;font-weight:600;">Total</th>
    </tr>
  </thead>
  <tbody>{items_rows}</tbody>
  <tfoot>
    <tr><td colspan="3" style="padding:8px 14px;color:#A1A1AA;font-size:13px;text-align:right;border-top:1px solid #222;">Subtotal</td>
        <td style="padding:8px 14px;color:#fff;font-size:13px;text-align:right;border-top:1px solid #222;">{_format_money(invoice["subtotal"])}</td></tr>
    {discount_row}
    <tr><td colspan="3" style="padding:6px 14px;color:#A1A1AA;font-size:13px;text-align:right;">ITBIS ({invoice["tax_rate"]*100:.0f}%)</td>
        <td style="padding:6px 14px;color:#fff;font-size:13px;text-align:right;">{_format_money(invoice["tax_amount"])}</td></tr>
    <tr><td colspan="3" style="padding:14px 14px 16px;color:#fff;font-size:15px;text-align:right;font-weight:700;border-top:1px solid #E10600;">TOTAL</td>
        <td style="padding:14px 14px 16px;color:#E10600;font-size:18px;text-align:right;font-weight:700;border-top:1px solid #E10600;font-family:'Bebas Neue',Arial,sans-serif;letter-spacing:0.02em;">{_format_money(invoice["total"])}</td></tr>
  </tfoot>
</table>
<p style="margin:18px 0 0;text-align:center;">
  <a href="{public_url}" style="display:inline-block;background:#E10600;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:14px;letter-spacing:0.05em;">Ver factura completa →</a>
</p>
'''
    info_rows = (
        _info_row("Factura", f"<b style='color:#fff;'>{invoice['number']}</b>")
        + _info_row("Cliente", invoice["client_name"])
        + _info_row("Vehículo", invoice["vehicle"])
        + _info_row("Servicio", invoice["service"])
        + (_info_row("Técnico", invoice["technician_name"]) if invoice.get("technician_name") else "")
    )

    html = _wrapper(
        title=f"Factura {invoice['number']}",
        intro=(
            f"Hola <b style='color:#fff;'>{invoice['client_name'].split()[0]}</b>, gracias por confiar en nosotros. "
            "Adjuntamos el detalle del trabajo realizado en tu vehículo."
        ),
        content_html=_details_table(info_rows) + content,
        footer_note="Si tienes alguna duda sobre esta factura, contáctanos por teléfono o WhatsApp.",
    )

    await _send(invoice["client_email"], f"Factura {invoice['number']} — El Punto Autoservices", html)
    if ADMIN_NOTIFY:
        await _send(ADMIN_NOTIFY, f"[Copia Admin] Factura enviada — {invoice['number']}", html)


# ---------- INVENTORY ALERTS ----------
async def send_low_stock_alert(product: dict) -> None:
    if not ADMIN_NOTIFY:
        return
    rows = (
        _info_row("Producto", f"<b style='color:#fff;'>{product['name']}</b>")
        + (_info_row("SKU", product["sku"]) if product.get("sku") else "")
        + _info_row("Categoría", product.get("category", "general"))
        + _info_row("Stock actual", f"<span style='color:#FF6B65;font-weight:700;'>{product['current_stock']:g} {product.get('unit','')}</span>")
        + _info_row("Mínimo", f"{product['min_stock']:g} {product.get('unit','')}")
    )
    intro = (
        "⚠️ <b style='color:#FF6B65;'>El stock está por debajo del mínimo configurado.</b> "
        "Considera realizar una compra para reabastecer este producto."
    )
    html = _wrapper(
        title="Alerta de inventario bajo",
        intro=intro,
        content_html=_details_table(rows),
        footer_note="Esta alerta se envió automáticamente desde tu panel de inventario.",
    )
    await _send(ADMIN_NOTIFY, f"🚨 Stock bajo: {product['name']}", html)
