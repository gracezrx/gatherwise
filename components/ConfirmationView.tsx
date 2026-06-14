"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clipboard,
  DollarSign,
  ExternalLink,
  Link2,
  MapPin,
  PartyPopper,
  Share2,
  Sparkles,
  Users
} from "lucide-react";
import PageShell from "./PageShell";
import {
  getClientBookingPayload,
  saveClientBookingPayload,
  type ClientBookingPayload
} from "@/lib/clientSessionStore";
import { getReservationGuidance } from "@/lib/reservationGuidance";
import type {
  BookingState,
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

type ShareStatus =
  | "booked"
  | "confirmed"
  | "no_booking_needed"
  | "needs_action"
  | "planned";

interface SharePlanSnapshot {
  version: 1;
  requestId: string;
  placeName: string;
  activityName?: string;
  dateLabel: string;
  partyLabel: string;
  status: ShareStatus;
  statusLabel: string;
  statusDetail: string;
  confirmationCode?: string;
  costLabel: string;
  locationLabel?: string;
  travelNotes?: string;
  mapUrl?: string;
  websiteUrl?: string;
  phoneUrl?: string;
  occasionLabel: string;
  vibeLabel?: string;
  shareTitle: string;
  shareText: string;
}

function toTitle(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function selectedPlanFromPayload(payload: BookingPayload) {
  const confirmationPlan = payload.recommendations.find(
    (plan) => plan.id === payload.booking.confirmation?.planId
  );

  if (confirmationPlan) {
    return confirmationPlan;
  }

  const handoffAttempt = [...payload.booking.attempts]
    .reverse()
    .find((attempt) => attempt.status === "needs_user_action");
  const handoffPlan = payload.recommendations.find(
    (plan) => plan.id === handoffAttempt?.planId
  );

  if (handoffPlan) {
    return handoffPlan;
  }

  return (
    payload.recommendations.find((plan) =>
      payload.approvedPlanIds.includes(plan.id)
    ) ?? payload.recommendations[0]
  );
}

function dateWindowLabel(request: PlanningRequest) {
  const timeZone = request.timeWindow.timeZone;
  const start = new Date(request.timeWindow.start);
  const end = new Date(request.timeWindow.end);
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone
  });
  const endFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  });

  return `${dateFormatter.format(start)} - ${endFormatter.format(end)}`;
}

function statusCopy({
  bookingState,
  confirmationProvider,
  plan
}: {
  bookingState: BookingState;
  confirmationProvider?: "mock" | "handoff";
  plan?: PlanRecommendation;
}): Pick<SharePlanSnapshot, "status" | "statusLabel" | "statusDetail"> {
  const guidance = plan ? getReservationGuidance(plan) : undefined;

  if (guidance?.need === "walk_in_likely" && bookingState === "booked") {
    return {
      status: "no_booking_needed",
      statusLabel: "No booking needed",
      statusDetail:
        "This plan is set as a walk-in or line-up spot. No reservation is needed."
    };
  }

  if (bookingState === "booked" && confirmationProvider === "handoff") {
    return {
      status: guidance?.need === "call_to_confirm" ? "confirmed" : "booked",
      statusLabel:
        guidance?.need === "call_to_confirm"
          ? "Confirmed manually"
          : "Booked manually",
      statusDetail:
        "Someone finished the external step and saved this as the plan record."
    };
  }

  if (bookingState === "booked") {
    return {
      status: "booked",
      statusLabel: "Booked",
      statusDetail:
        "This plan has a booking confirmation saved in Gatherwise."
    };
  }

  if (bookingState === "needs_user_action") {
    return {
      status: guidance?.need === "walk_in_likely" ? "no_booking_needed" : "needs_action",
      statusLabel:
        guidance?.need === "walk_in_likely"
          ? "No booking needed"
          : "Booking not completed yet",
      statusDetail:
        guidance?.need === "walk_in_likely"
          ? "This looks walk-in friendly. Send the plan, then head over or join the line."
          : "Use the website, Maps, or phone before treating this as fully confirmed."
    };
  }

  return {
    status: "planned",
    statusLabel: "Planned",
    statusDetail:
      "The plan has been chosen, but no booking status has been saved yet."
  };
}

function groupchatText(snapshot: Omit<SharePlanSnapshot, "shareText">) {
  const lines = [
    "Gatherwise planned it:",
    `Place: ${snapshot.placeName}`,
    snapshot.activityName ? `Extra: ${snapshot.activityName}` : undefined,
    `When: ${snapshot.dateLabel}`,
    `Group: ${snapshot.partyLabel}`,
    `Booking: ${snapshot.statusLabel}`,
    `Cost: ${snapshot.costLabel}`,
    snapshot.locationLabel ? `Location: ${snapshot.locationLabel}` : undefined,
    snapshot.mapUrl ? `Map: ${snapshot.mapUrl}` : undefined
  ].filter(Boolean);

  return lines.join("\n");
}

