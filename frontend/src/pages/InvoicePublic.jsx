import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Printer, ArrowLeft, CheckCircle, Phone, WhatsappLogo } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { BUSINESS } from "@/lib/constants";

const STATUS = {
  draft: { label: "Borrador", color: "#71717A" },
  sent: { label: "Enviada", color: "#0EA5E9" },
  paid: { label: "Pagada", color: "#10B981" },
  cancelled: { label: "Cancelada", color: "#71717A" },
};

const money = (v) => `RD$ ${Number(v || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function InvoicePublic() {
  const { id } = useParams();
  const [inv, setInv] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/public/invoices/${id}`);
        setInv(data);
      } catch {
        setErr("Factura no encontrada");
      }
    })();
  }, [id]);

  if (err) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white grid place-items-center px-5">
        <div className="text-center">
          <div className="font-display text-3xl">404</div>
          <div className="text-white/60 mt-2">{err}</div>
          <Link to="/" className="inline-block mt-6 text-[#E10600]">← Volver al inicio</Link>
        </div>
      </div>
    );
  }
  if (!inv) {
    return <div className="min-h-screen bg-[#0A0A0A] text-white grid place-items-center text-sm uppercase tracking-[0.3em] text-white/40">Cargando…</div>;
  }

  const st = STATUS[inv.status] || STATUS.draft;

  return (
    <div data-testid="invoice-public" className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-black/60 backdrop-blur-md print:hidden">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-white/70 hover:text-white">
            <ArrowLeft size={18} />
            <span className="text-sm">Inicio</span>
          </Link>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full border border-white/15 hover:border-[#E10600] hover:text-white text-white/80">
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-10 print:py-0 print:px-0">
        <div className="rounded-3xl border border-white/10 bg-[#0F0F10] overflow-hidden print:border-0 print:bg-white print:text-black">
          {/* Header */}
          <div className="p-7 sm:p-10 border-b border-white/10 print:border-gray-300 flex flex-col sm:flex-row items-start justify-between gap-6">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 grid place-items-center rounded-md bg-[#E10600] font-display text-2xl text-white">EP</span>
              <div>
                <div className="font-display text-2xl tracking-wider">EL PUNTO AUTOSERVICES</div>
                <div className="text-xs text-white/50 print:text-gray-600">{BUSINESS.address}</div>
                <div className="text-xs text-white/50 print:text-gray-600">Tel: {BUSINESS.phone}</div>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 print:text-gray-500">Factura</div>
              <div className="font-display text-3xl text-[#E10600] mt-1">{inv.number}</div>
              <div className="mt-2">
                <span className="inline-block px-3 py-1 rounded-full text-xs uppercase tracking-[0.16em] border" style={{ color: st.color, borderColor: `${st.color}66`, background: `${st.color}15` }}>
                  {st.label}
                </span>
              </div>
              <div className="text-xs text-white/40 print:text-gray-500 mt-2">{new Date(inv.created_at).toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric" })}</div>
            </div>
          </div>

          {/* Client + Vehicle */}
          <div className="grid sm:grid-cols-2 gap-px bg-white/5 print:bg-gray-200">
            <Section label="Cliente">
              <div className="font-medium">{inv.client_name}</div>
              <div className="text-xs text-white/50 print:text-gray-600">{inv.client_email}</div>
              <div className="text-xs text-white/50 print:text-gray-600">{inv.client_phone}</div>
            </Section>
            <Section label="Vehículo y servicio">
              <div className="font-medium">{inv.vehicle}</div>
              <div className="text-xs text-white/50 print:text-gray-600">{inv.service}</div>
              {inv.technician_name && <div className="text-xs text-white/50 print:text-gray-600 mt-1">Técnico: {inv.technician_name}</div>}
            </Section>
          </div>

          {/* Work performed */}
          {inv.work_performed && (
            <div className="px-7 sm:px-10 py-6 border-t border-white/10 print:border-gray-300">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 print:text-gray-500 mb-2">Trabajo realizado</div>
              <div className="text-sm text-white/85 print:text-black whitespace-pre-wrap leading-relaxed">{inv.work_performed}</div>
            </div>
          )}

          {/* Items */}
          <div className="px-3 sm:px-6 pb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.2em] text-white/40 print:text-gray-500 border-b border-white/10 print:border-gray-300">
                  <th className="text-left py-3 px-4 font-medium">Descripción</th>
                  <th className="text-center py-3 px-2 font-medium w-16">Cant.</th>
                  <th className="text-right py-3 px-4 font-medium w-32">Precio</th>
                  <th className="text-right py-3 px-4 font-medium w-32">Total</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-white/40 py-6">Sin items</td></tr>
                ) : inv.items.map((it, i) => (
                  <tr key={i} className="border-b border-white/5 print:border-gray-200">
                    <td className="py-3 px-4">{it.description}</td>
                    <td className="py-3 px-2 text-center text-white/70 print:text-gray-700">{it.quantity}</td>
                    <td className="py-3 px-4 text-right text-white/70 print:text-gray-700">{money(it.unit_price)}</td>
                    <td className="py-3 px-4 text-right font-medium">{money(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-7 sm:px-10 pb-10 flex justify-end">
            <div className="w-full sm:w-72 space-y-2">
              <Total label="Subtotal" value={money(inv.subtotal)} />
              {inv.discount > 0 && <Total label="Descuento" value={`- ${money(inv.discount)}`} />}
              <Total label={`ITBIS (${Math.round(inv.tax_rate * 100)}%)`} value={money(inv.tax_amount)} />
              <div className="border-t border-[#E10600] pt-3 mt-3 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.25em] text-white/70 print:text-gray-700">Total</span>
                <span className="font-display text-3xl text-[#E10600]">{money(inv.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {inv.notes && (
            <div className="px-7 sm:px-10 py-5 border-t border-white/10 print:border-gray-300 bg-white/[0.02] print:bg-gray-50 text-xs text-white/60 print:text-gray-700">
              <div className="uppercase tracking-[0.25em] text-[10px] text-white/40 print:text-gray-500 mb-1">Notas</div>
              {inv.notes}
            </div>
          )}

          {inv.status === "paid" && (
            <div className="px-7 sm:px-10 py-5 border-t border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3 text-emerald-300 print:text-emerald-700">
              <CheckCircle size={22} weight="fill" />
              <div>
                <div className="font-medium">Factura pagada</div>
                <div className="text-xs opacity-80">¡Gracias por tu pago!</div>
              </div>
            </div>
          )}
        </div>

        {/* Contact CTA */}
        <div className="mt-8 grid sm:grid-cols-2 gap-4 print:hidden">
          <a href={`tel:${BUSINESS.phoneRaw}`} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#0F0F10] hover:border-[#E10600] py-4 text-sm">
            <Phone size={18} weight="bold" /> Llamar al taller
          </a>
          <a href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#0F0F10] hover:border-[#25D366] py-4 text-sm">
            <WhatsappLogo size={18} weight="fill" /> Escribir por WhatsApp
          </a>
        </div>
      </main>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="bg-[#0F0F10] print:bg-white p-6">
      <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 print:text-gray-500 mb-2">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Total({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/60 print:text-gray-600">{label}</span>
      <span className="text-white print:text-black">{value}</span>
    </div>
  );
}
