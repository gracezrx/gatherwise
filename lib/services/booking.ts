import type {
  BookingAttempt,
  BookingConfirmation,
  BookingState,
  PlanRecommendation,
  PlanningRequest,
  ReservationDiscovery
} from "@/lib/types";
import { createId } from "@/lib/utils";
import type {
  AvailabilityProvider,
  BookingProvider,
  ReservationDiscoveryProvider
} from "@/lib/providers/interfaces";
import { mockProviderBundle } from "@/lib/providers/mockProviders";
import {
  getPlanningSession,
  saveBookingResult,
  setApprovedPlanIds
} from "@/lib/store/localDb";
import { getReservationGuidance } from "@/lib/reservationGuidance";
import { safeReservationDiscoveryProvider } from "@/lib/services/reservationDiscovery";
import { transitionBookingState } from "./stateMachine";

export interface BookingFlowResult {
  state: BookingState;
  attempts: BookingAttempt[];
  confirmation?: BookingConfirmation;
}

function attemptRecord(
  requestId: string,
  plan: PlanRecommendation,
  status: BookingState,
  message: string,
  startedAt = new Date().toISOString(),
  provider: BookingAttempt["provider"] = "mock",
  reservationDiscovery?: ReservationDiscovery
): BookingAttempt {
  return {
    id: createId("attempt"),
    requestId,
    planId: plan.id,
    planRank: plan.rank,
    provider,
    status,
    message,
    startedAt,
    completedAt: new Date().toISOString(),
    reservationDiscovery
  };
}

function shouldUseHandoff(plan: PlanRecommendation) {
  return (
    plan.restaurant?.source === "google_places" ||
    plan.activity?.source === "google_places"
  );
}

function planDisplayName(plan: PlanRecommendation) {
  return plan.restaurant?.name ?? plan.activity?.name ?? "Selected plan";
}

function handoffMessage(request: PlanningRequest, plan: PlanRecommendation) {
  if (!plan.restaurant && plan.activity) {
    const links = [
      plan.activity.googleMapsUri ? "Google Maps" : undefined,
      plan.activity.websiteUri ? "website" : undefined,
      plan.activity.nationalPhoneNumber ? "phone" : undefined
    ].filter(Boolean);
    const timeNote = plan.activity.timeFit
      ? ` ${plan.activity.timeFit.label}: ${plan.activity.timeFit.detail}`
      : "";
    const requestText = `Requested for ${request.groupProfile.numberOfPeople} at ${new Date(
      request.timeWindow.start
    ).toLocaleString()}.`;

    return `Use ${links.length > 0 ? links.join(", ") : "venue details"} to confirm tickets, hours, or entry requirements. ${requestText}${timeNote}`;
  }

  if (!plan.restaurant) {
    return "Use the venue details to confirm hours, tickets, or entry requirements.";
  }

  const guidance = getReservationGuidance(plan);
  const links = [
    plan.restaurant?.googleMapsUri ? "Google Maps" : undefined,
    plan.restaurant?.websiteUri ? "restaurant website" : undefined,
    plan.restaurant?.nationalPhoneNumber ? "phone" : undefined
  ].filter(Boolean);
  const timeNote = plan.restaurant.timeFit
    ? ` ${plan.restaurant.timeFit.label}: ${plan.restaurant.timeFit.detail}`
    : "";
  const requestText = `Requested for ${request.groupProfile.numberOfPeople} at ${new Date(
    request.timeWindow.start
  ).toLocaleString()}.`;

  if (guidance.need === "walk_in_likely") {
    return `${guidance.label}. ${guidance.detail} ${requestText}${timeNote}`;
  }

  const linkText =
    guidance.need === "reservation_recommended"
      ? links.length > 0
        ? `Use ${links.join(", ")} or OpenTable to reserve.`
        : "Use OpenTable or venue contact details to reserve."
      : links.length > 0
        ? `Use ${links.join(", ")} to confirm whether reservations are accepted.`
        : "Use the venue contact details to confirm whether reservations are accepted.";

  return `${linkText} Gatherwise cannot complete this step without an official reservation API. ${requestText}${timeNote}`;
}

