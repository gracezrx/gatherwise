"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ClipboardList,
  ExternalLink,
  Globe,
  MapPin,
  Phone,
  RefreshCw
} from "lucide-react";
import PageShell from "./PageShell";
import { BookingStateBadge } from "./StatusBadge";
import {
  applyClientManualConfirmation,
  getClientBookingPayload,
  saveClientBookingPayload
} from "@/lib/clientSessionStore";
import type {
  BookingSummary,
  PlanRecommendation,
  PlanningRequest,
  ReservationDiscovery,
  ReservationSource,
  ReservationSourceProvider,
  ReservationSourceStatus
} from "@/lib/types";
import { getReservationGuidance } from "@/lib/reservationGuidance";
import { formatMoney } from "@/lib/utils";

interface BookingPayload {
  request: PlanningRequest;
  recommendations: PlanRecommendation[];
  approvedPlanIds: string[];
  booking: BookingSummary;
}

const SOURCE_STATUS_LABELS: Record<ReservationSourceStatus, string> = {
  checked: "Checked",
  found: "Found",
  not_found: "Not found",
  search_ready: "Search ready",
  failed: "Could not check",
  not_needed: "Not needed"
};

function iconForProvider(provider: ReservationSourceProvider) {
  if (provider === "phone") return Phone;
  if (provider === "maps" || provider === "google_places") return MapPin;
  if (provider === "restaurant_website") return Globe;
  return CalendarCheck;
}

function sourceStatusClass(status: ReservationSourceStatus) {
  if (status === "found") return "border-moss/20 bg-sage text-moss";
  if (status === "search_ready") return "border-flax bg-flax/35 text-ink";
  if (status === "failed") return "border-stone-300 bg-stone-100 text-stone-600";
  return "border-ink/10 bg-white/70 text-stone-700";
}

