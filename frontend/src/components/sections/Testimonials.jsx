import { motion } from "framer-motion";
import { Quotes, Star } from "@phosphor-icons/react";
import { useLang } from "@/contexts/LanguageContext";

export default function Testimonials() {
  const { t } = useLang();
  const items = t("testimonials.items");
  return (
    <section id="testimonials" data-testid="testimonials-section" className="py-24 lg:py-32 bg-[#0F0F10]">
      <div className="max-w-7xl mx-auto px-5 lg:px-10">
        <div className="max-w-3xl mb-14">
          <div className="text-xs uppercase tracking-[0.4em] text-[#E10600] mb-4">
            {t("testimonials.eyebrow")}
          </div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05]">
            {t("testimonials.title")}
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((it, i) => (
            <motion.figure
              key={i}
              data-testid={`testimonial-${i}`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.98 }}
              className="group relative p-7 rounded-2xl bg-[#161617] border border-white/10 hover:border-[#E10600]/60 active:border-[#E10600]/60 transition-colors cursor-pointer"
            >
              <Quotes size={32} weight="fill" className="text-[#E10600]/80" />
              <div className="flex gap-0.5 mt-3">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} size={14} weight="fill" className="text-[#E10600]" />
                ))}
              </div>
              <blockquote className="mt-4 text-white/80 leading-relaxed text-[15px]">"{it.q}"</blockquote>
              <figcaption className="mt-6 pt-4 border-t border-white/10">
                <div className="font-display text-lg tracking-wider">{it.n}</div>
                <div className="text-xs uppercase tracking-[0.22em] text-white/50">{it.v}</div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
