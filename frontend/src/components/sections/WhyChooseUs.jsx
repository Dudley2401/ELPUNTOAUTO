import { motion } from "framer-motion";
import { UsersThree, Sparkle, Lightning, Medal } from "@phosphor-icons/react";
import { useLang } from "@/contexts/LanguageContext";
import { MEDIA } from "@/lib/constants";

const ICONS = [UsersThree, Sparkle, Lightning, Medal];

export default function WhyChooseUs() {
  const { t } = useLang();
  const items = t("why.items");
  return (
    <section data-testid="why-section" className="relative py-24 lg:py-32 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: `url(${MEDIA.workshop})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A] via-black/85 to-[#0A0A0A]" />

      <div className="relative max-w-7xl mx-auto px-5 lg:px-10">
        <div className="max-w-3xl mb-14">
          <div className="text-xs uppercase tracking-[0.4em] text-[#E10600] mb-4">{t("why.eyebrow")}</div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05]">
            {t("why.title")}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map((it, i) => {
            const Icon = ICONS[i];
            return (
              <motion.div
                key={i}
                data-testid={`why-card-${i}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group relative p-7 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-[#E10600]/60 hover:-translate-y-1 transition-all"
              >
                <div className="text-[#E10600]">
                  <Icon size={36} weight="duotone" />
                </div>
                <div className="mt-5 font-display text-2xl tracking-wide">{it.t}</div>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">{it.d}</p>
                <div className="absolute top-5 right-5 text-xs font-mono-display text-white/20">0{i + 1}</div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
