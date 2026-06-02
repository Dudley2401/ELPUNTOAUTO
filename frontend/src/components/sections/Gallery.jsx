import { motion } from "framer-motion";
import { useLang } from "@/contexts/LanguageContext";
import { MEDIA } from "@/lib/constants";

export default function Gallery() {
  const { t } = useLang();
  const imgs = MEDIA.gallery;
  return (
    <section id="gallery" data-testid="gallery-section" className="py-24 lg:py-32 bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-5 lg:px-10">
        <div className="max-w-3xl mb-14">
          <div className="text-xs uppercase tracking-[0.4em] text-[#E10600] mb-4">{t("gallery.eyebrow")}</div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05]">
            {t("gallery.title")}
          </h2>
          <p className="mt-5 text-white/60 max-w-2xl">{t("gallery.subtitle")}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-12 gap-3 lg:gap-4 auto-rows-[170px] lg:auto-rows-[200px]">
          {imgs.map((src, i) => {
            const spans = [
              "col-span-2 lg:col-span-7 row-span-2",
              "col-span-2 lg:col-span-5",
              "col-span-1 lg:col-span-5",
              "col-span-1 lg:col-span-4 row-span-2",
              "col-span-2 lg:col-span-3",
              "col-span-2 lg:col-span-5",
            ];
            return (
              <motion.div
                key={i}
                data-testid={`gallery-image-${i}`}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className={`relative overflow-hidden rounded-xl group ${spans[i] || "col-span-2 lg:col-span-4"}`}
              >
                <img
                  src={src}
                  alt={`Workshop ${i + 1}`}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
