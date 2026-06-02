import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarBlank, Clock, Car, User, EnvelopeSimple, Phone, NotePencil } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useLang } from "@/contexts/LanguageContext";
import { api, formatApiErrorDetail } from "@/lib/api";
import { TIME_SLOTS } from "@/lib/constants";

const SERVICE_KEYS = [
  { id: "engine-diagnostics", es: "Diagnóstico de Motor", en: "Engine Diagnostics" },
  { id: "oil-change", es: "Cambio de Aceite", en: "Oil Changes" },
  { id: "brake-service", es: "Servicio de Frenos", en: "Brake Service" },
  { id: "suspension", es: "Suspensión", en: "Suspension Repair" },
  { id: "transmission", es: "Transmisión", en: "Transmission Service" },
  { id: "electrical", es: "Sistema Eléctrico", en: "Electrical Repairs" },
  { id: "preventive", es: "Mantenimiento Preventivo", en: "Preventive Maintenance" },
  { id: "general-repair", es: "Reparación General", en: "General Auto Repair" },
];

const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const initial = {
  name: "", email: "", phone: "", service: "", vehicle: "",
  date: todayISO(), time: "", notes: "",
};

export default function Booking() {
  const { t, lang } = useLang();
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.service) { toast.error(t("booking.pickService")); return; }
    if (!form.time) { toast.error(t("booking.pickTime")); return; }
    setLoading(true);
    try {
      await api.post("/appointments", form);
      toast.success(t("booking.success"));
      setForm(initial);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="booking" data-testid="booking-section" className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#E10600] blur-[200px] opacity-15 -translate-y-1/2" />
      <div className="relative max-w-7xl mx-auto px-5 lg:px-10 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5">
          <div className="text-xs uppercase tracking-[0.4em] text-[#E10600] mb-4">
            {t("booking.eyebrow")}
          </div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05]">
            {t("booking.title")}
          </h2>
          <p className="mt-5 text-white/60">{t("booking.subtitle")}</p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {["Online", "Phone", "WhatsApp"].map((m, i) => (
              <div key={i} className="rounded-xl border border-white/10 p-4 bg-white/[0.02]">
                <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">{i === 0 ? "01" : i === 1 ? "02" : "03"}</div>
                <div className="font-display text-lg mt-1">{m}</div>
              </div>
            ))}
          </div>
        </div>

        <motion.form
          data-testid="booking-form"
          onSubmit={submit}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-7 relative rounded-3xl border border-white/10 bg-gradient-to-br from-[#161617] to-[#0F0F10] p-6 sm:p-8 glow-ring"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <Field icon={User} placeholder={t("booking.name")} value={form.name} onChange={set("name")} testid="booking-name" required />
            <Field icon={EnvelopeSimple} type="email" placeholder={t("booking.email")} value={form.email} onChange={set("email")} testid="booking-email" required />
            <Field icon={Phone} placeholder={t("booking.phone")} value={form.phone} onChange={set("phone")} testid="booking-phone" required />
            <Field icon={Car} placeholder={t("booking.vehicle")} value={form.vehicle} onChange={set("vehicle")} testid="booking-vehicle" required />

            <div className="sm:col-span-2 relative">
              <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 mb-2 block">{t("booking.service")}</label>
              <select
                data-testid="booking-service"
                value={form.service}
                onChange={set("service")}
                required
                className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg px-4 py-3 text-sm appearance-none"
              >
                <option value="" disabled>{t("booking.pickService")}</option>
                {SERVICE_KEYS.map((s) => (
                  <option key={s.id} value={s[lang]}>{s[lang]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 mb-2 block">{t("booking.date")}</label>
              <div className="relative">
                <CalendarBlank size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  data-testid="booking-date"
                  type="date"
                  min={todayISO()}
                  value={form.date}
                  onChange={set("date")}
                  required
                  className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg pl-10 pr-4 py-3 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 mb-2 block">{t("booking.time")}</label>
              <div className="relative">
                <Clock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <select
                  data-testid="booking-time"
                  value={form.time}
                  onChange={set("time")}
                  required
                  className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg pl-10 pr-4 py-3 text-sm appearance-none"
                >
                  <option value="" disabled>{t("booking.pickTime")}</option>
                  {TIME_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 mb-2 block">{t("booking.notes")}</label>
              <div className="relative">
                <NotePencil size={18} className="absolute left-3 top-3 text-white/40" />
                <textarea
                  data-testid="booking-notes"
                  rows={3}
                  value={form.notes}
                  onChange={set("notes")}
                  className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg pl-10 pr-4 py-3 text-sm resize-none"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            data-testid="booking-submit"
            className="mt-6 w-full btn-red rounded-full text-white font-medium py-4 text-base uppercase tracking-[0.18em] disabled:opacity-60"
          >
            {loading ? "…" : t("booking.submit")}
          </button>
        </motion.form>
      </div>
    </section>
  );
}

function Field({ icon: Icon, testid, ...props }) {
  return (
    <div className="relative">
      <Icon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
      <input
        {...props}
        data-testid={testid}
        className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg pl-10 pr-4 py-3 text-sm placeholder:text-white/30"
      />
    </div>
  );
}
