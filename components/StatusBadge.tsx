import clsx from "clsx";
import type { AvailabilityStatus, BookingState } from "@/lib/types";

const bookingLabels: Record<BookingState, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  checking_availability: "Checking",
  booking_attempted: "Attempting",
  booked: "Booked",
  unavailable: "Unavailable",
  failed: "Failed",
  needs_user_action: "Needs action"
};

const availabilityLabels: Record<AvailabilityStatus, string> = {
  likely_available: "Likely available",
  limited: "Limited",
  unlikely: "Unlikely"
};

export function BookingStateBadge({ state }: { state: BookingState }) {
  return (
    <span
      className={clsx(
        "inline-flex min-h-7 items-center rounded-lg border px-2.5 text-xs font-black shadow-sm",
        state === "booked" && "border-moss/30 bg-sage text-moss",
        (state === "failed" || state === "unavailable") &&
          "border-stone-300 bg-stone-100 text-stone-700",
        state === "needs_user_action" && "border-flax bg-flax/30 text-ink",
        !["booked", "failed", "unavailable", "needs_user_action"].includes(state) &&
          "border-stone-300 bg-white text-stone-700"
      )}
    >
      {bookingLabels[state]}
    </span>
  );
}

export function AvailabilityBadge({ status }: { status: AvailabilityStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex min-h-7 items-center rounded-lg border px-2.5 text-xs font-black shadow-sm",
        status === "likely_available" && "border-moss/30 bg-sage text-moss",
        status === "limited" && "border-flax bg-flax/30 text-ink",
        status === "unlikely" && "border-stone-300 bg-stone-100 text-stone-700"
      )}
    >
      {availabilityLabels[status]}
    </span>
  );
}
