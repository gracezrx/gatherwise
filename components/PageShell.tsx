"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { LanguageToggle, useLanguage } from "./LanguageProvider";

export default function PageShell({
  children,
  compact = false
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen w-full overflow-x-hidden">
      <header className="border-b border-white/70 bg-white/55 backdrop-blur-xl">
        <div className="flex w-full flex-col gap-3 px-3 py-4 sm:px-4 lg:px-6 xl:flex-row xl:items-center xl:justify-between 2xl:px-8">
          <Link href="/dashboard" className="group flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-coral/25 bg-coral/10 text-xs font-black text-coral shadow-sm transition duration-200 ease-smooth group-hover:-translate-y-0.5 group-hover:bg-coral group-hover:text-white">
              N°0
            </span>
            <span className="min-w-0">
              <span className="display-title block text-xl text-ink">Gatherwise</span>
              <span className="block text-xs font-semibold text-stone-500">
                {t("brandSubtitle")}
              </span>
            </span>
          </Link>
          <div className="flex min-w-0 flex-row flex-wrap items-center gap-2 xl:justify-end">
            <Link href="/" className="action-secondary min-h-10 px-3 text-xs">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {t("plan")}
            </Link>
            <LanguageToggle />
          </div>
        </div>
      </header>
      <div className={compact ? "mx-auto w-full max-w-[1600px] px-3 py-6 sm:px-4 lg:px-6 2xl:px-8" : ""}>
        {children}
      </div>
    </main>
  );
}
