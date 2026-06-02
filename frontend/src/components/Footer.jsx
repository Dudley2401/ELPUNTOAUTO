import { Link } from "react-router-dom";
import { MapPin, Phone, Clock } from "@phosphor-icons/react";
import { useLang } from "@/contexts/LanguageContext";
import { BUSINESS } from "@/lib/constants";

export default function Footer() {
  const { t, lang } = useLang();
  return (
    <footer className="relative border-t border-white/10 bg-[#0A0A0A]" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-5 lg:px-10 py-16 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-10 h-10 grid place-items-center rounded-md bg-[#E10600] font-display text-xl">EP</span>
            <span className="font-display text-2xl tracking-wider">EL PUNTO AUTOSERVICES</span>
          </div>
          <p className="text-white/60 max-w-md">{t("footer.tagline")}</p>
          <div className="mt-6 flex items-start gap-3 text-white/70 text-sm">
            <MapPin size={18} className="mt-0.5 text-[#E10600]" /> {BUSINESS.address}
          </div>
          <div className="mt-2 flex items-center gap-3 text-white/70 text-sm">
            <Phone size={18} className="text-[#E10600]" />
            <a href={`tel:${BUSINESS.phoneRaw}`} data-testid="footer-phone" className="hover:text-white">{BUSINESS.phone}</a>
          </div>
          <div className="mt-2 flex items-center gap-3 text-white/70 text-sm">
            <Clock size={18} className="text-[#E10600]" /> {lang === "es" ? BUSINESS.hoursEs : BUSINESS.hoursShort}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-white/40 mb-4">{t("footer.quick")}</div>
          <ul className="space-y-2 text-sm text-white/70">
            <li><a href="#services" className="hover:text-white">{t("nav.services")}</a></li>
            <li><a href="#about" className="hover:text-white">{t("nav.about")}</a></li>
            <li><a href="#gallery" className="hover:text-white">{t("nav.gallery")}</a></li>
            <li><a href="#booking" className="hover:text-white">{t("nav.booking")}</a></li>
            <li><a href="#contact" className="hover:text-white">{t("nav.contact")}</a></li>
          </ul>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-white/40 mb-4">{t("footer.contact")}</div>
          <ul className="space-y-2 text-sm text-white/70">
            <li><a className="hover:text-white" href={`tel:${BUSINESS.phoneRaw}`}>{BUSINESS.phone}</a></li>
            <li><a className="hover:text-white" href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a></li>
            <li>
              <Link to="/admin/login" data-testid="footer-admin-link" className="hover:text-white">
                {t("footer.admin")}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 lg:px-10 py-6 text-xs text-white/40 max-w-7xl mx-auto flex flex-col sm:flex-row gap-2 justify-between">
        <span>© {new Date().getFullYear()} El Punto Autoservices. {t("footer.rights")}</span>
        <span>Santo Domingo, R.D.</span>
      </div>
    </footer>
  );
}
