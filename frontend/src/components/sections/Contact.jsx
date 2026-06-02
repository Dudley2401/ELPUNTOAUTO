import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Phone, Clock, EnvelopeSimple, User, ChatCircleText, ArrowUpRight } from "@phosphor-icons/react";
import { useLang } from "@/contexts/LanguageContext";
import { api, formatApiErrorDetail } from "@/lib/api";
import { BUSINESS } from "@/lib/constants";

export default function Contact() {
  const { t, lang } = useLang();
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${BUSINESS.mapsQuery}`;
  const embedUrl = `https://www.google.com/maps?q=${BUSINESS.mapsQuery}&output=embed`;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/contact", form);
      toast.success(t("contact.success"));
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" data-testid="contact-section" className="py-24 lg:py-32 bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-5 lg:px-10">
        <div className="max-w-3xl mb-14">
          <div className="text-xs uppercase tracking-[0.4em] text-[#E10600] mb-4">{t("contact.eyebrow")}</div>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05]">
            {t("contact.title")}
          </h2>
          <p className="mt-5 text-white/60">{t("contact.subtitle")}</p>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Map + info */}
          <div className="lg:col-span-7 space-y-6">
            <div className="aspect-[16/10] rounded-2xl overflow-hidden border border-white/10 relative">
              <iframe
                title="Map"
                src={embedUrl}
                width="100%"
                height="100%"
                style={{ border: 0, filter: "grayscale(50%) invert(92%) contrast(83%) hue-rotate(180deg)" }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                data-testid="google-map"
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <InfoTile icon={MapPin} label={t("contact.addressLabel")} value={BUSINESS.address} link={mapsUrl} testid="info-address" />
              <InfoTile icon={Phone} label={t("contact.phoneLabel")} value={BUSINESS.phone} link={`tel:${BUSINESS.phoneRaw}`} testid="info-phone" />
              <InfoTile icon={Clock} label={t("contact.hoursLabel")} value={t("contact.hoursValue")} testid="info-hours" />
            </div>
          </div>

          {/* Form */}
          <form
            data-testid="contact-form"
            onSubmit={submit}
            className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#0F0F10] p-6 sm:p-8 space-y-4"
          >
            <Field icon={User} placeholder={t("contact.name")} value={form.name} onChange={set("name")} testid="contact-name" required />
            <Field icon={EnvelopeSimple} type="email" placeholder={t("contact.email")} value={form.email} onChange={set("email")} testid="contact-email" required />
            <Field icon={Phone} placeholder={t("contact.phone")} value={form.phone} onChange={set("phone")} testid="contact-phone" required />
            <div className="relative">
              <ChatCircleText size={18} className="absolute left-3 top-3 text-white/40" />
              <textarea
                data-testid="contact-message"
                rows={5}
                placeholder={t("contact.message")}
                value={form.message}
                onChange={set("message")}
                required
                className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg pl-10 pr-4 py-3 text-sm resize-none placeholder:text-white/30"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              data-testid="contact-submit"
              className="w-full btn-red rounded-full text-white font-medium py-4 text-sm uppercase tracking-[0.2em] disabled:opacity-60"
            >
              {loading ? "…" : t("contact.submit")}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function Field({ icon: Icon, testid, ...props }) {
  return (
    <div className="relative">
      <Icon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
      <input
        {...props}
        data-testid={testid}
        className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg pl-10 pr-4 py-3 text-sm placeholder:text-white/30"
      />
    </div>
  );
}

function InfoTile({ icon: Icon, label, value, link, testid }) {
  const Wrapper = link ? "a" : "div";
  const wrapProps = link ? { href: link, target: link.startsWith("http") ? "_blank" : undefined, rel: "noreferrer" } : {};
  return (
    <Wrapper
      data-testid={testid}
      {...wrapProps}
      className="group rounded-xl border border-white/10 bg-[#0F0F10] p-5 hover:border-[#E10600]/50 transition flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <Icon size={20} weight="duotone" className="text-[#E10600]" />
        {link ? <ArrowUpRight size={16} className="text-white/30 group-hover:text-white transition" /> : null}
      </div>
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">{label}</div>
      <div className="text-sm text-white/90 leading-snug">{value}</div>
    </Wrapper>
  );
}
