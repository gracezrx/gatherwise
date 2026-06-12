import { describe, expect, it, vi } from "vitest";
import type {
  AvailabilityProvider,
  BookingProvider,
  ReservationDiscoveryProvider
} from "@/lib/providers/interfaces";
import { generatePlanRecommendations } from "@/lib/services/ranking";
import { runBookingFallback } from "@/lib/services/booking";
import { getReservationGuidance } from "@/lib/reservationGuidance";
import { mockActivities, mockRestaurants } from "@/lib/data/mockOptions";
import type {
  ActivityPreference,
  PlanRecommendation,
  ReservationDiscovery,
  ReservationDiscoveryStatus
} from "@/lib/types";
import { baseRequest } from "./fixtures";

type RestaurantPlan = PlanRecommendation & {
  restaurant: NonNullable<PlanRecommendation["restaurant"]>;
};

const restaurantRequest = {
  ...baseRequest,
  activityPreferences: [] as ActivityPreference[]
};

function requireRestaurantPlan(plan: PlanRecommendation): RestaurantPlan {
  if (!plan.restaurant) {
    throw new Error("Expected a restaurant plan in this test.");
  }

  return plan as RestaurantPlan;
}

function testDiscovery(
  plan: RestaurantPlan,
  status: ReservationDiscoveryStatus,
  summary = "Reservation source prepared."
): ReservationDiscovery {
  return {
    status,
    restaurant: {
      canonicalName: plan.restaurant.name,
      displayName: plan.restaurant.name,
      placeId: plan.restaurant.placeId,
      formattedAddress: plan.restaurant.formattedAddress,
      neighborhood: plan.restaurant.neighborhood,
      latitude: plan.restaurant.latitude,
      longitude: plan.restaurant.longitude,
      websiteUri: plan.restaurant.websiteUri,
      googleMapsUri: plan.restaurant.googleMapsUri,
      nationalPhoneNumber: plan.restaurant.nationalPhoneNumber,
      internationalPhoneNumber: plan.restaurant.internationalPhoneNumber,
      reservable: plan.restaurant.reservable,
      matchConfidence: 0.8,
      matchReason: "Matched test restaurant.",
      sourceProvider: "plan_data"
    },
    sources: [],
    bestAction: {
      provider: "maps",
      label: "Open Maps",
      detail: "Use Maps to finish.",
      url: plan.restaurant.googleMapsUri,
      requiresUserAction: true
    },
    availableTimes: [],
    summary
  };
}

