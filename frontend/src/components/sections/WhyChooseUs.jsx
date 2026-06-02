import { motion } from "framer-motion";
import { UsersThree, Sparkle, Lightning, Medal, ArrowUpRight } from "@phosphor-icons/react";
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
                whileHover={{ y: -8 }}
                whileTap={{ scale: 0.97 }}
                className="group relative p-7 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-[#E10600]/60 active:border-[#E10600]/60 transition-colors duration-300 cursor-pointer overflow-hidden"
              >
                {/* Red glow on hover */}
                <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-[#E10600] opacity-0 group-hover:opacity-25 group-active:opacity-25 blur-3xl transition-opacity duration-500" />

                {/* Animated number background */}
                <div className="absolute top-3 right-5 font-mono-display text-xs text-white/20 group-hover:text-[#E10600]/60 group-active:text-[#E10600]/60 transition-colors duration-300">
                  0{i + 1}
                </div>

                {/* Icon with rotation + scale on hover */}
                <div className="relative text-[#E10600] transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6 group-active:scale-110 group-active:-rotate-6">
                  <Icon size={36} weight="duotone" className="ring-on-hover" />
                </div>

                <div className="relative mt-5 font-display text-2xl tracking-wide group-hover:translate-x-1 group-active:translate-x-1 transition-transform duration-300">
                  {it.t}
                </div>
                <p className="relative mt-2 text-sm text-white/60 leading-relaxed">{it.d}</p>

                {/* Bottom red line that draws in */}
                <div className="absolute left-0 right-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#E10600] to-transparent scale-x-0 group-hover:scale-x-100 group-active:scale-x-100 origin-center transition-transform duration-500" />

                {/* Arrow that appears on hover */}
                <div className="absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 group-active:opacity-100 translate-x-2 group-hover:translate-x-0 group-active:translate-x-0 transition-all duration-300 text-[#E10600]">
                  <ArrowUpRight size={20} weight="bold" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
