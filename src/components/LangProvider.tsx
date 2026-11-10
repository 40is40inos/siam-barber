"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import type { Lang } from "@/lib/config";
import { dict, type Dict } from "@/lib/i18n";
import { KEYS } from "@/lib/storage";

let memory: Lang | null = null;
const listeners = new Set<() => void>();

function read(): Lang {
  if (memory) return memory;
  try {
    return window.localStorage.getItem(KEYS.lang) === "en" ? "en" : "el";
  } catch {
    return "el";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: Dict };
const LangContext = createContext<Ctx>({ lang: "el", setLang: () => {}, t: dict.el });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, read, () => "el" as Lang);

  const setLang = useCallback((l: Lang) => {
    memory = l;
    try {
      window.localStorage.setItem(KEYS.lang, l);
    } catch {
      /* keep the in-memory choice */
    }
    listeners.forEach((fn) => fn());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return <LangContext value={{ lang, setLang, t: dict[lang] as Dict }}>{children}</LangContext>;
}

export function useLang() {
  return useContext(LangContext);
}
