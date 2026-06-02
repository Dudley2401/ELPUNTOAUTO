import { motion } from "framer-motion";
import { Phone, MapPin, ArrowRight } from "@phosphor-icons/react";
import { useLang } from "@/contexts/LanguageContext";
import { BUSINESS, MEDIA } from "@/lib/constants";

export default function Hero() {
  const { t, lang } = useLang();
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${BUSINESS.mapsQuery}`;

  return (
    <section data-testid="hero-section" id="top" className="relative min-h-[100svh] w-full overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${MEDIA.hero})` }}
      />
      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-black/40" />

      {/* Red glow accent */}
      <div className="absolute -bottom-32 -left-32 w-[480px] h-[480px] rounded-full bg-[#E10600] blur-[150px] opacity-25" />

      <div className="relative max-w-7xl mx-auto px-5 lg:px-10 pt-32 lg:pt-40 pb-20 min-h-[100svh] flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-white/70 mb-6 border border-white/20 rounded-full px-3 py-1.5 backdrop-blur-md bg-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] animate-pulse" />
            {t("hero.eyebrow")}
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="font-display text-5xl sm:text-6xl lg:text-[88px] leading-[0.95] tracking-tight max-w-4xl"
          data-testid="hero-title"
        >
          {t("hero.title1")}<br />
          {t("hero.title2")}{" "}
          <span className="text-[#E10600] italic font-mono-display">{t("hero.titleAccent")}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-6 max-w-xl text-base sm:text-lg text-white/75 leading-relaxed"
        >
          {t("hero.subtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4"
        >
          <a
            data-testid="hero-call-button"
            href={`tel:${BUSINESS.phoneRaw}`}
            className="btn-red inline-flex items-center justify-center gap-3 px-7 py-4 rounded-full text-white font-medium text-base"
          >
            <Phone size={20} weight="bold" />
            {t("hero.ctaCall")} · {BUSINESS.phone}
          </a>
          <a
            data-testid="hero-directions-button"
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-3 px-7 py-4 rounded-full border border-white/25 text-white hover:bg-white/10 transition backdrop-blur-md"
          >
            <MapPin size={20} weight="bold" />
            {t("hero.ctaDirections")}
          </a>
          <a
            data-testid="hero-book-button"
            href="#booking"
            className="inline-flex items-center justify-center gap-2 px-5 py-4 text-white/80 hover:text-white text-sm uppercase tracking-[0.18em]"
          >
            {t("hero.ctaBook")} <ArrowRight size={16} />
          </a>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-16 lg:mt-24 grid grid-cols-3 max-w-2xl border-t border-white/10 pt-8 gap-4"
        >
          {[
            { v: t("hero.stats1"), l: t("hero.stats1l") },
            { v: t("hero.stats2"), l: t("hero.stats2l") },
            { v: t("hero.stats3"), l: t("hero.stats3l") },
          ].map((s, i) => (
            <div key={i}>
              <div className="font-display text-3xl lg:text-4xl text-white">{s.v}</div>
              <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/50 mt-1">{s.l}</div>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.4em] text-white/40">
        ↓ Scroll
      </div>
    </section>
  );
}
