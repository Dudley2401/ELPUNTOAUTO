import { useLang } from "@/contexts/LanguageContext";
import { BRANDS } from "@/lib/constants";

export default function Brands() {
  const { t } = useLang();
  const items = [...BRANDS, ...BRANDS];
  return (
    <section data-testid="brands-section" className="relative py-16 border-y border-white/10 bg-[#0F0F10] overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 lg:px-10 mb-8">
        <div className="text-[10px] uppercase tracking-[0.4em] text-white/40 text-center">
          {t("brands.title")}
        </div>
      </div>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#0F0F10] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#0F0F10] to-transparent z-10 pointer-events-none" />
        <div className="flex marquee whitespace-nowrap no-scrollbar overflow-hidden">
          {items.map((b, i) => (
            <div
              key={i}
              className="shrink-0 px-8 lg:px-12 font-display text-2xl lg:text-3xl tracking-[0.25em] text-white/40 hover:text-white transition"
            >
              {b}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
