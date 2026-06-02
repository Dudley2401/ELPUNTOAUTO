import { WhatsappLogo } from "@phosphor-icons/react";
import { BUSINESS } from "@/lib/constants";

export default function WhatsAppButton() {
  const text = encodeURIComponent("Hola, me gustaría agendar un servicio para mi vehículo.");
  return (
    <a
      data-testid="whatsapp-floating-button"
      href={`https://wa.me/${BUSINESS.whatsapp}?text=${text}`}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-5 right-5 z-50 group float-idle"
      aria-label="WhatsApp"
    >
      <span className="absolute inset-0 rounded-full bg-[#25D366] blur-xl opacity-50 group-hover:opacity-90 group-active:opacity-90 transition duration-500" />
      <span className="relative flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-2xl ring-2 ring-white/10 group-hover:scale-110 group-active:scale-95 transition-transform duration-300">
        <WhatsappLogo size={28} weight="fill" />
      </span>
    </a>
  );
}
