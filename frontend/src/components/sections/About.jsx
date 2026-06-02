import { motion } from "framer-motion";
import { CheckCircle } from "@phosphor-icons/react";
import { useLang } from "@/contexts/LanguageContext";
import { MEDIA } from "@/lib/constants";

export default function About() {
  const { t } = useLang();
  return (
    <section id="about" data-testid="about-section" className="relative py-24 lg:py-32 bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-5 lg:px-10 grid lg:grid-cols-12 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="lg:col-span-5 relative"
        >
          <div className="relative aspect-[4/5] rounded-2xl overflow-hidden glow-ring">
            <img src={MEDIA.diagnostics} alt="Diagnostics" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 right-5">
              <div className="text-[10px] uppercase tracking-[0.35em] text-white/60">Since 2010</div>
              <div className="font-display text-3xl mt-1">El Punto Autoservices</div>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 hidden lg:block bg-[#E10600] text-white px-6 py-5 rounded-xl font-display text-2xl tracking-wide rotate-[-2deg]">
            14+ Years
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="lg:col-span-7"
        >
          <div className="text-xs uppercase tracking-[0.4em] text-[#E10600] mb-4">{t("about.eyebrow")}</div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05]">
            {t("about.title")}
          </h2>
          <p className="mt-6 text-white/70 leading-relaxed">{t("about.p1")}</p>
          <p className="mt-4 text-white/60 leading-relaxed">{t("about.p2")}</p>

          <ul className="mt-8 grid sm:grid-cols-2 gap-3">
            {t("about.bullets").map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/80">
                <CheckCircle size={20} weight="fill" className="text-[#E10600] mt-0.5 flex-shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
