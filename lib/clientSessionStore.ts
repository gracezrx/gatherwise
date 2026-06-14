"use client";

import type {
  BookingAttempt,
  BookingConfirmation,
  BookingSummary,
  PlanRecommendation,
  PlanningRequest,
  StoredPlanningSession
} from "@/lib/types";

export type ClientSessionView = StoredPlanningSession & {
  noOptionsSuggestions?: string[];
};

export interface ClientBookingPayload {
  request: PlanningRequest;
  recommendations: PlanRecommendation[];
  approvedPlanIds: string[];
  booking: BookingSummary;
}

const SESSION_PREFIX = "gatherwise:session:";
const BOOKING_PREFIX = "gatherwise:booking:";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readJson<T>(key: string): T | undefined {
  if (!canUseStorage()) {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage is only a resilience layer; the app can still use server storage.
  }
}

export function saveClientSession(session: ClientSessionView) {
  writeJson(`${SESSION_PREFIX}${session.request.id}`, {
    ...session,
    noOptionsSuggestions: session.noOptionsSuggestions ?? []
  });
}

export function getClientSession(requestId: string): ClientSessionView | undefined {
  const session = readJson<ClientSessionView>(`${SESSION_PREFIX}${requestId}`);

  return session
    ? {
        ...session,
        noOptionsSuggestions: session.noOptionsSuggestions ?? []
      }
    : undefined;
}

export function saveClientBookingPayload(payload: ClientBookingPayload) {
  writeJson(`${BOOKING_PREFIX}${payload.request.id}`, payload);
  saveClientSession({
    request: payload.request,
    recommendations: payload.recommendations,
    approvedPlanIds: payload.approvedPlanIds,
    bookingState: payload.booking.state,
    attempts: payload.booking.attempts,
    confirmation: payload.booking.confirmation,
    updatedAt: new Date().toISOString(),
    noOptionsSuggestions: []
  });
}

export function getClientBookingPayload(
  requestId: string
): ClientBookingPayload | undefined {
  const bookingPayload = readJson<ClientBookingPayload>(`${BOOKING_PREFIX}${requestId}`);

  if (bookingPayload) {
    return bookingPayload;
  }

  const session = getClientSession(requestId);
  return session
    ? {
        request: session.request,
        recommendations: session.recommendations,
        approvedPlanIds: session.approvedPlanIds,
        booking: {
          requestId,
          state: session.bookingState,
          attempts: session.attempts,
          confirmation: session.confirmation
        }
      }
    : undefined;
}

export function applyClientManualConfirmation(
  payload: ClientBookingPayload,
  planId?: string
) {
  const selectedPlan =
    payload.recommendations.find((plan) => plan.id === planId) ??
    payload.recommendations.find((plan) => payload.approvedPlanIds.includes(plan.id));

  if (!selectedPlan) {
    return payload;
  }

  const now = new Date().toISOString();
  const confirmation: BookingConfirmation = {
    id: `confirmation_${Date.now().toString(36)}`,
    requestId: payload.request.id,
    planId: selectedPlan.id,
    confirmationCode: `MANUAL-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    restaurantName:
      selectedPlan.restaurant?.name ?? selectedPlan.activity?.name ?? "Selected plan",
    activityName: selectedPlan.restaurant ? selectedPlan.activity?.name : undefined,
    partySize: payload.request.groupProfile.numberOfPeople,
    dateTime: payload.request.timeWindow.start,
    totalEstimate: selectedPlan.estimatedCostTotal,
    createdAt: now,
    provider: "handoff"
  };
  const attempt: BookingAttempt = {
    id: `attempt_${Date.now().toString(36)}`,
    requestId: payload.request.id,
    planId: selectedPlan.id,
    planRank: selectedPlan.rank,
    provider: "handoff",
    status: "booked",
    message: "Marked set by the user.",
    startedAt: now,
    completedAt: now
  };
  const nextPayload: ClientBookingPayload = {
    ...payload,
    booking: {
      requestId: payload.request.id,
      state: "booked",
      attempts: [...payload.booking.attempts, attempt],
      confirmation
    }
  };

  saveClientBookingPayload(nextPayload);
  return nextPayload;
}
