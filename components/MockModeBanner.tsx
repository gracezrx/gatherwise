"use client";

import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { useLanguage } from "./LanguageProvider";

type ProviderStatus = {
  googlePlaces: {
    configured: boolean;
  };
};

export default function MockModeBanner() {
  const { t } = useLanguage();
  const [googlePlacesEnabled, setGooglePlacesEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/provider-config")
      .then((response) => response.json())
      .then((data: ProviderStatus) => {
        if (!cancelled) {
          setGooglePlacesEnabled(Boolean(data.googlePlaces?.configured));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGooglePlacesEnabled(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (googlePlacesEnabled !== false) {
    return null;
  }

  return (
    <div className="flex max-w-full items-center gap-2 rounded-lg border border-coral/25 bg-white/70 px-3 py-2 text-sm font-bold text-ink shadow-sm backdrop-blur">
      <FlaskConical className="h-4 w-4 text-coral" aria-hidden="true" />
      <span className="min-w-0">
        {t("mockMode")}
      </span>
    </div>
  );
}