export async function runBookingFallback(
  request: PlanningRequest,
  plans: PlanRecommendation[],
  approvedPlanIds: string[],
  providers: {
    availability: AvailabilityProvider;
    booking: BookingProvider;
    reservationDiscovery?: ReservationDiscoveryProvider;
  } = {
    availability: mockProviderBundle.availability,
    booking: mockProviderBundle.booking
  }
): Promise<BookingFlowResult> {
  const plansById = new Map(plans.map((plan) => [plan.id, plan]));
  const seenPlanIds = new Set<string>();
  const approvedPlans = approvedPlanIds
    .map((planId) => plansById.get(planId))
    .filter((plan): plan is PlanRecommendation => {
      if (!plan || seenPlanIds.has(plan.id)) {
        return false;
      }

      seenPlanIds.add(plan.id);
      return true;
    });

  if (approvedPlans.length === 0) {
    return {
      state: "needs_user_action",
      attempts: []
    };
  }

  const attempts: BookingAttempt[] = [];
  let flowState: BookingState = "approved";
  const reservationDiscoveryProvider =
    providers.reservationDiscovery ?? safeReservationDiscoveryProvider;

  for (const [planIndex, plan] of approvedPlans.entries()) {
    flowState =
      flowState === "approved"
        ? transitionBookingState(flowState, "CHECK_AVAILABILITY")
        : transitionBookingState(flowState, "TRY_NEXT_PLAN");
    attempts.push(
      attemptRecord(
        request.id,
        plan,
        flowState,
        `Checking availability for priority ${planIndex + 1}, rank ${plan.rank}: ${planDisplayName(plan)}.`
      )
    );

    if (shouldUseHandoff(plan)) {
      let discovery: ReservationDiscovery | undefined;

      if (plan.restaurant) {
        try {
          discovery = await reservationDiscoveryProvider.discover(request, plan);
        } catch {
          discovery = undefined;
        }
      }

      if (discovery?.status === "unavailable") {
        flowState = transitionBookingState(flowState, "MARK_UNAVAILABLE");
        attempts.push(
          attemptRecord(
            request.id,
            plan,
            flowState,
            discovery.summary,
            undefined,
            "handoff",
            discovery
          )
        );
        continue;
      }

      flowState = transitionBookingState(flowState, "REQUEST_USER_ACTION");
      attempts.push(
        attemptRecord(
          request.id,
          plan,
          flowState,
          discovery?.summary ?? handoffMessage(request, plan),
          undefined,
          "handoff",
          discovery
        )
      );
      return { state: flowState, attempts };
    }

    const availability = await providers.availability.checkPlan(request, plan);

    if (availability.status === "needs_user_action") {
      flowState = transitionBookingState(flowState, "REQUEST_USER_ACTION");
      attempts.push(attemptRecord(request.id, plan, flowState, availability.message));
      return { state: flowState, attempts };
    }

    if (availability.status === "unavailable") {
      flowState = transitionBookingState(flowState, "MARK_UNAVAILABLE");
      attempts.push(attemptRecord(request.id, plan, flowState, availability.message));
      continue;
    }

    flowState = transitionBookingState(flowState, "ATTEMPT_BOOKING");
    attempts.push(
      attemptRecord(
        request.id,
        plan,
        flowState,
        `Availability found. Attempting mock booking for ${planDisplayName(plan)}.`
      )
    );

    const booking = await providers.booking.bookPlan(request, plan, availability);

    if (booking.status === "booked" && booking.confirmation) {
      flowState = transitionBookingState(flowState, "MARK_BOOKED");
      attempts.push(attemptRecord(request.id, plan, flowState, booking.message));
      return {
        state: flowState,
        attempts,
        confirmation: booking.confirmation
      };
    }

    if (booking.status === "needs_user_action") {
      flowState = transitionBookingState(flowState, "REQUEST_USER_ACTION");
      attempts.push(attemptRecord(request.id, plan, flowState, booking.message));
      return { state: flowState, attempts };
    }

    flowState = transitionBookingState(flowState, "MARK_FAILED");
    attempts.push(attemptRecord(request.id, plan, flowState, booking.message));
  }

  return {
    state: flowState === "unavailable" ? "unavailable" : "failed",
    attempts
  };
}

