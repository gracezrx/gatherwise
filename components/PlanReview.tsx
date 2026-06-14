"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  MapPin,
  PenLine,
  RefreshCw,
  Sparkles,
  Utensils,
  XCircle
} from "lucide-react";
import PageShell from "./PageShell";
import { AvailabilityBadge, BookingStateBadge } from "./StatusBadge";
import type {
  PlanRecommendation,
  PlanningRequest,
  StoredPlanningSession
} from "@/lib/types";
import { getReservationGuidance } from "@/lib/reservationGuidance";
import { formatMoney, roundScore } from "@/lib/utils";

type SessionView = StoredPlanningSession & {
  noOptionsSuggestions: string[];
};

function requestPayload(request: PlanningRequest) {
  return {
    groupProfile: request.groupProfile,
    occasion: request.occasion,
    location: request.location,
    timeWindow: request.timeWindow,
    budgetPerPerson: request.budgetPerPerson,
    dietaryRestrictions: request.dietaryRestrictions,
    cuisinePreferences: request.cuisinePreferences ?? [],
    activityPreferences: request.activityPreferences,
    vibe: request.vibe
  };
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-semibold text-stone-500">
        <span>{label}</span>
        <span>{roundScore(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-lg bg-stone-200">
        <div
          className="h-full rounded-lg bg-coral transition-all duration-300 ease-smooth"
          style={{ width: `${roundScore(value)}%` }}
        />
      </div>
    </div>
  );
}

function accuracyLabel(status: PlanRecommendation["accuracyStatus"]) {
  if (status === "verified") return "Verified";
  if (status === "exploratory") return "Exploratory";
  return "Likely";
}

function accuracyClass(status: PlanRecommendation["accuracyStatus"]) {
  if (status === "verified") return "border-moss/20 bg-sage text-moss";
  if (status === "exploratory") return "border-flax bg-flax/40 text-ink";
  return "border-ink/10 bg-white/70 text-stone-700";
}

function PlaceMeta({ plan }: { plan: PlanRecommendation }) {
  const restaurant = plan.restaurant;
  const activity = plan.activity;
  const ratingText = (rating?: number, reviewCount?: number) =>
    typeof rating === "number"
      ? `${rating.toFixed(1)}${
          reviewCount ? ` (${reviewCount.toLocaleString()} reviews)` : ""
        }`
      : undefined;

  if (!restaurant && activity) {
    const activityReviewText = ratingText(activity.rating, activity.userRatingCount);

    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
        {activityReviewText ? (
          <span className="rounded-lg border border-ink/10 bg-white/70 px-2.5 py-1 text-stone-700">
            Rating {activityReviewText}
          </span>
        ) : null}
        <span className="rounded-lg border border-ink/10 bg-white/70 px-2.5 py-1 text-stone-700">
          {activity.type}
        </span>
        {activity.preferences.slice(0, 5).map((tag) => (
          <span
            key={tag}
            className="rounded-lg border border-ink/10 bg-white/70 px-2.5 py-1 text-stone-700"
          >
            {tag.replaceAll("_", " ")}
          </span>
        ))}
        {activity.formattedAddress ? (
          <span className="rounded-lg border border-ink/10 bg-white/70 px-2.5 py-1 text-stone-700">
            {activity.formattedAddress}
          </span>
        ) : null}
        {activity.timeFit ? (
          <span
            className={`rounded-lg border px-2.5 py-1 ${
              activity.timeFit.status === "open_for_window"
                ? "border-moss/20 bg-sage text-moss"
                : activity.timeFit.status === "possibly_closed"
                  ? "border-flax bg-flax/30 text-ink"
                  : "border-ink/10 bg-white/70 text-stone-700"
            }`}
            title={activity.timeFit.detail}
          >
            {activity.timeFit.label}
          </span>
        ) : null}
        {activity.googleMapsUri ? (
          <a
            href={activity.googleMapsUri}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-moss/20 bg-sage px-2.5 py-1 text-moss transition duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-moss hover:text-white"
          >
            Open map
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : null}
        {activity.websiteUri ? (
          <a
            href={activity.websiteUri}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-ink/10 bg-white/70 px-2.5 py-1 text-stone-700 transition duration-200 ease-smooth hover:-translate-y-0.5 hover:border-moss/20 hover:bg-sage hover:text-moss"
          >
            Website
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    );
  }

  if (!restaurant) {
    return null;
  }

  const reservationGuidance = getReservationGuidance(plan);
  const cuisineTags = restaurant.cuisineTags?.length
    ? restaurant.cuisineTags
    : [restaurant.cuisine].filter((tag) => tag && tag !== "Restaurant");
  const mealTypeTags = restaurant.mealTypeTags ?? [];
  const priceLevel = restaurant.googlePriceLevel?.replace("PRICE_LEVEL_", "").replace("_", " ");
  const restaurantReviewText = ratingText(restaurant.rating, restaurant.userRatingCount);
  const activityReviewText =
    activity && ratingText(activity.rating, activity.userRatingCount);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
      {restaurantReviewText ? (
        <span className="rounded-lg border border-ink/10 bg-white/70 px-2.5 py-1 text-stone-700">
          Restaurant rating {restaurantReviewText}
        </span>
      ) : null}
      {priceLevel ? (
        <span className="rounded-lg border border-ink/10 bg-white/70 px-2.5 py-1 text-stone-700">
          Price {priceLevel.toLowerCase()}
        </span>
      ) : null}
      {cuisineTags.map((tag) => (
        <span
          key={tag}
          className="rounded-lg border border-ink/10 bg-white/70 px-2.5 py-1 text-stone-700"
        >
          {tag}
        </span>
      ))}
      {mealTypeTags.map((tag) => (
        <span
          key={tag}
          className="rounded-lg border border-ink/10 bg-white/70 px-2.5 py-1 text-stone-700"
        >
          {tag}
        </span>
      ))}
      {restaurant.formattedAddress ? (
        <span className="rounded-lg border border-ink/10 bg-white/70 px-2.5 py-1 text-stone-700">
          {restaurant.formattedAddress}
        </span>
      ) : null}
      {restaurant.timeFit ? (
        <span
          className={`rounded-lg border px-2.5 py-1 ${
            restaurant.timeFit.status === "open_for_window"
              ? "border-moss/20 bg-sage text-moss"
              : restaurant.timeFit.status === "possibly_closed"
                ? "border-flax bg-flax/30 text-ink"
                : "border-ink/10 bg-white/70 text-stone-700"
          }`}
          title={restaurant.timeFit.detail}
        >
          {restaurant.timeFit.label}
        </span>
      ) : null}
      <span
        className={`rounded-lg border px-2.5 py-1 ${
          reservationGuidance.need === "reservation_recommended"
            ? "border-moss/20 bg-sage text-moss"
            : reservationGuidance.need === "walk_in_likely"
              ? "border-ink/10 bg-white/70 text-stone-700"
              : "border-flax bg-flax/30 text-ink"
        }`}
        title={reservationGuidance.detail}
      >
        {reservationGuidance.label}
      </span>
      {restaurant.reservable ? (
        <span className="rounded-lg border border-moss/20 bg-sage px-2.5 py-1 text-moss">
          Reservations listed
        </span>
      ) : null}
      {restaurant.googleMapsUri ? (
        <a
          href={restaurant.googleMapsUri}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-moss/20 bg-sage px-2.5 py-1 text-moss transition duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-moss hover:text-white"
        >
          Restaurant map
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      ) : null}
      {activityReviewText ? (
        <span className="rounded-lg border border-ink/10 bg-white/70 px-2.5 py-1 text-stone-700">
          Activity rating {activityReviewText}
        </span>
      ) : null}
      {activity?.googleMapsUri ? (
        <a
          href={activity.googleMapsUri}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-moss/20 bg-sage px-2.5 py-1 text-moss transition duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-moss hover:text-white"
        >
          Activity map
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}

function PlanCard({
  plan,
  selected,
  rejected,
  onApprove,
  onReject,
  onClear
}: {
  plan: PlanRecommendation;
  selected: boolean;
  rejected: boolean;
  onApprove: () => void;
  onReject: () => void;
  onClear: () => void;
}) {
  const restaurant = plan.restaurant;
  const activity = plan.activity;
  const isActivityOnly = !restaurant && Boolean(activity);
  const title = restaurant?.name ?? activity?.name ?? "Recommended plan";
  const subtitle = restaurant
    ? `${restaurant.cuisine} in ${restaurant.neighborhood}`
    : activity
      ? `${activity.type} in ${activity.neighborhood}`
      : "Plan details";

  return (
    <article
      data-active={selected || rejected}
      className={`interactive-card p-4 ${
        selected
          ? "border-moss/70 bg-sage/50 ring-2 ring-moss/20"
        : rejected
            ? "border-stone-300 bg-stone-100 ring-2 ring-stone-200"
            : "border-ink/10 bg-cloud"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-8 items-center rounded-lg border border-coral/25 bg-coral/10 px-3 text-xs font-black text-coral">
              No. {String(plan.rank).padStart(3, "0")}
            </span>
            <AvailabilityBadge status={plan.availabilityStatus} />
            <span
              className={`inline-flex min-h-7 items-center rounded-lg border px-2.5 text-xs font-black ${accuracyClass(
                plan.accuracyStatus
              )}`}
              title={`${plan.evidenceScore}% evidence score`}
            >
              {accuracyLabel(plan.accuracyStatus)}
            </span>
            {rejected ? (
              <span className="inline-flex min-h-7 items-center rounded-lg border border-stone-300 bg-stone-100 px-2.5 text-xs font-black text-stone-700">
                Rejected
              </span>
            ) : (
              <BookingStateBadge state={selected ? "approved" : plan.state} />
            )}
          </div>
          <h2 className="display-title text-3xl text-ink">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-stone-600">
            {subtitle}
          </p>
          {restaurant && activity ? (
            <p className="mt-2 text-sm text-stone-700">
              {plan.activityTiming === "before" ? "Before" : "After"}:{" "}
              <span className="font-bold">{activity.name}</span> ({activity.type},{" "}
              {activity.durationMinutes} min)
            </p>
          ) : isActivityOnly && activity ? (
            <p className="mt-2 text-sm text-stone-700">
              Main plan: <span className="font-bold">{activity.name}</span> (
              {activity.durationMinutes} min)
            </p>
          ) : restaurant ? (
            <p className="mt-2 text-sm text-stone-700">
              Restaurant-only plan, keeping the schedule simple.
            </p>
          ) : null}
          <PlaceMeta plan={plan} />
        </div>

        <div className="grid min-w-44 gap-2 text-sm">
          <div className="flex items-center gap-2 font-bold text-ink">
            <Sparkles className="h-4 w-4 text-coral" aria-hidden="true" />
            {plan.confidenceScore}% confidence
          </div>
          <div className="text-xs font-bold text-stone-500">
            {plan.evidenceScore}% evidence quality
          </div>
          <div className="flex items-center gap-2 text-stone-600">
            <DollarSign className="h-4 w-4 text-coral" aria-hidden="true" />
            {formatMoney(plan.estimatedCostPerPerson)}/person
          </div>
          <div className="flex items-start gap-2 text-stone-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
            <span>{plan.travelNotes}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-black text-ink">Why recommended</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {plan.whyRecommended.map((reason) => (
                <span
                  key={reason}
                  className="rounded-lg bg-sage px-2.5 py-1 text-xs font-bold text-moss"
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>

          {plan.tradeoffs.length > 0 ? (
            <div>
              <p className="text-sm font-black text-ink">Tradeoffs</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {plan.tradeoffs.map((tradeoff) => (
                  <span
                    key={tradeoff}
                    className="rounded-lg bg-flax/40 px-2.5 py-1 text-xs font-bold text-ink"
                  >
                    {tradeoff}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {plan.qualityWarnings.length > 0 ? (
            <div>
              <p className="text-sm font-black text-ink">Accuracy notes</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {plan.qualityWarnings.map((warning) => (
                  <span
                    key={warning}
                    className="rounded-lg border border-flax bg-flax/35 px-2.5 py-1 text-xs font-bold text-ink"
                  >
                    {warning}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 rounded-lg border border-ink/10 bg-mist p-3">
          <BreakdownBar label="Occasion" value={plan.scoreBreakdown.occasionFit} />
          <BreakdownBar label="Group" value={plan.scoreBreakdown.groupFit} />
          <BreakdownBar label="Capacity" value={plan.scoreBreakdown.capacity} />
          <BreakdownBar label="Distance" value={plan.scoreBreakdown.distance} />
          <BreakdownBar label="Budget" value={plan.scoreBreakdown.budget} />
          {restaurant ? (
            <>
              <BreakdownBar label="Dietary" value={plan.scoreBreakdown.dietary} />
              <BreakdownBar label="Vibe" value={plan.scoreBreakdown.vibe} />
            </>
          ) : null}
          <BreakdownBar label="Google quality" value={plan.scoreBreakdown.quality} />
          <BreakdownBar label="Availability" value={plan.scoreBreakdown.availability} />
        </div>
      </div>

      <div className="mt-4 border-t border-ink/10 pt-4">
        <div className="rounded-lg border border-ink/10 bg-mist p-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              className="action-approve px-3"
              data-active={selected}
              aria-pressed={selected}
              onClick={onApprove}
              title="Approve this plan"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {selected ? "Approved" : "Approve"}
            </button>

            <button
              type="button"
              className="action-reject px-3"
              data-active={rejected}
              aria-pressed={rejected}
              onClick={onReject}
              title="Reject this plan"
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              {rejected ? "Rejected" : "Reject"}
            </button>

            <button
              type="button"
              className="action-secondary px-3 font-bold"
              onClick={onClear}
              disabled={!selected && !rejected}
              title="Clear choice"
            >
              Undecided
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function PlanReview({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionView | null>(null);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [rejectedPlanIds, setRejectedPlanIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/plans?id=${requestId}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) {
          return;
        }
        if (data.error) {
          throw new Error(data.error);
        }
        setSession(data);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Unable to load plans.");
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

  const selectedCount = selectedPlanIds.length;
  const selectedPlans = useMemo(() => {
    if (!session) {
      return [];
    }

    const plansById = new Map(session.recommendations.map((plan) => [plan.id, plan]));
    return selectedPlanIds
      .map((planId) => plansById.get(planId))
      .filter((plan): plan is PlanRecommendation => Boolean(plan));
  }, [selectedPlanIds, session]);
  const selectedRanks = useMemo(() => {
    return selectedPlans
      .map((plan) => `#${plan.rank}`)
      .join(", ");
  }, [selectedPlans]);

  const rejectedCount = rejectedPlanIds.length;

  function moveSelectedPlan(planId: string, direction: -1 | 1) {
    setSelectedPlanIds((current) => {
      const index = current.indexOf(planId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  async function regenerate() {
    if (!session) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload(session.request))
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to regenerate plans.");
      }
      router.push(`/plans/${data.request.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to regenerate plans.");
    } finally {
      setActionLoading(false);
    }
  }

  async function approveAndContinue() {
    if (selectedPlanIds.length === 0) {
      setError("Approve at least one plan before continuing.");
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, approvedPlanIds: selectedPlanIds })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to start booking.");
      }

      router.push(`/booking/${requestId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to prepare next steps.");
    } finally {
      setActionLoading(false);
    }
  }

  async function recordPlanFeedback(planId: string, status: "rejected") {
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, planId, status })
      });
    } catch {
      // Feedback is a personalization signal; it should not block review actions.
    }
  }

  if (loading) {
    return (
      <PageShell compact>
        <div className="motion-panel p-6">
          <p className="text-sm font-bold text-stone-600">Loading ranked plans...</p>
        </div>
      </PageShell>
    );
  }

  if (error && !session) {
    return (
      <PageShell compact>
        <div className="motion-panel border-coral/30 p-6">
          <p className="font-bold text-coral">{error}</p>
          <Link href="/" className="action-primary mt-4">
            Start over
          </Link>
        </div>
      </PageShell>
    );
  }

  if (!session) {
    return null;
  }

  const hasRestaurantPlans = session.recommendations.some((plan) => Boolean(plan.restaurant));
  const accuracyCounts = session.recommendations.reduce(
    (counts, plan) => ({
      ...counts,
      [plan.accuracyStatus]: counts[plan.accuracyStatus] + 1
    }),
    { verified: 0, likely: 0, exploratory: 0 } as Record<
      PlanRecommendation["accuracyStatus"],
      number
    >
  );
  const exactMatchCount = accuracyCounts.verified + accuracyCounts.likely;

  return (
    <PageShell compact>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="editorial-kicker">Review before booking</p>
          <h1 className="display-title mt-1 text-5xl text-ink sm:text-7xl">Ranked plans</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            The agent ranked options by what you asked for, group fit, capacity, distance, budget,
            quality, and availability. After you approve, Gatherwise shows a next-step page first.
            Nothing opens automatically.
          </p>
          {session.recommendations.length > 0 ? (
            <p className="mt-2 max-w-3xl text-sm font-bold text-stone-700">
              {exactMatchCount} category-first matches
              {accuracyCounts.exploratory > 0
                ? `, ${accuracyCounts.exploratory} exploratory option marked with warnings.`
                : ", no exploratory options added."}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/?edit=${requestId}`}
            className="action-secondary"
          >
            <PenLine className="h-4 w-4" aria-hidden="true" />
            Edit constraints
          </Link>
          <button
            type="button"
            className="action-secondary disabled:cursor-wait"
            onClick={() => void regenerate()}
            disabled={actionLoading}
            title="Regenerate"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Regenerate
          </button>
        </div>
      </div>

      {session.recommendations.length === 0 ? (
        <div className="motion-panel p-6">
          <p className="text-lg font-black text-ink">No strong options matched.</p>
          <div className="mt-3 grid gap-2">
            {session.noOptionsSuggestions.map((suggestion) => (
              <div key={suggestion} className="flex items-center gap-2 text-sm text-stone-700">
                <Sparkles className="h-4 w-4 text-coral" aria-hidden="true" />
                {suggestion}
              </div>
            ))}
          </div>
          <Link
            href={`/?edit=${requestId}`}
            className="action-primary mt-5"
          >
            Adjust constraints
          </Link>
        </div>
      ) : (
        <>
          <div className="motion-panel sticky top-0 z-10 mb-4 p-4 backdrop-blur">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm text-stone-600">
                <span className="font-black text-ink">{selectedCount}</span> approved in booking order
                {selectedRanks ? ` (${selectedRanks})` : ""}.{" "}
                <span className="font-black text-stone-700">{rejectedCount}</span> rejected.
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="action-secondary min-h-10 px-3"
                  onClick={() => {
                    const topPlanIds = session.recommendations
                      .slice(0, 3)
                      .map((plan) => plan.id);
                    setSelectedPlanIds(topPlanIds);
                    setRejectedPlanIds((current) =>
                      current.filter((id) => !topPlanIds.includes(id))
                    );
                  }}
                  title="Approve top three"
                >
                  <CheckCircle2 className="h-4 w-4 text-moss" aria-hidden="true" />
                  Approve top 3
                </button>
                <button
                  type="button"
                  className="action-primary min-h-10"
                  onClick={() => void approveAndContinue()}
                  disabled={selectedCount === 0 || actionLoading}
                  title="Approve selected and review next steps"
                >
                  <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                  {actionLoading ? "Preparing..." : "Approve & review links"}
                </button>
              </div>
            </div>
            {selectedPlans.length > 1 ? (
              <div className="mt-4 rounded-lg border border-ink/10 bg-white/60 p-3">
                <p className="text-xs font-black uppercase text-stone-500">
                  Booking order
                </p>
                <div className="mt-2 grid gap-2 lg:grid-cols-3">
                  {selectedPlans.map((plan, index) => {
                    const planName =
                      plan.restaurant?.name ?? plan.activity?.name ?? "Selected plan";

                    return (
                      <div
                        key={plan.id}
                        className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-ink/10 bg-white/80 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase text-coral">
                            Priority {index + 1} · Rank {plan.rank}
                          </p>
                          <p className="truncate text-sm font-black text-ink">{planName}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 bg-white text-ink transition duration-200 ease-smooth hover:-translate-y-0.5 hover:border-coral/40 hover:text-coral disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0"
                            onClick={() => moveSelectedPlan(plan.id, -1)}
                            disabled={index === 0}
                            title="Move earlier"
                            aria-label={`Move ${planName} earlier`}
                          >
                            <ArrowUp className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 bg-white text-ink transition duration-200 ease-smooth hover:-translate-y-0.5 hover:border-coral/40 hover:text-coral disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0"
                            onClick={() => moveSelectedPlan(plan.id, 1)}
                            disabled={index === selectedPlans.length - 1}
                            title="Move later"
                            aria-label={`Move ${planName} later`}
                          >
                            <ArrowDown className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {error ? (
              <div className="mt-3 rounded-lg border border-stone-300 bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-700">
                {error}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4">
            {session.recommendations.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedPlanIds.includes(plan.id)}
                rejected={rejectedPlanIds.includes(plan.id)}
                onApprove={() => {
                  setSelectedPlanIds((current) =>
                    current.includes(plan.id) ? current : [...current, plan.id]
                  );
                  setRejectedPlanIds((current) =>
                    current.filter((id) => id !== plan.id)
                  );
                }}
                onReject={() => {
                  setRejectedPlanIds((current) =>
                    current.includes(plan.id) ? current : [...current, plan.id]
                  );
                  setSelectedPlanIds((current) =>
                    current.filter((id) => id !== plan.id)
                  );
                  void recordPlanFeedback(plan.id, "rejected");
                }}
                onClear={() => {
                  setSelectedPlanIds((current) =>
                    current.filter((id) => id !== plan.id)
                  );
                  setRejectedPlanIds((current) =>
                    current.filter((id) => id !== plan.id)
                  );
                }}
              />
            ))}
          </div>
        </>
      )}

      <div className="motion-panel mt-6 p-4 text-sm text-stone-600">
        <div className="flex items-center gap-2 font-bold text-ink">
          <Utensils className="h-4 w-4 text-coral" aria-hidden="true" />
          Planning request
        </div>
        <p className="mt-2">
          {session.request.groupProfile.numberOfPeople} {session.request.groupProfile.typeOfPeople},{" "}
          {session.request.occasion}, {formatMoney(session.request.budgetPerPerson)}/person
          {hasRestaurantPlans
            ? `, ${
                (session.request.cuisinePreferences ?? []).length > 0
                  ? `cuisine: ${(session.request.cuisinePreferences ?? []).join(", ")}, `
                  : ""
              }${
                session.request.dietaryRestrictions.length > 0
                  ? `dietary: ${session.request.dietaryRestrictions.join(", ")}`
                  : "no dietary restrictions"
              }, vibe: ${session.request.vibe.join(", ")}.`
            : "."}
        </p>
      </div>
    </PageShell>
  );
}
