"use client";

import { useEffect } from "react";
import { useLanguage } from "./LanguageProvider";

export default function ArrivalIntro({ onDone }: { onDone: () => void }) {
  const { t } = useLanguage();

  useEffect(() => {
    const timer = window.setTimeout(onDone, 2300);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <main className="arrival-screen">
      <button
        type="button"
        className="action-secondary fixed right-4 top-4 min-h-10 px-3"
        onClick={onDone}
      >
        {t("skip")}
      </button>
      <section className="arrival-card">
        <div className="mb-8 flex items-center justify-between gap-4">
          <span className="arrival-mark">N°000</span>
          <span className="text-xs font-black uppercase text-stone-500">
            {t("introOpening")}
          </span>
        </div>
        <h1 className="arrival-title">Gatherwise</h1>
        <p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-stone-600">
          {t("introLine")}
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <span className="arrival-token">{t("introPeople")}</span>
          <span className="arrival-token">{t("introPlace")}</span>
          <span className="arrival-token">{t("introMood")}</span>
        </div>
      </section>
    </main>
  );
}
