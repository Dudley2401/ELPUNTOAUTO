import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { List, X, Phone } from "@phosphor-icons/react";
import { useLang } from "@/contexts/LanguageContext";
import { BUSINESS } from "@/lib/constants";

const NAV_LINKS = [
  { id: "services", key: "nav.services" },
  { id: "about", key: "nav.about" },
  { id: "gallery", key: "nav.gallery" },
  { id: "testimonials", key: "nav.testimonials" },
  { id: "booking", key: "nav.booking" },
  { id: "contact", key: "nav.contact" },
];

export default function Navbar() {
  const { t, lang, toggle } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-testid="site-navbar"
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-black/70 backdrop-blur-xl border-b border-white/10" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 lg:px-10 h-16 lg:h-20 flex items-center justify-between">
        <Link to="/" data-testid="brand-logo" className="flex items-center gap-3">
          <span className="w-9 h-9 grid place-items-center rounded-md bg-[#E10600] text-white font-display text-xl">EP</span>
          <span className="hidden sm:flex flex-col leading-tight">
            <span className="font-display text-xl tracking-wider">EL PUNTO</span>
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/60">Autoservices</span>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <a
              key={l.id}
              data-testid={`nav-link-${l.id}`}
              href={`#${l.id}`}
              className="magnetic-link text-sm uppercase tracking-[0.18em] text-white/70 hover:text-white transition"
            >
              {t(l.key)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            data-testid="lang-toggle"
            onClick={toggle}
            className="text-xs uppercase tracking-[0.25em] text-white/80 hover:text-white px-3 py-1.5 border border-white/15 rounded-full hover:border-[#E10600] transition"
          >
            {lang === "es" ? "ES / EN" : "EN / ES"}
          </button>
          <a
            data-testid="navbar-call-button"
            href={`tel:${BUSINESS.phoneRaw}`}
            className="group hidden md:inline-flex items-center gap-2 btn-red ripple text-white text-sm px-4 py-2 rounded-full font-medium"
          >
            <Phone size={16} weight="bold" className="ring-on-hover" /> {t("nav.callNow")}
          </a>
          <button
            data-testid="mobile-menu-toggle"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden text-white"
          >
            {open ? <X size={26} /> : <List size={26} />}
          </button>
        </div>
      </div>

      {open && (
        <div data-testid="mobile-menu" className="lg:hidden border-t border-white/10 bg-black/95 backdrop-blur-xl">
          <div className="px-5 py-5 flex flex-col gap-4">
            {NAV_LINKS.map((l) => (
              <a
                key={l.id}
                data-testid={`mobile-nav-${l.id}`}
                href={`#${l.id}`}
                onClick={() => setOpen(false)}
                className="text-base uppercase tracking-[0.18em] text-white/80 hover:text-white"
              >
                {t(l.key)}
              </a>
            ))}
            <a
              data-testid="mobile-call"
              href={`tel:${BUSINESS.phoneRaw}`}
              className="btn-red inline-flex items-center justify-center gap-2 text-white text-sm px-4 py-3 rounded-full font-medium"
            >
              <Phone size={16} weight="bold" /> {t("nav.callNow")} · {BUSINESS.phone}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
