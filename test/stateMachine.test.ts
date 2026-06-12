import { describe, expect, it } from "vitest";
import {
  canTransition,
  isTerminalBookingState,
  transitionBookingState
} from "@/lib/services/stateMachine";

describe("booking state machine", () => {
  it("allows the happy path from review to booked", () => {
    let state = transitionBookingState("pending_review", "APPROVE");
    state = transitionBookingState(state, "CHECK_AVAILABILITY");
    state = transitionBookingState(state, "ATTEMPT_BOOKING");
    state = transitionBookingState(state, "MARK_BOOKED");

    expect(state).toBe("booked");
    expect(isTerminalBookingState(state)).toBe(true);
  });

  it("allows fallback after unavailable or failed plans", () => {
    const unavailable = transitionBookingState("checking_availability", "MARK_UNAVAILABLE");
    expect(canTransition(unavailable, "TRY_NEXT_PLAN")).toBe(true);

    const failed = transitionBookingState("booking_attempted", "MARK_FAILED");
    expect(canTransition(failed, "TRY_NEXT_PLAN")).toBe(true);
  });

  it("rejects invalid jumps", () => {
    expect(() => transitionBookingState("pending_review", "MARK_BOOKED")).toThrow();
    expect(canTransition("booked", "TRY_NEXT_PLAN")).toBe(false);
  });
});
