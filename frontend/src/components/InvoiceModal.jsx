import { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, Plus, Trash, Receipt, EnvelopeSimple, WhatsappLogo, FloppyDisk, Eye, CheckCircle } from "@phosphor-icons/react";
import { api, formatApiErrorDetail } from "@/lib/api";

const money = (v) => `RD$ ${Number(v || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const blankItem = () => ({ description: "", quantity: 1, unit_price: 0 });

export default function InvoiceModal({ appointment, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [workPerformed, setWorkPerformed] = useState("");
  const [items, setItems] = useState([blankItem()]);
  const [taxRate, setTaxRate] = useState(0.18);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/admin/appointments/${appointment.id}/invoice`);
        setInvoice(data);
        setWorkPerformed(data.work_performed || "");
        setItems(data.items.length ? data.items.map((it) => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price })) : [blankItem()]);
        setTaxRate(data.tax_rate);
        setDiscount(data.discount);
        setNotes(data.notes || "");
      } catch {
        // no invoice yet
      } finally {
        setLoading(false);
      }
    })();
  }, [appointment.id]);

  const subtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);
  const taxableBase = Math.max(subtotal - Number(discount || 0), 0);
  const taxAmount = taxableBase * Number(taxRate || 0);
  const total = taxableBase + taxAmount;

  const updateItem = (i, key, val) => {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
  };
  const addItem = () => setItems((arr) => [...arr, blankItem()]);
  const removeItem = (i) => setItems((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));

  const validItems = items.filter((it) => it.description.trim());

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.post(`/admin/appointments/${appointment.id}/invoice`, {
        work_performed: workPerformed,
        items: validItems.map((it) => ({ description: it.description, quantity: Number(it.quantity || 0), unit_price: Number(it.unit_price || 0) })),
        tax_rate: Number(taxRate),
        discount: Number(discount || 0),
        notes,
      });
      setInvoice(data);
      toast.success(invoice ? "Factura actualizada" : "Factura creada");
      onSaved?.();
      return data;
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Error");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveAndSendEmail = async () => {
    const inv = await save();
    if (!inv) return;
    setSending(true);
    try {
      await api.post(`/admin/invoices/${inv.id}/send-email`);
      setInvoice({ ...inv, status: "sent" });
      toast.success("Factura enviada por email");
    } catch (e) {
      toast.error("No se pudo enviar el email");
    } finally {
      setSending(false);
    }
  };

  const sendWhatsApp = async () => {
    let inv = invoice;
    if (!inv) {
      inv = await save();
      if (!inv) return;
    } else if (validItems.length !== invoice.items.length || workPerformed !== invoice.work_performed) {
      inv = await save();
      if (!inv) return;
    }
    const publicUrl = `${window.location.origin}/invoice/${inv.id}`;
    const phone = (appointment.phone || "").replace(/\D/g, "");
    const fullPhone = phone.startsWith("1") ? phone : `1${phone}`;
    const msg = encodeURIComponent(
      `Hola ${appointment.name.split(" ")[0]}, te compartimos la factura ${inv.number} por el servicio en tu ${appointment.vehicle}.\n\nTotal: RD$${inv.total.toFixed(2)}\n\nPuedes verla aquí:\n${publicUrl}\n\nEl Punto Autoservices`
    );
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
    try {
      await api.patch(`/admin/invoices/${inv.id}/status`, { status: "sent" });
      setInvoice({ ...inv, status: "sent" });
    } catch {}
  };

  const markPaid = async () => {
    if (!invoice) return;
    try {
      await api.patch(`/admin/invoices/${invoice.id}/status`, { status: "paid" });
      setInvoice({ ...invoice, status: "paid" });
      toast.success("Marcada como pagada");
      onSaved?.();
    } catch { toast.error("Error"); }
  };

  const openPublic = () => {
    if (!invoice) return;
    window.open(`/invoice/${invoice.id}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto" data-testid="invoice-modal">
      <div className="relative w-full max-w-4xl my-8 rounded-2xl border border-white/10 bg-[#0F0F10] text-white max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 grid place-items-center rounded-lg bg-[#E10600]/15 text-[#E10600]">
              <Receipt size={22} weight="duotone" />
            </div>
            <div>
              <h2 className="font-display text-2xl tracking-wide">
                {invoice ? `Factura ${invoice.number}` : "Nueva Factura"}
              </h2>
              <div className="text-xs text-white/50">
                {appointment.name} · {appointment.vehicle} · {appointment.service}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white" data-testid="invoice-close"><X size={22} /></button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-white/40 text-sm uppercase tracking-[0.3em]">Cargando…</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Status */}
              {invoice && (
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill status={invoice.status} />
                  {invoice.sent_at && <span className="text-xs text-white/40">Enviada: {new Date(invoice.sent_at).toLocaleString()}</span>}
                  {invoice.paid_at && <span className="text-xs text-emerald-400">Pagada: {new Date(invoice.paid_at).toLocaleString()}</span>}
                </div>
              )}

              {/* Work performed */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 block mb-2">Trabajo realizado por el técnico</label>
                <textarea
                  data-testid="invoice-work"
                  value={workPerformed}
                  onChange={(e) => setWorkPerformed(e.target.value)}
                  rows={4}
                  placeholder="Ej. Cambio de aceite sintético 5W30. Reemplazo de filtro de aire, filtro de aceite y filtro de cabina. Revisión de niveles. Rotación de neumáticos."
                  className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg px-4 py-3 text-sm resize-none placeholder:text-white/30"
                />
              </div>

              {/* Items table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] uppercase tracking-[0.25em] text-white/40">Items facturables</label>
                  <button onClick={addItem} data-testid="add-item" className="text-xs text-[#E10600] hover:text-white inline-flex items-center gap-1">
                    <Plus size={14} weight="bold" /> Agregar item
                  </button>
                </div>
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[#161617] text-[10px] uppercase tracking-[0.18em] text-white/40">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">Descripción</th>
                        <th className="text-center py-2 px-2 font-medium w-20">Cant.</th>
                        <th className="text-right py-2 px-3 font-medium w-32">Precio</th>
                        <th className="text-right py-2 px-3 font-medium w-32">Total</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => {
                        const tot = Number(it.quantity || 0) * Number(it.unit_price || 0);
                        return (
                          <tr key={i} className="border-t border-white/5">
                            <td className="px-3 py-2">
                              <input
                                data-testid={`item-desc-${i}`}
                                value={it.description}
                                onChange={(e) => updateItem(i, "description", e.target.value)}
                                placeholder="Ej. Aceite Mobil 1 5W-30"
                                className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-md px-2 py-1.5 text-sm placeholder:text-white/30"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                data-testid={`item-qty-${i}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={it.quantity}
                                onChange={(e) => updateItem(i, "quantity", e.target.value)}
                                className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-md px-2 py-1.5 text-sm text-center"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                data-testid={`item-price-${i}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={it.unit_price}
                                onChange={(e) => updateItem(i, "unit_price", e.target.value)}
                                className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-md px-2 py-1.5 text-sm text-right"
                              />
                            </td>
                            <td className="px-3 py-2 text-right text-white/90">{money(tot)}</td>
                            <td className="px-2 py-2 text-center">
                              <button onClick={() => removeItem(i)} className="text-white/30 hover:text-[#E10600]" data-testid={`item-remove-${i}`}>
                                <Trash size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tax + discount + totals */}
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 block mb-1">ITBIS</label>
                    <select
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg px-3 py-2.5 text-sm"
                    >
                      <option value={0.18}>18% (RD estándar)</option>
                      <option value={0}>Sin impuesto</option>
                      <option value={0.16}>16%</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 block mb-1">Descuento (RD$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 block mb-1">Notas (opcional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Garantía, métodos de pago aceptados…"
                      className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg px-3 py-2.5 text-sm resize-none placeholder:text-white/30"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5 space-y-3 h-fit">
                  <Row label="Subtotal" value={money(subtotal)} />
                  {Number(discount) > 0 && <Row label="Descuento" value={`- ${money(discount)}`} />}
                  <Row label={`ITBIS (${Math.round(taxRate * 100)}%)`} value={money(taxAmount)} />
                  <div className="border-t border-[#E10600] pt-3 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.25em] text-white/70">Total</span>
                    <span className="font-display text-3xl text-[#E10600]" data-testid="invoice-total">{money(total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="border-t border-white/10 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 bg-[#0A0A0A]/40">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={save}
                  disabled={saving}
                  data-testid="invoice-save"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/15 hover:border-white/40 text-sm disabled:opacity-50"
                >
                  <FloppyDisk size={16} /> {saving ? "Guardando…" : invoice ? "Guardar cambios" : "Guardar borrador"}
                </button>
                {invoice && (
                  <button onClick={openPublic} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/15 hover:border-white/40 text-sm">
                    <Eye size={16} /> Vista previa
                  </button>
                )}
                {invoice && invoice.status !== "paid" && (
                  <button onClick={markPaid} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 text-sm" data-testid="invoice-mark-paid">
                    <CheckCircle size={16} /> Marcar como pagada
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={sendWhatsApp}
                  data-testid="invoice-send-whatsapp"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#25D366] text-white text-sm hover:opacity-90"
                >
                  <WhatsappLogo size={16} weight="fill" /> Enviar por WhatsApp
                </button>
                <button
                  onClick={saveAndSendEmail}
                  disabled={sending}
                  data-testid="invoice-send-email"
                  className="inline-flex items-center gap-2 btn-red text-white text-sm px-4 py-2.5 rounded-full disabled:opacity-60"
                >
                  <EnvelopeSimple size={16} /> {sending ? "Enviando…" : "Enviar por email"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/60">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    draft: { label: "Borrador", color: "#71717A" },
    sent: { label: "Enviada", color: "#0EA5E9" },
    paid: { label: "Pagada", color: "#10B981" },
    cancelled: { label: "Cancelada", color: "#71717A" },
  };
  const s = map[status] || map.draft;
  return (
    <span className="inline-block px-3 py-1 rounded-full text-xs uppercase tracking-[0.16em] border" style={{ color: s.color, borderColor: `${s.color}66`, background: `${s.color}15` }}>
      {s.label}
    </span>
  );
}
