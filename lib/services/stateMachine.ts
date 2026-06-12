import type { BookingState } from "@/lib/types";

type BookingEvent =
  | "APPROVE"
  | "CHECK_AVAILABILITY"
  | "ATTEMPT_BOOKING"
  | "MARK_BOOKED"
  | "MARK_UNAVAILABLE"
  | "MARK_FAILED"
  | "REQUEST_USER_ACTION"
  | "TRY_NEXT_PLAN"
  | "RESET_REVIEW";

const transitions: Record<BookingState, Partial<Record<BookingEvent, BookingState>>> = {
  pending_review: {
    APPROVE: "approved",
    RESET_REVIEW: "pending_review"
  },
  approved: {
    CHECK_AVAILABILITY: "checking_availability",
    RESET_REVIEW: "pending_review"
  },
  checking_availability: {
    ATTEMPT_BOOKING: "booking_attempted",
    MARK_UNAVAILABLE: "unavailable",
    MARK_FAILED: "failed",
    REQUEST_USER_ACTION: "needs_user_action"
  },
  booking_attempted: {
    MARK_BOOKED: "booked",
    MARK_FAILED: "failed",
    MARK_UNAVAILABLE: "unavailable",
    REQUEST_USER_ACTION: "needs_user_action"
  },
  booked: {},
  unavailable: {
    TRY_NEXT_PLAN: "checking_availability",
    MARK_FAILED: "failed",
    RESET_REVIEW: "pending_review"
  },
  failed: {
    TRY_NEXT_PLAN: "checking_availability",
    RESET_REVIEW: "pending_review"
  },
  needs_user_action: {
    RESET_REVIEW: "pending_review"
  }
};

export function canTransition(state: BookingState, event: BookingEvent) {
  return transitions[state][event] !== undefined;
}

export function transitionBookingState(state: BookingState, event: BookingEvent) {
  const nextState = transitions[state][event];

  if (!nextState) {
    throw new Error(`Cannot transition booking state from ${state} with ${event}`);
  }

  return nextState;
}

export function isTerminalBookingState(state: BookingState) {
  return state === "booked" || state === "failed" || state === "needs_user_action";
}
