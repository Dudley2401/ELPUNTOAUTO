import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle, CircleNotch, Car, Calendar, User, Phone, WhatsappLogo, ArrowLeft, Sparkle,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { BUSINESS } from "@/lib/constants";

const STEPS = [
  { id: "new", label: "Recibida", desc: "Tu cita fue recibida" },
  { id: "in_progress", label: "En progreso", desc: "El técnico está trabajando" },
  { id: "completed", label: "Lista", desc: "Tu vehículo está listo" },
];

const STATUS_LABELS = {
  new: { label: "Recibida", color: "#E10600" },
  in_progress: { label: "En progreso", color: "#F59E0B" },
  completed: { label: "Completada", color: "#10B981" },
  cancelled: { label: "Cancelada", color: "#71717A" },
};

export default function TrackAppointment() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await api.get(`/public/track/${token}`);
        if (!cancelled) setData(data);
      } catch {
        if (!cancelled) setErr("Cita no encontrada");
      }
    };
    load();
    const id = setInterval(load, 15000); // refresh every 15s
    return () => { cancelled = true; clearInterval(id); };
  }, [token]);

  if (err) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white grid place-items-center px-5">
        <div className="text-center">
          <div className="font-display text-4xl">404</div>
          <div className="text-white/60 mt-2">{err}</div>
          <Link to="/" className="inline-block mt-6 text-[#E10600]">← Volver al inicio</Link>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen bg-[#0A0A0A] text-white grid place-items-center text-sm uppercase tracking-[0.3em] text-white/40">Cargando…</div>;
  }

  const stepIndex = STEPS.findIndex((s) => s.id === data.status);
  const isCancelled = data.status === "cancelled";
  const st = STATUS_LABELS[data.status] || STATUS_LABELS.new;

  return (
    <div data-testid="track-page" className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-black/60 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-white/70 hover:text-white">
            <ArrowLeft size={18} />
            <span className="text-sm">Inicio</span>
          </Link>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            Live
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10">
        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#161617] to-[#0F0F10] p-7 sm:p-10 mb-6 relative overflow-hidden glow-ring"
        >
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-[#E10600] opacity-15 blur-3xl" />
          <div className="relative">
            <div className="text-xs uppercase tracking-[0.3em] text-[#E10600] mb-3">Estado en vivo</div>
            <h1 className="font-display text-3xl sm:text-5xl tracking-tight leading-[1.05] mb-4">
              {data.status === "completed"
                ? `¡Tu vehículo está listo, ${data.name.split(" ")[0]}! 🎉`
                : data.status === "in_progress"
                ? `Estamos trabajando en tu vehículo, ${data.name.split(" ")[0]}`
                : data.status === "cancelled"
                ? "Esta cita fue cancelada"
                : `Hola ${data.name.split(" ")[0]}, recibimos tu cita`}
            </h1>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs uppercase tracking-[0.18em]" style={{ color: st.color, borderColor: `${st.color}66`, background: `${st.color}15` }}>
              {data.status === "in_progress" ? <CircleNotch size={14} className="animate-spin" /> : <Sparkle size={14} weight="fill" />}
              {st.label}
            </div>
          </div>
        </motion.div>

        {/* Timeline */}
        {!isCancelled && (
          <div className="rounded-2xl border border-white/10 bg-[#0F0F10] p-6 sm:p-8 mb-6">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-6">Progreso</div>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[14px] top-3 bottom-3 w-px bg-white/10" />
              <div className="absolute left-[14px] top-3 w-px bg-[#E10600] transition-all duration-700" style={{ height: `${stepIndex >= 0 ? ((stepIndex + 1) / STEPS.length) * 100 : 0}%` }} />
              <ul className="space-y-6">
                {STEPS.map((s, i) => {
                  const done = i <= stepIndex;
                  const current = i === stepIndex;
                  return (
                    <li key={s.id} className="flex items-start gap-4 relative">
                      <div className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold flex-shrink-0 z-10 transition-all ${
                        done ? "bg-[#E10600] text-white" : "bg-[#0A0A0A] border border-white/20 text-white/40"
                      } ${current ? "ring-4 ring-[#E10600]/30" : ""}`}>
                        {done ? <CheckCircle size={14} weight="fill" /> : i + 1}
                      </div>
                      <div className="flex-1 pt-0.5">
                        <div className={`font-medium ${done ? "text-white" : "text-white/40"}`}>{s.label}</div>
                        <div className={`text-xs ${done ? "text-white/60" : "text-white/30"} mt-0.5`}>{s.desc}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* Details */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <DetailCard icon={Car} label="Vehículo" value={data.vehicle} />
          <DetailCard icon={Calendar} label="Cita" value={`${data.date} · ${data.time}`} />
          <DetailCard icon={User} label="Técnico asignado" value={data.technician_name || "Pendiente de asignar"} />
          <DetailCard icon={Sparkle} label="Servicio" value={data.service} />
        </div>

        {/* History */}
        {data.status_history && data.status_history.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#0F0F10] p-6 mb-6">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-4">Historial</div>
            <ul className="space-y-3">
              {[...data.status_history].reverse().map((h, i) => {
                const label = STATUS_LABELS[h.status]?.label || h.status;
                const color = STATUS_LABELS[h.status]?.color || "#71717A";
                return (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full mt-2" style={{ background: color }} />
                    <div className="flex-1">
                      <div className="text-white/90">{label}</div>
                      <div className="text-xs text-white/40">{new Date(h.at).toLocaleString("es-DO")}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Contact CTAs */}
        <div className="grid sm:grid-cols-2 gap-4">
          <a href={`tel:${BUSINESS.phoneRaw}`} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#0F0F10] hover:border-[#E10600] py-4 text-sm tactile">
            <Phone size={18} weight="bold" /> Llamar al taller
          </a>
          <a href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#0F0F10] hover:border-[#25D366] py-4 text-sm tactile">
            <WhatsappLogo size={18} weight="fill" /> WhatsApp
          </a>
        </div>

        <p className="text-center text-xs text-white/30 mt-8">
          Esta página se actualiza automáticamente cada 15 segundos.
        </p>
      </main>
    </div>
  );
}

function DetailCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F0F10] p-5">
      <div className="flex items-center justify-between mb-2">
        <Icon size={20} weight="duotone" className="text-[#E10600]" />
      </div>
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">{label}</div>
      <div className="text-sm text-white/95 mt-1">{value}</div>
    </div>
  );
}
