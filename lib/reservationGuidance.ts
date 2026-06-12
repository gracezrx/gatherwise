import type { PlanRecommendation, ReservationGuidance } from "@/lib/types";

const WALK_IN_TERMS = [
  "bakery",
  "boba",
  "bubble tea",
  "cafe",
  "coffee",
  "creamery",
  "dessert",
  "desserts",
  "donut",
  "drinks",
  "gelato",
  "ice cream",
  "juice",
  "pastry",
  "tea",
  "yogurt"
];

const WALK_IN_TYPES = new Set([
  "bakery",
  "cafe",
  "coffee_shop",
  "confectionery",
  "dessert_shop",
  "donut_shop",
  "ice_cream_shop",
  "juice_shop"
]);

function includesWalkInSignal(plan: PlanRecommendation) {
  const restaurant = plan.restaurant;
  if (!restaurant) {
    return false;
  }

  const text = [
    restaurant.name,
    restaurant.cuisine,
    restaurant.primaryType,
    ...(restaurant.placeTypes ?? [])
  ]
    .join(" ")
    .toLowerCase();

  return (
    WALK_IN_TERMS.some((term) => text.includes(term)) ||
    restaurant.placeTypes?.some((type) => WALK_IN_TYPES.has(type)) ||
    (restaurant.primaryType ? WALK_IN_TYPES.has(restaurant.primaryType) : false)
  );
}

export function getReservationGuidance(plan: PlanRecommendation): ReservationGuidance {
  const restaurant = plan.restaurant;
  if (!restaurant) {
    return {
      need: "call_to_confirm",
      label: "Confirm details",
      detail:
        "Use the venue website, Maps, or phone number to confirm hours, tickets, or entry requirements.",
      actionLabel: "I confirmed it"
    };
  }

  const groupSize = Math.max(1, Math.round(plan.estimatedCostTotal / Math.max(plan.estimatedCostPerPerson, 1)));
  const hasWalkInSignal = includesWalkInSignal(plan);

  if (hasWalkInSignal && groupSize <= 6 && restaurant.reservable !== true) {
    return {
      need: "walk_in_likely",
      label: "No booking needed",
      detail:
        "This looks like a casual dessert, cafe, bakery, or counter-service spot. Plan to walk in; if it is busy, expect a line.",
      actionLabel: "I'm set"
    };
  }

  if (
    restaurant.reservable === true ||
    restaurant.bookingDifficulty === "hard" ||
    restaurant.pricePerPerson >= 60 ||
    groupSize >= 7 ||
    restaurant.vibes.includes("upscale")
  ) {
    return {
      need: "reservation_recommended",
      label: "Reservation recommended",
      detail:
        "This looks like a place where a reservation or direct confirmation is useful for the requested group and time.",
      actionLabel: "I booked it"
    };
  }

  if (restaurant.reservable === false || hasWalkInSignal) {
    return {
      need: "walk_in_likely",
      label: "Likely walk-in only",
      detail:
        "No reservation signal is listed. This place likely works by walking in or joining a waitlist.",
      actionLabel: "I'm set"
    };
  }

  return {
    need: "call_to_confirm",
    label: "Call or check website",
    detail:
      "No direct booking window is available here. Use the website, Maps, or phone number to confirm whether reservations are accepted.",
    actionLabel: "I confirmed it"
  };
}
