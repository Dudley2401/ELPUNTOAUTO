import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CalendarBlank, Wrench, MapPin, Phone, ChatCircleText, Sparkle } from "@phosphor-icons/react";
import { useLang } from "@/contexts/LanguageContext";
import { BUSINESS } from "@/lib/constants";

// Cute SVG mechanic mascot
const MechanicSvg = ({ winking = false }) => (
  <svg viewBox="0 0 100 110" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    {/* shadow */}
    <ellipse cx="50" cy="106" rx="22" ry="3" fill="#000" opacity="0.35" />
    {/* body / overalls */}
    <path d="M28 70 Q28 60 50 60 Q72 60 72 70 L72 100 Q72 104 68 104 L32 104 Q28 104 28 100 Z" fill="#E10600" />
    {/* overall straps */}
    <rect x="40" y="60" width="4" height="14" fill="#0A0A0A" opacity="0.5" />
    <rect x="56" y="60" width="4" height="14" fill="#0A0A0A" opacity="0.5" />
    {/* shirt under */}
    <path d="M44 60 L56 60 L56 74 L44 74 Z" fill="#fff" />
    {/* button */}
    <circle cx="50" cy="88" r="2.2" fill="#0A0A0A" opacity="0.6" />
    {/* arms */}
    <rect x="22" y="68" width="9" height="22" rx="4" fill="#E10600" />
    <rect x="69" y="68" width="9" height="22" rx="4" fill="#E10600" />
    {/* hands */}
    <circle cx="27" cy="92" r="5" fill="#F2C49A" />
    <circle cx="73" cy="92" r="5" fill="#F2C49A" />
    {/* head */}
    <circle cx="50" cy="40" r="20" fill="#F2C49A" />
    {/* ears */}
    <circle cx="30" cy="42" r="3" fill="#F2C49A" />
    <circle cx="70" cy="42" r="3" fill="#F2C49A" />
    {/* hard hat */}
    <path d="M28 36 Q28 18 50 18 Q72 18 72 36 Z" fill="#E10600" />
    <rect x="28" y="34" width="44" height="4" rx="2" fill="#B80500" />
    {/* hat highlight */}
    <path d="M34 26 Q40 22 50 22" stroke="#FF4F47" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
    {/* eyes */}
    {winking ? (
      <>
        <path d="M40 42 Q43 40 46 42" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="58" cy="42" r="2.2" fill="#0A0A0A" />
      </>
    ) : (
      <>
        <circle cx="42" cy="42" r="2.2" fill="#0A0A0A" />
        <circle cx="58" cy="42" r="2.2" fill="#0A0A0A" />
        <circle cx="42.8" cy="41.3" r="0.6" fill="#fff" />
        <circle cx="58.8" cy="41.3" r="0.6" fill="#fff" />
      </>
    )}
    {/* smile */}
    <path d="M44 49 Q50 54 56 49" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" fill="none" />
    {/* cheeks */}
    <circle cx="36" cy="48" r="2.5" fill="#E10600" opacity="0.3" />
    <circle cx="64" cy="48" r="2.5" fill="#E10600" opacity="0.3" />
  </svg>
);

// Floating wrench he holds, animated
const FloatingWrench = () => (
  <motion.div
    initial={{ rotate: -20, x: 0, y: 0 }}
    animate={{ rotate: [-20, -5, -20], y: [0, -2, 0] }}
    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    className="absolute -right-2 bottom-4 w-7 h-7 text-[#0A0A0A]"
    style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,.4))" }}
  >
    <Wrench size="100%" weight="fill" />
  </motion.div>
);