function ReservationSourceCard({ source }: { source: ReservationSource }) {
  const Icon = iconForProvider(source.provider);

  return (
    <div className="rounded-lg border border-ink/10 bg-white/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-black text-ink">{source.label}</p>
            <p className="mt-1 text-xs leading-5 text-stone-600">{source.reason}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] font-black uppercase ${sourceStatusClass(
            source.status
          )}`}
        >
          {SOURCE_STATUS_LABELS[source.status]}
        </span>
      </div>
    </div>
  );
}

function actionLinksFor({
  discovery,
  plan
}: {
  discovery?: ReservationDiscovery;
  plan: PlanRecommendation;
}) {
  const links: Array<{
    key: string;
    label: string;
    url: string;
    provider: ReservationSourceProvider;
    primary?: boolean;
  }> = [];
  const seen = new Set<string>();
  const push = (
    key: string,
    label: string,
    url: string | undefined,
    provider: ReservationSourceProvider,
    primary = false
  ) => {
    if (!url || seen.has(url)) {
      return;
    }

    seen.add(url);
    links.push({ key, label, url, provider, primary });
  };

  push(
    "best",
    discovery?.bestAction?.label ?? "Open best link",
    discovery?.bestAction?.url,
    discovery?.bestAction?.provider ?? "restaurant_website",
    true
  );

  for (const source of discovery?.sources ?? []) {
    const isUnconfirmedProviderSearch =
      (source.provider === "opentable" || source.provider === "resy") &&
      source.status === "search_ready";

    if (
      !source.url ||
      isUnconfirmedProviderSearch ||
      !["found", "checked"].includes(source.status)
    ) {
      continue;
    }

    const label =
      source.provider === "opentable"
        ? "Open OpenTable"
        : source.provider === "resy"
          ? "Open Resy"
          : source.provider === "google_places"
            ? "Open Google"
            : source.label;
    push(`${source.provider}-${source.status}`, label, source.url, source.provider);
  }

  push(
    "maps",
    "Open Maps",
    plan.restaurant?.googleMapsUri ?? plan.activity?.googleMapsUri,
    "maps"
  );
  push(
    "website",
    "Website",
    plan.restaurant?.websiteUri ?? plan.activity?.websiteUri,
    "restaurant_website"
  );
  push(
    "phone",
    plan.restaurant?.nationalPhoneNumber ?? plan.activity?.nationalPhoneNumber ?? "Call",
    plan.restaurant?.internationalPhoneNumber ||
      plan.restaurant?.nationalPhoneNumber ||
      plan.activity?.internationalPhoneNumber ||
      plan.activity?.nationalPhoneNumber
      ? `tel:${
          plan.restaurant?.internationalPhoneNumber ??
          plan.restaurant?.nationalPhoneNumber ??
          plan.activity?.internationalPhoneNumber ??
          plan.activity?.nationalPhoneNumber
        }`
      : undefined,
    "phone"
  );

  return links.slice(0, 5);
}

function AttemptRow({
  attempt,
  plan
}: {
  attempt: BookingSummary["attempts"][number];
  plan?: PlanRecommendation;
}) {
  const guidance = plan ? getReservationGuidance(plan) : undefined;
  const timeFit = plan?.restaurant?.timeFit ?? plan?.activity?.timeFit;
  const displayName = plan?.restaurant?.name ?? plan?.activity?.name ?? "Plan unavailable";
  const displayMessage =
    attempt.reservationDiscovery?.summary ??
    (attempt.provider === "handoff" &&
    attempt.status === "needs_user_action" &&
    guidance
      ? `${guidance.label}. ${guidance.detail}${
          timeFit ? ` ${timeFit.label}: ${timeFit.detail}` : ""
        }`
      : attempt.message);

  return (
    <div className="interactive-card grid gap-3 p-4 sm:grid-cols-[150px_minmax(0,1fr)_130px] sm:items-start">
      <div>
        <p className="text-xs font-black uppercase text-stone-500">Rank {attempt.planRank}</p>
        <p className="mt-1 text-sm font-bold text-ink">
          {displayName}
        </p>
      </div>
      <div>
        <p className="text-sm leading-6 text-stone-700">{displayMessage}</p>
        {plan?.restaurant && plan.activity ? (
          <p className="mt-1 text-xs font-semibold text-stone-500">
            Includes {plan.activity.name}
          </p>
        ) : null}
      </div>
      <div className="sm:justify-self-end">
        <BookingStateBadge state={attempt.status} />
      </div>
    </div>
  );
}

export default function BookingStatus({ requestId }: { requestId: string }) {
  const [payload, setPayload] = useState<BookingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
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

          setError(caught instanceof Error ? caught.message : "Unable to load booking status.");
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

  const planById = useMemo(() => {
    return new Map(payload?.recommendations.map((plan) => [plan.id, plan]) ?? []);
  }, [payload]);

  const handoffAttempt = useMemo(() => {
    return [...(payload?.booking.attempts ?? [])]
      .reverse()
      .find((attempt) => attempt.status === "needs_user_action");
  }, [payload]);

  const handoffPlan = handoffAttempt ? planById.get(handoffAttempt.planId) : undefined;
  const approvedPlans = useMemo(() => {
    if (!payload) {
      return [];
    }

    return payload.approvedPlanIds
      .map((planId) => planById.get(planId))
      .filter((plan): plan is PlanRecommendation => Boolean(plan));
  }, [payload, planById]);
  const handoffGuidance = handoffPlan
    ? getReservationGuidance(handoffPlan)
    : undefined;
  const handoffDiscovery = handoffAttempt?.reservationDiscovery;
  const handoffActionLinks = handoffPlan
    ? actionLinksFor({ discovery: handoffDiscovery, plan: handoffPlan })
    : [];
  const handoffName =
    handoffDiscovery?.restaurant.displayName ??
    handoffPlan?.restaurant?.name ??
    handoffPlan?.activity?.name ??
    "this plan";
  const handoffTimeFit = handoffPlan?.restaurant?.timeFit ?? handoffPlan?.activity?.timeFit;
  const handoffIsActivityOnly = Boolean(handoffPlan?.activity && !handoffPlan.restaurant);

  async function markManualBooked(planId?: string) {
    setActionLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/booking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, planId })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to mark booking complete.");
      }

      saveClientBookingPayload(data);
      setPayload(data);
    } catch (caught) {
      if (payload) {
        setPayload(applyClientManualConfirmation(payload, planId));
        return;
      }

      setError(caught instanceof Error ? caught.message : "Unable to mark booking complete.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <PageShell compact>
        <div className="motion-panel p-6">
          <p className="flex items-center gap-2 text-sm font-bold text-stone-600">
            <CircleDashed className="h-4 w-4 animate-spin text-coral" aria-hidden="true" />
            Loading booking history...
          </p>
        </div>
      </PageShell>
    );
  }

  if (error || !payload) {
    return (
      <PageShell compact>
        <div className="motion-panel p-6">
          <p className="font-bold text-coral">{error ?? "Booking status not found."}</p>
          <Link href="/" className="action-primary mt-4">
            Start over
          </Link>
        </div>
      </PageShell>
    );
  }

  const confirmation = payload.booking.confirmation;

  return (
    <PageShell compact>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="editorial-kicker">
            {payload.booking.state === "needs_user_action"
              ? "Booking landing page"
              : "Booking status"}
          </p>
          <h1 className="display-title mt-1 text-5xl text-ink sm:text-7xl">
            {payload.booking.state === "needs_user_action"
              ? "Choose where to continue"
              : "Fallback attempt history"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            {payload.booking.state === "needs_user_action"
              ? "Nothing opens automatically. Pick the official website, Maps, phone, or a confirmed reservation link when one is available."
              : "Approved plans were tried in your booking order. The same request can be refreshed without creating duplicate attempts."}
          </p>
        </div>
        <BookingStateBadge state={payload.booking.state} />
      </div>

      <div className="motion-panel mb-5 p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-black uppercase text-stone-500">Party</p>
            <p className="mt-1 text-sm font-bold text-ink">
              {payload.request.groupProfile.numberOfPeople} {payload.request.groupProfile.typeOfPeople}
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-stone-500">Window</p>
            <p className="mt-1 text-sm font-bold text-ink">
              {new Date(payload.request.timeWindow.start).toLocaleString()} -{" "}
              {new Date(payload.request.timeWindow.end).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit"
              })}
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-stone-500">Budget</p>
            <p className="mt-1 text-sm font-bold text-ink">
              {formatMoney(payload.request.budgetPerPerson)}/person
            </p>
          </div>
        </div>
      </div>

      {payload.booking.state === "needs_user_action" && handoffPlan ? (
        <div className="motion-panel mb-5 border-coral/20 bg-cloud p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="editorial-kicker">Next step</p>
              <h2 className="display-title mt-1 text-4xl text-ink">
                {handoffIsActivityOnly
                  ? `Open details for ${handoffName}`
                  : handoffGuidance?.need === "walk_in_likely"
                    ? `No booking needed for ${handoffName}`
                    : `Choose a booking link for ${handoffName}`}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
                Use one of these links yourself. Gatherwise will not send you straight to an
                outside site, and OpenTable or Resy only show here when a direct provider link was
                found.
              </p>
            </div>
            <BookingStateBadge state="needs_user_action" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {handoffActionLinks.map((actionLink) => {
              const Icon = iconForProvider(actionLink.provider);
              return (
                <a
                  key={actionLink.key}
                  href={actionLink.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`${
                    actionLink.primary ? "action-primary" : "action-secondary"
                  } justify-center`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {actionLink.label}
                  {actionLink.url.startsWith("tel:") ? null : (
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  )}
                </a>
              );
            })}
            <button
              type="button"
              className="action-primary justify-center disabled:cursor-wait"
              disabled={actionLoading}
              onClick={() => void markManualBooked(handoffPlan.id)}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {actionLoading ? "Saving..." : handoffGuidance?.actionLabel ?? "I'm set"}
            </button>
          </div>
        </div>
      ) : null}

      {payload.booking.attempts.length === 0 ? (
        <div className="motion-panel border-flax p-6">
          <p className="font-black text-ink">No booking attempts yet.</p>
          <p className="mt-2 text-sm text-stone-600">
            Return to review and approve one or more ranked plans.
          </p>
          <Link
            href={`/plans/${requestId}`}
            className="action-primary mt-4"
          >
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Review plans
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <div className="mb-3">
            <p className="text-sm font-black text-ink">Attempt history</p>
            <p className="text-xs font-semibold text-stone-500">
              This is the transparent log of what Gatherwise checked.
            </p>
          </div>
          <div className="grid gap-3">
            {payload.booking.attempts.map((attempt) => (
              <AttemptRow
                key={attempt.id}
                attempt={attempt}
                plan={planById.get(attempt.planId)}
              />
            ))}
          </div>
        </div>
      )}

      {payload.booking.state === "needs_user_action" && handoffPlan ? (
        <div className="motion-panel mt-6 border-flax bg-flax/20 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="editorial-kicker">
                {handoffIsActivityOnly ? "Plan details" : "Reservation details"}
              </p>
              <h2 className="display-title mt-1 text-4xl text-ink">
                {handoffIsActivityOnly
                  ? `Confirm ${handoffName}`
                  : handoffGuidance?.need === "walk_in_likely"
                    ? `No booking needed for ${handoffName}`
                    : handoffGuidance?.need === "call_to_confirm"
                      ? `Confirm ${handoffName}`
                      : `Finish booking ${handoffName}`}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
                {handoffIsActivityOnly
                  ? "Use the website, Maps, or phone number to confirm hours, tickets, or entry requirements. Then mark it set here."
                  : handoffGuidance?.need === "walk_in_likely"
                    ? "Gatherwise found the place and it does not look like a reservation spot. Walk in, join the line if it is busy, and mark it set here."
                    : handoffGuidance?.need === "call_to_confirm"
                      ? "Gatherwise did not find a direct booking window here. Use the website, Maps, or phone number to confirm whether they take reservations."
                      : "Gatherwise matched the restaurant, checked booking sources, and prepared the best next action. Complete the reservation externally, then mark it booked here."}
              </p>
              {handoffGuidance ? (
                <div className="mt-3 rounded-lg border border-ink/10 bg-white/70 px-3 py-2 text-sm text-stone-700">
                  <p className="font-black text-ink">{handoffGuidance.label}</p>
                  <p>{handoffGuidance.detail}</p>
                </div>
              ) : null}
              {handoffTimeFit ? (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-ink/10 bg-white/70 px-3 py-2 text-sm text-stone-700">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
                  <div>
                    <p className="font-black text-ink">{handoffTimeFit.label}</p>
                    <p>{handoffTimeFit.detail}</p>
                  </div>
                </div>
              ) : null}
              {handoffDiscovery ? (
                <div className="mt-3 rounded-lg border border-ink/10 bg-white/70 px-3 py-2 text-sm text-stone-700">
                  <p className="font-black text-ink">
                    Matched location
                    {typeof handoffDiscovery.restaurant.distanceMiles === "number"
                      ? `, ${handoffDiscovery.restaurant.distanceMiles.toFixed(1)} mi away`
                      : ""}
                  </p>
                  <p>{handoffDiscovery.restaurant.matchReason}</p>
                  {handoffDiscovery.restaurant.formattedAddress ? (
                    <p className="mt-1 text-xs font-semibold text-stone-500">
                      {handoffDiscovery.restaurant.formattedAddress}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <BookingStateBadge state="needs_user_action" />
          </div>

          {handoffDiscovery ? (
            <div className="mt-5">
              <p className="text-sm font-black text-ink">Sources checked</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {handoffDiscovery.sources.map((reservationSource, index) => (
                  <ReservationSourceCard
                    key={`${reservationSource.provider}-${index}`}
                    source={reservationSource}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {handoffDiscovery?.availableTimes.length ? (
            <div className="mt-5 rounded-lg border border-moss/20 bg-sage p-3">
              <p className="text-sm font-black text-moss">Available times found</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {handoffDiscovery.availableTimes.map((slot) => (
                  <span
                    key={`${slot.provider}-${slot.start}`}
                    className="rounded-lg bg-white/70 px-2.5 py-1 text-xs font-black text-moss"
                  >
                    {slot.label}
                  </span>
                ))}
              </div>
            </div>
          ) : handoffDiscovery ? (
            <div className="mt-5 rounded-lg border border-ink/10 bg-white/70 px-3 py-2 text-sm text-stone-700">
              No live reservation times were confirmed safely. Gatherwise did not scrape
              OpenTable, Resy, or Google booking pages.
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {handoffActionLinks.map((actionLink) => {
              const Icon = iconForProvider(actionLink.provider);
              return (
              <a
                key={actionLink.key}
                href={actionLink.url}
                target="_blank"
                rel="noreferrer"
                className={`${
                  actionLink.primary ? "action-primary" : "action-secondary"
                } justify-center`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {actionLink.label}
                {actionLink.url.startsWith("tel:") ? null : (
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                )}
              </a>
              );
            })}
            <button
              type="button"
              className="action-primary justify-center disabled:cursor-wait"
              disabled={actionLoading}
              onClick={() => void markManualBooked(handoffPlan.id)}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {actionLoading ? "Saving..." : handoffGuidance?.actionLabel ?? "I'm set"}
            </button>
          </div>

          {approvedPlans.length > 1 ? (
            <div className="mt-5 border-t border-ink/10 pt-4">
              <p className="text-sm font-black text-ink">
                If this one is unavailable, open another approved plan.
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {approvedPlans
                  .map((plan, priorityIndex) => ({ plan, priorityIndex }))
                  .filter(({ plan }) => plan.id !== handoffPlan.id)
                  .map(({ plan, priorityIndex }) => {
                    const name = plan.restaurant?.name ?? plan.activity?.name ?? "Plan";
                    const timeFit = plan.restaurant?.timeFit ?? plan.activity?.timeFit;
                    const links = actionLinksFor({ plan });

                    return (
                      <div
                        key={plan.id}
                        className="rounded-lg border border-ink/10 bg-white/70 p-3"
                      >
                        <p className="text-xs font-black uppercase text-stone-500">
                          Priority {priorityIndex + 1} · Rank {plan.rank}
                        </p>
                        <p className="mt-1 font-black text-ink">{name}</p>
                        {timeFit ? (
                          <p className="mt-1 text-xs font-semibold text-stone-600">
                            {timeFit.label}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs font-semibold text-stone-600">
                          {getReservationGuidance(plan).label}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {links.slice(0, 3).map((link) => {
                            const Icon = iconForProvider(link.provider);
                            return (
                            <a
                              key={link.key}
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-ink/10 bg-white px-2 text-xs font-black text-ink transition duration-200 ease-smooth hover:-translate-y-0.5 hover:border-coral/40 hover:text-coral"
                            >
                              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                              {link.label}
                              {link.url.startsWith("tel:") ? null : (
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                            </a>
                            );
                          })}
                          <button
                            type="button"
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-moss/20 bg-sage px-2 text-xs font-black text-moss transition duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-moss hover:text-white disabled:cursor-wait"
                            disabled={actionLoading}
                            onClick={() => void markManualBooked(plan.id)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Mark set
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {confirmation ? (
        <div className="motion-panel mt-6 bg-sage p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="flex items-center gap-2 text-lg font-black text-moss">
                <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                {confirmation.provider === "handoff"
                  ? "Manual reservation saved"
                  : "Mock booking confirmed"}
              </p>
              <p className="mt-1 text-sm text-moss">
                {confirmation.restaurantName} for {confirmation.partySize}, confirmation{" "}
                {confirmation.confirmationCode}.
              </p>
            </div>
            <Link
              href={`/confirmation/${requestId}`}
              className="action-primary group"
            >
              View shareable plan
              <ArrowRight className="motion-arrow h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : payload.booking.state === "unavailable" || payload.booking.state === "failed" ? (
        <div className="motion-panel mt-6 p-5">
          <p className="text-lg font-black text-ink">All approved plans were exhausted.</p>
          <div className="mt-3 grid gap-2 text-sm text-stone-700">
            <div className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
              Try widening distance, changing the time window, raising budget, or choosing another neighborhood.
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              href={`/?edit=${requestId}`}
              className="action-primary"
            >
              Edit constraints
            </Link>
            <Link
              href={`/plans/${requestId}`}
              className="action-secondary"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Review plans
            </Link>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