export async function bookApprovedPlans(requestId: string, approvedPlanIds: string[]) {
  const session = await getPlanningSession(requestId);

  if (!session) {
    throw new Error("Planning request not found");
  }

  if (session.confirmation || session.attempts.length > 0) {
    return {
      request: session.request,
      recommendations: session.recommendations,
      approvedPlanIds: session.approvedPlanIds,
      booking: {
        requestId,
        state: session.bookingState,
        attempts: session.attempts,
        confirmation: session.confirmation
      }
    };
  }

  await setApprovedPlanIds(requestId, approvedPlanIds);
  const result = await runBookingFallback(
    session.request,
    session.recommendations,
    approvedPlanIds
  );

  const saved = await saveBookingResult(
    requestId,
    result.state,
    result.attempts,
    result.confirmation
  );

  if (!saved) {
    throw new Error("Planning request not found after booking");
  }

  return {
    request: saved.request,
    recommendations: saved.recommendations,
    approvedPlanIds: saved.approvedPlanIds,
    booking: {
      requestId,
      state: saved.bookingState,
      attempts: saved.attempts,
      confirmation: saved.confirmation
    }
  };
}

export async function confirmManualBooking(requestId: string, planId?: string) {
  const session = await getPlanningSession(requestId);

  if (!session) {
    throw new Error("Planning request not found");
  }

  if (session.confirmation) {
    return {
      request: session.request,
      recommendations: session.recommendations,
      approvedPlanIds: session.approvedPlanIds,
      booking: {
        requestId,
        state: session.bookingState,
        attempts: session.attempts,
        confirmation: session.confirmation
      }
    };
  }

  const handoffAttempt = [...session.attempts]
    .reverse()
    .find((attempt) => attempt.status === "needs_user_action");
  const selectedPlan =
    session.recommendations.find((plan) => plan.id === (planId ?? handoffAttempt?.planId)) ??
    session.recommendations.find((plan) => session.approvedPlanIds.includes(plan.id));

  if (!selectedPlan) {
    throw new Error("No handoff plan found to confirm.");
  }

  const confirmation: BookingConfirmation = {
    id: createId("confirmation"),
    requestId,
    planId: selectedPlan.id,
    confirmationCode: `MANUAL-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    restaurantName: selectedPlan.restaurant?.name ?? selectedPlan.activity?.name ?? "Selected plan",
    activityName: selectedPlan.restaurant ? selectedPlan.activity?.name : undefined,
    partySize: session.request.groupProfile.numberOfPeople,
    dateTime: session.request.timeWindow.start,
    totalEstimate: selectedPlan.estimatedCostTotal,
    createdAt: new Date().toISOString(),
    provider: "handoff"
  };
  const attempts = [
    ...session.attempts,
    attemptRecord(
      requestId,
      selectedPlan,
      "booked",
      `${getReservationGuidance(selectedPlan).actionLabel} saved by the user.`,
      undefined,
      "handoff"
    )
  ];
  const saved = await saveBookingResult(requestId, "booked", attempts, confirmation);

  if (!saved) {
    throw new Error("Planning request not found after confirmation");
  }

  return {
    request: saved.request,
    recommendations: saved.recommendations,
    approvedPlanIds: saved.approvedPlanIds,
    booking: {
      requestId,
      state: saved.bookingState,
      attempts: saved.attempts,
      confirmation: saved.confirmation
    }
  };
}
