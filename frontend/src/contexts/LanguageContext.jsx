import { createContext, useContext, useEffect, useState } from "react";
import { translations } from "@/i18n/translations";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    if (typeof window === "undefined") return "es";
    return localStorage.getItem("ep_lang") || "es";
  });

  useEffect(() => { localStorage.setItem("ep_lang", lang); }, [lang]);

  const t = (key) => {
    const parts = key.split(".");
    let node = translations[lang];
    for (const p of parts) {
      if (node && typeof node === "object" && p in node) node = node[p];
      else return key;
    }
    return node;
  };

  const toggle = () => setLang((l) => (l === "es" ? "en" : "es"));

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