function buildSnapshot(payload: BookingPayload): SharePlanSnapshot | undefined {
  const plan = selectedPlanFromPayload(payload);

  if (!plan) {
    return undefined;
  }

  const place = plan.restaurant ?? plan.activity;

  if (!place) {
    return undefined;
  }

  const confirmation = payload.booking.confirmation;
  const status = statusCopy({
    bookingState: payload.booking.state,
    confirmationProvider: confirmation?.provider,
    plan
  });
  const partyLabel = `${payload.request.groupProfile.numberOfPeople} ${payload.request.groupProfile.typeOfPeople}`;
  const locationLabel =
    place.formattedAddress ??
    [place.neighborhood, place.locality, place.region].filter(Boolean).join(", ");
  const snapshotWithoutShareText = {
    version: 1 as const,
    requestId: payload.request.id,
    placeName: place.name,
    activityName: plan.restaurant ? plan.activity?.name : undefined,
    dateLabel: dateWindowLabel(payload.request),
    partyLabel,
    ...status,
    confirmationCode: confirmation?.confirmationCode,
    costLabel: `${formatMoney(plan.estimatedCostPerPerson)}/person, about ${formatMoney(
      plan.estimatedCostTotal
    )} total`,
    locationLabel,
    travelNotes: plan.travelNotes,
    mapUrl: place.googleMapsUri,
    websiteUrl: place.websiteUri,
    phoneUrl:
      place.internationalPhoneNumber || place.nationalPhoneNumber
        ? `tel:${place.internationalPhoneNumber ?? place.nationalPhoneNumber}`
        : undefined,
    occasionLabel: toTitle(payload.request.occasion),
    vibeLabel: payload.request.vibe.map(toTitle).join(", "),
    shareTitle: `Gatherwise plan: ${place.name}`
  };

  return {
    ...snapshotWithoutShareText,
    shareText: groupchatText(snapshotWithoutShareText)
  };
}

