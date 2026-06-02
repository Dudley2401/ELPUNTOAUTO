import { motion } from "framer-motion";
import {
  Engine, Drop, Disc, WaveTriangle, Gear, Lightning, ShieldCheck, Wrench, ArrowRight,
  ArrowsLeftRight, Snowflake, Tire, PaintBrush,
} from "@phosphor-icons/react";
import { useLang } from "@/contexts/LanguageContext";

const ICONS = {
  Activity: Engine, Droplet: Drop, Disc, Waves: WaveTriangle, Cog: Gear, Zap: Lightning, ShieldCheck, Wrench,
  Alignment: ArrowsLeftRight, Snow: Snowflake, Tires: Tire, Brush: PaintBrush,
};

const SERVICES = [
  { id: "engine-diagnostics", icon: "Activity",
    es: { name: "Diagnóstico de Motor", desc: "Escaneo computarizado avanzado para detectar fallas con precisión." },
    en: { name: "Engine Diagnostics", desc: "Advanced computerized scans to detect faults with precision." } },
  { id: "oil-change", icon: "Droplet",
    es: { name: "Cambio de Aceite", desc: "Aceites sintéticos premium y filtros originales." },
    en: { name: "Oil Changes", desc: "Premium synthetic oils and OEM filters." } },
  { id: "brake-service", icon: "Disc",
    es: { name: "Servicio de Frenos", desc: "Pastillas, discos y líquido. Tu seguridad es prioridad." },
    en: { name: "Brake Service", desc: "Pads, rotors and fluid. Your safety is our priority." } },
  { id: "suspension", icon: "Waves",
    es: { name: "Suspensión", desc: "Amortiguadores, bujes y alineación para un manejo perfecto." },
    en: { name: "Suspension Repair", desc: "Shocks, bushings and alignment for a perfect ride." } },
  { id: "transmission", icon: "Cog",
    es: { name: "Transmisión", desc: "Reparación y mantenimiento de cajas automáticas y manuales." },
    en: { name: "Transmission Service", desc: "Repair and service of automatic and manual transmissions." } },
  { id: "electrical", icon: "Zap",
    es: { name: "Sistema Eléctrico", desc: "Alternador, batería, arranque y diagnóstico completo." },
    en: { name: "Electrical Repairs", desc: "Alternator, battery, starter and full electrical diagnostics." } },
  { id: "preventive", icon: "ShieldCheck",
    es: { name: "Mantenimiento Preventivo", desc: "Planes a la medida para extender la vida de tu vehículo." },
    en: { name: "Preventive Maintenance", desc: "Tailored plans to extend the life of your vehicle." } },
  { id: "general-repair", icon: "Wrench",
    es: { name: "Reparación General", desc: "Mecánica integral con técnicos certificados y garantía." },
    en: { name: "General Auto Repair", desc: "Full-service mechanics with certified technicians." } },
  { id: "alignment", icon: "Alignment",
    es: { name: "Alineación y Balanceo", desc: "Computarizada 3D. Mejora estabilidad y vida útil de neumáticos." },
    en: { name: "Wheel Alignment", desc: "Computerized 3D. Better stability and longer tire life." } },
  { id: "ac-service", icon: "Snow",
    es: { name: "Aire Acondicionado", desc: "Recarga de gas, diagnóstico de fugas y mantenimiento completo." },
    en: { name: "A/C Service", desc: "Gas recharge, leak detection and complete maintenance." } },
  { id: "tires", icon: "Tires",
    es: { name: "Cambio de Neumáticos", desc: "Marcas premium, montaje, balanceo y válvulas nuevas." },
    en: { name: "Tire Service", desc: "Premium brands, mounting, balancing and new valves." } },
  { id: "body-paint", icon: "Brush",
    es: { name: "Latonería y Pintura", desc: "Reparación de carrocería y pintura horneada profesional." },
    en: { name: "Body & Paint", desc: "Professional body repair and oven-baked paint finish." } },
];

export default function Services() {
  const { t, lang } = useLang();
  return (
    <section id="services" data-testid="services-section" className="relative py-24 lg:py-32 bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-5 lg:px-10">
        <div className="max-w-3xl mb-14 lg:mb-20">
          <div className="text-xs uppercase tracking-[0.4em] text-[#E10600] mb-4">{t("services.eyebrow")}</div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05]">
            {t("services.title")}
          </h2>
          <p className="mt-5 text-white/60 max-w-2xl">{t("services.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {SERVICES.map((s, i) => {
            const Icon = ICONS[s.icon];
            const data = s[lang];
            return (
              <motion.a
                key={s.id}
                href="#booking"
                data-testid={`service-card-${s.id}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: (i % 4) * 0.07 }}
                whileTap={{ scale: 0.97 }}
                className="group relative bg-[#0F0F10] p-7 lg:p-8 hover:bg-[#161617] active:bg-[#161617] transition-colors duration-300 min-h-[230px] flex flex-col cursor-pointer overflow-hidden"
              >
                <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[#E10600] opacity-0 group-hover:opacity-15 group-active:opacity-15 blur-2xl transition-opacity duration-500" />
                <div className="w-12 h-12 rounded-xl bg-[#E10600]/10 grid place-items-center text-[#E10600] group-hover:bg-[#E10600] group-hover:text-white group-active:bg-[#E10600] group-active:text-white transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                  {Icon ? <Icon size={26} weight="duotone" /> : null}
                </div>
                <div className="mt-6 font-display text-xl tracking-wide group-hover:translate-x-1 group-active:translate-x-1 transition-transform duration-300">{data.name}</div>
                <p className="mt-2 text-sm text-white/55 leading-relaxed flex-1">{data.desc}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/70 group-hover:text-[#E10600] group-active:text-[#E10600] transition">
                  {t("services.cta")} <ArrowRight size={14} className="arrow-slide" />
                </div>
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#E10600]/60 to-transparent opacity-0 group-hover:opacity-100 group-active:opacity-100 transition" />
              </motion.a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