export default function MechanicAssistant() {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [chatMode, setChatMode] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [sessionId] = useState(() => {
    const existing = localStorage.getItem("ep_chat_sid");
    if (existing) return existing;
    const sid = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("ep_chat_sid", sid);
    return sid;
  });
  const chatScrollRef = useRef(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [showTip, setShowTip] = useState(true);
  const [winking, setWinking] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [walking, setWalking] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages, chatLoading]);

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setChatLoading(true);
    try {
      const { data } = await api.post("/chat", { session_id: sessionId, message: text });
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: lang === "es" ? "Disculpa, error técnico. Llámanos." : "Sorry, technical issue. Call us." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const openChat = () => {
    setChatMode(true);
    setOpen(true);
    setShowTip(false);
    if (messages.length === 0) {
      setMessages([{
        role: "assistant",
        text: lang === "es"
          ? "¡Hey! Soy Pancho 🔧 Pregúntame lo que necesites: precios estimados, servicios, horarios, lo que sea."
          : "Hey! I'm Pancho 🔧 Ask me anything: estimated prices, services, hours, whatever you need.",
      }]);
    }
  };

  const tips = lang === "es" ? [
    { text: "¡Hola! Soy Pancho, ¿necesitas algo? 🔧", action: null },
    { text: "¿Tu carro suena raro? ¡Te diagnostico!", action: "services" },
    { text: "Reserva tu cita en menos de 1 minuto 📅", action: "booking" },
    { text: "¿Quieres ver nuestro taller? 👀", action: "gallery" },
    { text: "Llámame ahora y te atiendo 📞", action: "call" },
  ] : [
    { text: "Hi! I'm Pancho. Need a hand? 🔧", action: null },
    { text: "Car sounds funny? Let me check it!", action: "services" },
    { text: "Book your appointment in under a minute 📅", action: "booking" },
    { text: "Wanna see our workshop? 👀", action: "gallery" },
    { text: "Call me now and I'll take care of you 📞", action: "call" },
  ];

  // Initial entrance
  useEffect(() => {
    const id = setTimeout(() => setHasEntered(true), 1200);
    return () => clearTimeout(id);
  }, []);

  // Tip rotation
  useEffect(() => {
    if (dismissedRef.current) return;
    const id = setInterval(() => {
      if (open || dismissedRef.current) return;
      setShowTip(false);
      setTimeout(() => {
        setTipIndex((i) => (i + 1) % tips.length);
        setShowTip(true);
      }, 400);
    }, 6000);
    return () => clearInterval(id);
  }, [open, tips.length]);

  // Wink animation
  useEffect(() => {
    const id = setInterval(() => {
      setWinking(true);
      setTimeout(() => setWinking(false), 300);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const scrollToSection = useCallback((sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    // Walk animation: dash to right then return
    setWalking(true);
    setOpen(false);
    setShowTip(false);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => setWalking(false), 1200);
    setTimeout(() => setShowTip(true), 1600);
  }, []);

  const handleAction = (action) => {
    if (action === "chat") {
      openChat();
      return;
    }
    if (!action) {
      setOpen(true);
      return;
    }
    if (action === "call") {
      window.location.href = `tel:${BUSINESS.phoneRaw}`;
    } else {
      scrollToSection(action);
    }
  };

  const dismiss = () => {
    dismissedRef.current = true;
    setShowTip(false);
    setOpen(false);
  };

  const menuItems = lang === "es" ? [
    { id: "chat", label: "💬 Hablar conmigo (AI)", icon: ChatCircleText, color: "#9333EA" },
    { id: "services", label: "Ver Servicios", icon: Wrench, color: "#E10600" },
    { id: "booking", label: "Reservar Cita", icon: CalendarBlank, color: "#FF4F47" },
    { id: "gallery", label: "Ver Taller", icon: Sparkle, color: "#F59E0B" },
    { id: "contact", label: "Cómo Llegar", icon: MapPin, color: "#0EA5E9" },
    { id: "call", label: "Llamar Ahora", icon: Phone, color: "#10B981" },
  ] : [
    { id: "chat", label: "💬 Talk to me (AI)", icon: ChatCircleText, color: "#9333EA" },
    { id: "services", label: "View Services", icon: Wrench, color: "#E10600" },
    { id: "booking", label: "Book Appointment", icon: CalendarBlank, color: "#FF4F47" },
    { id: "gallery", label: "See Workshop", icon: Sparkle, color: "#F59E0B" },
    { id: "contact", label: "Get Directions", icon: MapPin, color: "#0EA5E9" },
    { id: "call", label: "Call Now", icon: Phone, color: "#10B981" },
  ];

  const currentTip = tips[tipIndex];

  return (
    <div
      data-testid="mechanic-assistant"
      className="fixed left-3 sm:left-5 bottom-3 sm:bottom-5 z-[60] pointer-events-none print:hidden"
    >
      <AnimatePresence>
        {hasEntered && (
          <motion.div
            key="container"
            initial={{ opacity: 0, x: -80, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: -80 }}
            transition={{ type: "spring", stiffness: 110, damping: 14 }}
            className="relative pointer-events-auto"
          >
            {/* Speech bubble + tip */}
            <AnimatePresence>
              {showTip && !open && !walking && currentTip && (
                <motion.button
                  key={`tip-${tipIndex}`}
                  data-testid="mechanic-tip"
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.35 }}
                  onClick={() => handleAction(currentTip.action)}
                  className="absolute left-20 sm:left-24 bottom-[60px] sm:bottom-[70px] max-w-[220px] sm:max-w-[260px] bg-white text-[#111] rounded-2xl rounded-bl-sm px-4 py-3 text-sm shadow-2xl cursor-pointer hover:scale-105 transition-transform"
                  style={{ boxShadow: "0 16px 40px -10px rgba(225,6,0,.4), 0 4px 12px rgba(0,0,0,.4)" }}
                >
                  <span className="font-medium leading-snug">{currentTip.text}</span>
                  {currentTip.action && (
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-[#E10600] mt-1.5">
                      {lang === "es" ? "Toca para ir →" : "Tap to go →"}
                    </span>
                  )}
                  {/* bubble tail */}
                  <span className="absolute -bottom-1 -left-1 w-3 h-3 bg-white rotate-45 rounded-sm" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Mascot */}
            <motion.div
              data-testid="mechanic-mascot"
              animate={
                walking
                  ? { x: [0, 30, -10, 0], rotate: [0, 4, -4, 0] }
                  : open
                  ? { y: 0, scale: 1.05 }
                  : { y: [0, -6, 0], scale: 1 }
              }
              transition={
                walking
                  ? { duration: 1.2, ease: "easeInOut" }
                  : open
                  ? { duration: 0.3 }
                  : { duration: 3, repeat: Infinity, ease: "easeInOut" }
              }
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              className="relative w-20 h-20 sm:w-24 sm:h-24 cursor-pointer"
              onClick={() => {
                if (open) setOpen(false);
                else setOpen(true);
                setShowTip(false);
              }}
            >
              {/* Floor glow */}
              <div className="absolute inset-0 rounded-full bg-[#E10600] opacity-25 blur-2xl scale-90" />
              <div className="relative">
                <MechanicSvg winking={winking} />
                <FloatingWrench />
              </div>

              {/* Pulse dot to indicate interactivity */}
              {!open && !walking && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E10600] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#E10600]"></span>
                </span>
              )}
            </motion.div>

            {/* Open menu */}
            <AnimatePresence>
              {open && (
                <motion.div
                  data-testid="mechanic-menu"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.3, type: "spring", damping: 16 }}
                  className={`absolute left-20 sm:left-24 bottom-0 ${chatMode ? "w-[300px] sm:w-[360px]" : "w-60 sm:w-64"} rounded-2xl rounded-bl-sm bg-[#0F0F10] border border-white/10 shadow-2xl p-3`}
                  style={{ boxShadow: "0 24px 60px -10px rgba(225,6,0,.4)" }}
                >
                  <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-white/10">
                    <div>
                      <div className="font-display text-base tracking-wider text-white">¡Hola, soy Pancho!</div>
                      <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">
                        {chatMode
                          ? (lang === "es" ? "AI 24/7 · gratis" : "AI 24/7 · free")
                          : (lang === "es" ? "¿A dónde te llevo?" : "Where to?")}
                      </div>
                    </div>
                    {chatMode ? (
                      <button onClick={() => setChatMode(false)} className="text-white/40 hover:text-white text-xs uppercase tracking-wider">
                        ←
                      </button>
                    ) : (
                      <button onClick={dismiss} className="text-white/40 hover:text-white" data-testid="mechanic-close">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  {chatMode ? (
                    <div data-testid="pancho-chat">
                      <div ref={chatScrollRef} className="space-y-2 max-h-[300px] sm:max-h-[380px] overflow-y-auto pr-1 pb-2">
                        {messages.map((m, i) => (
                          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                                m.role === "user"
                                  ? "bg-[#E10600] text-white rounded-br-sm"
                                  : "bg-white/[0.07] text-white/90 rounded-bl-sm"
                              }`}
                            >
                              {m.text}
                            </div>
                          </div>
                        ))}
                        {chatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-white/[0.07] text-white/60 px-3 py-2 rounded-2xl rounded-bl-sm text-sm">
                              <span className="inline-flex gap-1">
                                <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
                                <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          data-testid="pancho-chat-input"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendChat()}
                          placeholder={lang === "es" ? "Pregunta lo que sea…" : "Ask anything…"}
                          className="flex-1 bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-full px-4 py-2 text-sm placeholder:text-white/30"
                          disabled={chatLoading}
                        />
                        <button
                          onClick={sendChat}
                          disabled={chatLoading || !chatInput.trim()}
                          data-testid="pancho-chat-send"
                          className="w-9 h-9 rounded-full bg-[#E10600] hover:bg-[#FF1A0E] grid place-items-center text-white disabled:opacity-50 transition"
                        >
                          <PaperPlaneRight size={14} weight="fill" />
                        </button>
                      </div>
                      <div className="text-[10px] text-white/30 text-center mt-1.5">Powered by AI · Respuestas estimadas</div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        {menuItems.map((it) => {
                          const Icon = it.icon;
                          return (
                            <button
                              key={it.id}
                              data-testid={`mechanic-action-${it.id}`}
                              onClick={() => handleAction(it.id)}
                              className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                            >
                              <span
                                className="w-8 h-8 rounded-md grid place-items-center text-white"
                                style={{ background: it.color }}
                              >
                                <Icon size={16} weight="bold" />
                              </span>
                              <span className="text-sm text-white/90 group-hover:text-white flex-1">{it.label}</span>
                              <span className="text-white/30 group-hover:text-[#E10600] arrow-slide">→</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="px-2 pt-2 mt-2 border-t border-white/10 text-[10px] text-white/30 flex items-center gap-1.5">
                        <ChatCircleText size={12} /> {lang === "es" ? "Toca afuera para cerrar" : "Tap outside to close"}
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop to close on click */}
      {open && (
        <div
          className="fixed inset-0 pointer-events-auto"
          onClick={() => setOpen(false)}
          style={{ zIndex: -1 }}
        />
      )}
    </div>
  );
}