function encodeSnapshot(snapshot: SharePlanSnapshot) {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeSnapshot(value: string): SharePlanSnapshot | undefined {
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as SharePlanSnapshot;

    return parsed.version === 1 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function snapshotFromHash() {
  if (typeof window === "undefined") {
    return undefined;
  }

  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const encoded = params.get("plan");

  return encoded ? decodeSnapshot(encoded) : undefined;
}

function shareUrl(snapshot: SharePlanSnapshot) {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  url.hash = `plan=${encodeSnapshot(snapshot)}`;
  return url.toString();
}

function statusClass(status: ShareStatus) {
  if (status === "no_booking_needed") {
    return "border-flax bg-flax/35 text-ink";
  }

  if (status === "booked" || status === "confirmed") {
    return "border-moss/30 bg-sage text-moss";
  }

  if (status === "needs_action") {
    return "border-coral/35 bg-coral/10 text-coral";
  }

  return "border-ink/10 bg-white/75 text-stone-700";
}

export default function ConfirmationView({ requestId }: { requestId: string }) {
  const [payload, setPayload] = useState<BookingPayload | null>(null);
  const [sharedSnapshot, setSharedSnapshot] = useState<SharePlanSnapshot | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"text" | "link" | "share" | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hashSnapshot = snapshotFromHash();
    setSharedSnapshot(hashSnapshot);

    fetch(`/api/booking?requestId=${requestId}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) {
          return;
        }

        if (data.error) {
          throw new Error(data.error);
        }

        saveClientBookingPayload(data);
        setPayload(data);
      })
      .catch((caught) => {
        if (!cancelled) {
          const savedPayload = getClientBookingPayload(requestId);

          if (savedPayload) {
            setPayload(savedPayload);
            return;
          }

          if (hashSnapshot) {
            return;
          }

          setError(caught instanceof Error ? caught.message : "Unable to load plan record.");
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

  const snapshot = useMemo(() => {
    return payload ? buildSnapshot(payload) : sharedSnapshot;
  }, [payload, sharedSnapshot]);

  async function copyText(value: string, type: "text" | "link" | "share") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  async function sharePlan() {
    if (!snapshot) {
      return;
    }

    const url = shareUrl(snapshot);

    if (navigator.share) {
      try {
        await navigator.share({
          title: snapshot.shareTitle,
          text: snapshot.shareText,
          url
        });
        setCopied("share");
        window.setTimeout(() => setCopied(null), 1800);
        return;
      } catch {
        // Fall back to copying below.
      }
    }

    await copyText(`${snapshot.shareText}\n${url}`, "share");
  }

  if (loading) {
    return (
      <PageShell compact>
        <div className="motion-panel p-6">
          <p className="text-sm font-bold text-stone-600">Loading plan card...</p>
        </div>
      </PageShell>
    );
  }

  if (error || !snapshot) {
    return (
      <PageShell compact>
        <div className="motion-panel p-6">
          <p className="font-bold text-coral">
            {error ?? "No shareable plan exists for this request yet."}
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

  const url = shareUrl(snapshot);

  return (
    <PageShell compact>
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="editorial-kicker">Shareable plan</p>
            <h1 className="display-title mt-1 text-5xl text-ink sm:text-7xl">
              Successfully planned
            </h1>
          </div>
          <span
            className={`inline-flex min-h-9 w-fit items-center gap-2 rounded-lg border px-3 text-sm font-black ${statusClass(
              snapshot.status
            )}`}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {snapshot.statusLabel}
          </span>
        </div>

        <section className="motion-panel overflow-hidden p-0">
          <div className="relative bg-gradient-to-br from-coral/20 via-cloud to-sage p-5 sm:p-7">
            <div className="absolute right-5 top-5 hidden h-20 w-20 rounded-full border border-coral/30 sm:block" />
            <div className="absolute bottom-6 right-16 hidden h-10 w-10 rounded-full border border-moss/25 sm:block" />
            <div className="relative">
              <p className="text-xs font-black uppercase text-coral">Gatherwise plan card</p>
              <h2 className="display-title mt-2 max-w-3xl text-5xl text-ink sm:text-7xl">
                {snapshot.placeName}
              </h2>
              {snapshot.activityName ? (
                <p className="mt-2 text-lg font-black text-moss">
                  Plus {snapshot.activityName}
                </p>
              ) : null}
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-700">
                {snapshot.statusDetail}
              </p>
            </div>
          </div>

          <div className="grid gap-0 border-t border-ink/10 md:grid-cols-2">
            <div className="border-b border-ink/10 p-4 md:border-r">
              <p className="flex items-center gap-2 text-sm font-black text-ink">
                <CalendarClock className="h-4 w-4 text-coral" aria-hidden="true" />
                When
              </p>
              <p className="mt-2 text-sm font-semibold text-stone-700">
                {snapshot.dateLabel}
              </p>
            </div>
            <div className="border-b border-ink/10 p-4">
              <p className="flex items-center gap-2 text-sm font-black text-ink">
                <Users className="h-4 w-4 text-coral" aria-hidden="true" />
                Who
              </p>
              <p className="mt-2 text-sm font-semibold text-stone-700">
                {snapshot.partyLabel}
              </p>
            </div>
            <div className="border-b border-ink/10 p-4 md:border-r md:border-b-0">
              <p className="flex items-center gap-2 text-sm font-black text-ink">
                <DollarSign className="h-4 w-4 text-coral" aria-hidden="true" />
                Estimate
              </p>
              <p className="mt-2 text-sm font-semibold text-stone-700">
                {snapshot.costLabel}
              </p>
            </div>
            <div className="p-4">
              <p className="flex items-center gap-2 text-sm font-black text-ink">
                <PartyPopper className="h-4 w-4 text-coral" aria-hidden="true" />
                Occasion
              </p>
              <p className="mt-2 text-sm font-semibold text-stone-700">
                {snapshot.occasionLabel}
                {snapshot.vibeLabel ? `, ${snapshot.vibeLabel}` : ""}
              </p>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="motion-panel p-5">
            <p className="flex items-center gap-2 text-sm font-black text-ink">
              <Sparkles className="h-4 w-4 text-coral" aria-hidden="true" />
              Groupchat version
            </p>
            <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-ink/10 bg-white/75 p-4 text-sm leading-6 text-stone-700">
              {snapshot.shareText}
            </pre>
            {snapshot.confirmationCode ? (
              <div className="mt-3 rounded-lg border border-moss/20 bg-sage px-3 py-2 text-sm text-moss">
                Record code: <span className="font-black">{snapshot.confirmationCode}</span>
              </div>
            ) : null}
          </section>

          <aside className="motion-panel p-5">
            <p className="text-sm font-black text-ink">Send it</p>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                className="action-primary justify-center"
                onClick={() => void sharePlan()}
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                {copied === "share" ? "Ready to send" : "Share plan"}
              </button>
              <button
                type="button"
                className="action-secondary justify-center"
                onClick={() => void copyText(snapshot.shareText, "text")}
              >
                <Clipboard className="h-4 w-4" aria-hidden="true" />
                {copied === "text" ? "Copied" : "Copy text"}
              </button>
              <button
                type="button"
                className="action-secondary justify-center"
                onClick={() => void copyText(url, "link")}
              >
                <Link2 className="h-4 w-4" aria-hidden="true" />
                {copied === "link" ? "Copied" : "Copy share link"}
              </button>
            </div>

            <div className="mt-4 grid gap-2 border-t border-ink/10 pt-4">
              {snapshot.mapUrl ? (
                <a
                  href={snapshot.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="action-secondary justify-center"
                >
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  Open map
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : null}
              {snapshot.websiteUrl ? (
                <a
                  href={snapshot.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="action-secondary justify-center"
                >
                  Website
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </aside>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/booking/${requestId}`}
            className="action-secondary"
          >
            Booking details
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
