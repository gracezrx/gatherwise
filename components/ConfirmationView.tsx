"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  MapPin,
  PartyPopper
} from "lucide-react";
import PageShell from "./PageShell";
import type {
  BookingSummary,
  PlanRecommendation,
  PlanningRequest
} from "@/lib/types";
import { formatMoney } from "@/lib/utils";

interface BookingPayload {
  request: PlanningRequest;
  recommendations: PlanRecommendation[];
  approvedPlanIds: string[];
  booking: BookingSummary;
}

export default function ConfirmationView({ requestId }: { requestId: string }) {
  const [payload, setPayload] = useState<BookingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/booking?requestId=${requestId}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) {
          return;
        }
        if (data.error) {
          throw new Error(data.error);
        }
        setPayload(data);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Unable to load confirmation.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const confirmedPlan = useMemo(() => {
    const confirmation = payload?.booking.confirmation;
    return payload?.recommendations.find((plan) => plan.id === confirmation?.planId);
  }, [payload]);

  if (loading) {
    return (
      <PageShell compact>
        <div className="motion-panel p-6">
          <p className="text-sm font-bold text-stone-600">Loading confirmation...</p>
        </div>
      </PageShell>
    );
  }

  if (error || !payload || !payload.booking.confirmation) {
    return (
      <PageShell compact>
        <div className="motion-panel p-6">
          <p className="font-bold text-coral">
            {error ?? "No confirmation exists for this request yet."}
          </p>
          <Link
            href={`/booking/${requestId}`}
            className="action-primary mt-4"
          >
            View booking status
          </Link>
        </div>
      </PageShell>
    );
  }

  const confirmation = payload.booking.confirmation;
  const isManualHandoff = confirmation.provider === "handoff";

  return (
    <PageShell compact>
      <div className="motion-panel p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-black uppercase text-moss">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {isManualHandoff ? "Manual reservation" : "Mock confirmation"}
            </p>
            <h1 className="display-title mt-2 text-5xl text-ink sm:text-7xl">
              {confirmation.restaurantName} {isManualHandoff ? "is saved" : "is booked"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              {isManualHandoff
                ? "You marked this reservation as completed after opening the external booking page. Gatherwise saved the plan details locally."
                : "This is a local mock confirmation. It shows where official provider confirmation details would appear after a real API integration."}
            </p>
          </div>
          <div className="interactive-card bg-mist px-4 py-3">
            <p className="text-xs font-black uppercase text-stone-500">
              {isManualHandoff ? "Local record" : "Confirmation code"}
            </p>
            <p className="mt-1 text-2xl font-black text-ink">{confirmation.confirmationCode}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="interactive-card bg-mist p-4">
            <p className="flex items-center gap-2 text-sm font-black text-ink">
              <CalendarClock className="h-4 w-4 text-coral" aria-hidden="true" />
              Date and party
            </p>
            <p className="mt-2 text-sm text-stone-700">
              {new Date(confirmation.dateTime).toLocaleString()} for {confirmation.partySize}
            </p>
          </div>
          <div className="interactive-card bg-mist p-4">
            <p className="flex items-center gap-2 text-sm font-black text-ink">
              <DollarSign className="h-4 w-4 text-coral" aria-hidden="true" />
              Estimated total
            </p>
            <p className="mt-2 text-sm text-stone-700">
              {formatMoney(confirmation.totalEstimate)}
            </p>
          </div>
          <div className="interactive-card bg-mist p-4">
            <p className="flex items-center gap-2 text-sm font-black text-ink">
              <MapPin className="h-4 w-4 text-coral" aria-hidden="true" />
              Plan
            </p>
            <p className="mt-2 text-sm text-stone-700">
              {confirmedPlan?.travelNotes ?? "Travel notes unavailable."}
            </p>
          </div>
          <div className="interactive-card bg-mist p-4">
            <p className="flex items-center gap-2 text-sm font-black text-ink">
              <PartyPopper className="h-4 w-4 text-coral" aria-hidden="true" />
              Activity
            </p>
            <p className="mt-2 text-sm text-stone-700">
              {confirmation.activityName ?? "No extra activity attached."}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row">
          <Link
            href={`/booking/${requestId}`}
            className="action-secondary"
          >
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            Attempt history
          </Link>
          <Link
            href="/"
            className="action-primary"
          >
            Plan another gathering
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