describe("runBookingFallback", () => {
  it("tries approved plans in the user-selected order until one books", async () => {
    const plans = generatePlanRecommendations(
      restaurantRequest,
      mockRestaurants,
      mockActivities
    ).slice(0, 3);
    const orderedPlanIds = [plans[2].id, plans[1].id, plans[0].id];

    const availability: AvailabilityProvider = {
      name: "Test availability",
      checkPlan: vi.fn(async (_request, plan) => ({
        provider: "mock" as const,
        status: plan.id === orderedPlanIds[0] ? ("unavailable" as const) : ("available" as const),
        message: plan.id === orderedPlanIds[0] ? "No table for first choice." : "Slot found."
      }))
    };

    const booking: BookingProvider = {
      name: "Test booking",
      bookPlan: vi.fn(async (request, plan) => ({
        status: "booked" as const,
        message: "Booked test plan.",
        confirmation: {
          id: "confirmation_test",
          requestId: request.id,
          planId: plan.id,
          confirmationCode: "MOCK-123456",
          restaurantName: plan.restaurant?.name ?? plan.activity?.name ?? "Plan",
          activityName: plan.activity?.name,
          partySize: request.groupProfile.numberOfPeople,
          dateTime: request.timeWindow.start,
          totalEstimate: plan.estimatedCostTotal,
          createdAt: "2026-06-10T12:00:00.000Z",
          provider: "mock" as const
        }
      }))
    };

    const result = await runBookingFallback(
      baseRequest,
      plans,
      orderedPlanIds,
      { availability, booking }
    );

    expect(result.state).toBe("booked");
    expect(result.confirmation?.planId).toBe(plans[1].id);
    expect(availability.checkPlan).toHaveBeenCalledTimes(2);
    expect(booking.bookPlan).toHaveBeenCalledTimes(1);
    expect(result.attempts.map((attempt) => attempt.status)).toEqual([
      "checking_availability",
      "unavailable",
      "checking_availability",
      "booking_attempted",
      "booked"
    ]);
    expect(result.attempts[0].planId).toBe(plans[2].id);
    expect(result.attempts[2].planId).toBe(plans[1].id);
  });

  it("routes real Google Places plans to a manual booking handoff", async () => {
    const plan = requireRestaurantPlan(generatePlanRecommendations(
      restaurantRequest,
      mockRestaurants,
      mockActivities
    )[0]);
    const googlePlan = {
      ...plan,
      restaurant: {
        ...plan.restaurant,
        source: "google_places" as const,
        googleMapsUri: "https://maps.google.com/?cid=test",
        websiteUri: "https://example.com/reservations"
      }
    };
    const availability: AvailabilityProvider = {
      name: "Should not be called",
      checkPlan: vi.fn(async () => ({
        provider: "mock" as const,
        status: "available" as const,
        message: "Slot found."
      }))
    };
    const booking: BookingProvider = {
      name: "Should not be called",
      bookPlan: vi.fn(async () => ({
        status: "failed" as const,
        message: "Should not book."
      }))
    };

    const result = await runBookingFallback(
      baseRequest,
      [googlePlan],
      [googlePlan.id],
      {
        availability,
        booking,
        reservationDiscovery: {
          name: "Test discovery",
          discover: vi.fn(async (_request, plan) =>
            testDiscovery(
              requireRestaurantPlan(plan),
              "needs_user_action",
              "Checked restaurant website, Google, OpenTable, and Resy."
            )
          )
        }
      }
    );

    expect(result.state).toBe("needs_user_action");
    expect(result.confirmation).toBeUndefined();
    expect(availability.checkPlan).not.toHaveBeenCalled();
    expect(booking.bookPlan).not.toHaveBeenCalled();
    expect(result.attempts.map((attempt) => attempt.status)).toEqual([
      "checking_availability",
      "needs_user_action"
    ]);
    expect(result.attempts.at(-1)?.provider).toBe("handoff");
    expect(result.attempts.at(-1)?.reservationDiscovery?.summary).toContain(
      "OpenTable"
    );
  });

  it("labels dessert and cafe-style places as walk-in instead of reservation required", async () => {
    const plan = requireRestaurantPlan(generatePlanRecommendations(
      restaurantRequest,
      mockRestaurants,
      mockActivities
    )[0]);
    const dessertPlan = {
      ...plan,
      restaurant: {
        ...plan.restaurant,
        name: "Tong Sui Desserts & Drinks (Palo Alto)",
        cuisine: "Dessert",
        source: "google_places" as const,
        primaryType: "dessert_shop",
        placeTypes: ["dessert_shop", "cafe", "food"],
        reservable: false
      }
    };

    const result = await runBookingFallback(
      baseRequest,
      [dessertPlan],
      [dessertPlan.id],
      {
        availability: {
          name: "Should not be called",
          checkPlan: vi.fn(async () => ({
            provider: "mock" as const,
            status: "available" as const,
            message: "Slot found."
          }))
        },
        booking: {
          name: "Should not be called",
          bookPlan: vi.fn(async () => ({
            status: "failed" as const,
            message: "Should not book."
          }))
        },
        reservationDiscovery: {
          name: "Test walk-in discovery",
          discover: vi.fn(async (_request, plan) =>
            testDiscovery(
              requireRestaurantPlan(plan),
              "walk_in_likely",
              "No booking needed. Plan to walk in or join the line."
            )
          )
        }
      }
    );

    expect(getReservationGuidance(dessertPlan).need).toBe("walk_in_likely");
    expect(result.state).toBe("needs_user_action");
    expect(result.attempts.at(-1)?.message).toContain("No booking needed");
    expect(result.attempts.at(-1)?.message).toContain("walk");
  });

  it("keeps trying approved Google plans when discovery says one is unavailable", async () => {
    const plans = generatePlanRecommendations(
      restaurantRequest,
      mockRestaurants,
      mockActivities
    )
      .slice(0, 2)
      .map((plan) => {
        const restaurantPlan = requireRestaurantPlan(plan);
        return {
          ...restaurantPlan,
          restaurant: {
            ...restaurantPlan.restaurant,
            source: "google_places" as const,
            googleMapsUri: `https://maps.google.com/?cid=${restaurantPlan.rank}`
          }
        };
      });
    const availability: AvailabilityProvider = {
      name: "Should not be called",
      checkPlan: vi.fn(async () => ({
        provider: "mock" as const,
        status: "available" as const,
        message: "Slot found."
      }))
    };
    const booking: BookingProvider = {
      name: "Should not be called",
      bookPlan: vi.fn(async () => ({
        status: "failed" as const,
        message: "Should not book."
      }))
    };
    const reservationDiscovery: ReservationDiscoveryProvider = {
      name: "Fallback discovery",
      discover: vi.fn(async (_request, plan) =>
        plan.rank === 1
          ? testDiscovery(requireRestaurantPlan(plan), "unavailable", "No availability for rank 1.")
          : testDiscovery(requireRestaurantPlan(plan), "needs_user_action", "Rank 2 can be booked manually.")
      )
    };

    const result = await runBookingFallback(
      baseRequest,
      plans,
      plans.map((plan) => plan.id),
      { availability, booking, reservationDiscovery }
    );

    expect(result.state).toBe("needs_user_action");
    expect(availability.checkPlan).not.toHaveBeenCalled();
    expect(booking.bookPlan).not.toHaveBeenCalled();
    expect(result.attempts.map((attempt) => attempt.status)).toEqual([
      "checking_availability",
      "unavailable",
      "checking_availability",
      "needs_user_action"
    ]);
    expect(result.attempts.at(-1)?.planId).toBe(plans[1].id);
  });
});
