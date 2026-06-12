import { mockActivities, mockRestaurants } from "@/lib/data/mockOptions";
import type {
  ActivityOption,
  BookingConfirmation,
  PlanRecommendation,
  PlanningRequest,
  RestaurantOption
} from "@/lib/types";
import { createId, stableRatio } from "@/lib/utils";
import type {
  ActivitySearchProvider,
  AvailabilityProvider,
  AvailabilityResult,
  BookingProvider,
  BookingResult,
  RestaurantSearchProvider
} from "./interfaces";

function probabilityForPlan(plan: PlanRecommendation) {
  const activityProbability = plan.activity?.availabilityProbability ?? 1;
  const restaurantProbability = plan.restaurant?.availabilityProbability;

  if (restaurantProbability === undefined) {
    return activityProbability;
  }

  return Math.min(
    restaurantProbability,
    activityProbability,
    (restaurantProbability + activityProbability) / 2
  );
}

export class MockRestaurantSearchProvider implements RestaurantSearchProvider {
  name = "Mock restaurant catalog";

  async searchRestaurants(_request: PlanningRequest): Promise<RestaurantOption[]> {
    return mockRestaurants;
  }
}

export class MockActivitySearchProvider implements ActivitySearchProvider {
  name = "Mock activity catalog";

  async searchActivities(_request: PlanningRequest): Promise<ActivityOption[]> {
    return mockActivities;
  }
}

export class MockAvailabilityProvider implements AvailabilityProvider {
  name = "Mock availability checker";

  async checkPlan(
    request: PlanningRequest,
    plan: PlanRecommendation
  ): Promise<AvailabilityResult> {
    if (
      plan.restaurant?.mockAvailability === "unavailable" ||
      plan.activity?.mockAvailability === "unavailable"
    ) {
      return {
        status: "unavailable",
        provider: "mock",
        message: "Mock provider reports no matching slot for this plan."
      };
    }

    if (
      plan.restaurant?.bookingDifficulty === "hard" &&
      request.groupProfile.numberOfPeople > 8
    ) {
      return {
        status: "unavailable",
        provider: "mock",
        message: "The venue rarely releases tables this large in the chosen window."
      };
    }

    const probability = probabilityForPlan(plan);
    const roll = stableRatio(`${request.id}:${plan.id}:availability`);

    if (probability >= 0.72 || roll <= probability) {
      return {
        status: "available",
        provider: "mock",
        message: "Mock provider found a bookable slot in the requested window."
      };
    }

    if (probability < 0.4) {
      return {
        status: "needs_user_action",
        provider: "mock",
        message: "Only a waitlist-style slot is showing; the user would need to confirm flexibility."
      };
    }

    return {
      status: "unavailable",
      provider: "mock",
      message: "No matching slot is available in the current mock inventory."
    };
  }
}

export class MockBookingProvider implements BookingProvider {
  name = "Mock booking provider";

  async bookPlan(
    request: PlanningRequest,
    plan: PlanRecommendation,
    availability: AvailabilityResult
  ): Promise<BookingResult> {
    if (availability.status !== "available") {
      return {
        status: "failed",
        message: "Booking was not attempted because availability was not confirmed."
      };
    }

    const roll = stableRatio(`${request.id}:${plan.id}:booking`);
    if (plan.restaurant?.bookingDifficulty === "hard" && roll > 0.55) {
      return {
        status: "failed",
        message: "The mock provider released the slot before checkout completed."
      };
    }

    const confirmation: BookingConfirmation = {
      id: createId("confirmation"),
      requestId: request.id,
      planId: plan.id,
      confirmationCode: `MOCK-${Math.floor(
        stableRatio(`${request.id}:${plan.id}:code`) * 900000 + 100000
      )}`,
      restaurantName: plan.restaurant?.name ?? plan.activity?.name ?? "Selected plan",
      activityName: plan.restaurant ? plan.activity?.name : undefined,
      partySize: request.groupProfile.numberOfPeople,
      dateTime: request.timeWindow.start,
      totalEstimate: plan.estimatedCostTotal,
      createdAt: new Date().toISOString(),
      provider: "mock"
    };

    return {
      status: "booked",
      confirmation,
      message: "Mock booking confirmed."
    };
  }
}

export const mockProviderBundle = {
  restaurants: new MockRestaurantSearchProvider(),
  activities: new MockActivitySearchProvider(),
  availability: new MockAvailabilityProvider(),
  booking: new MockBookingProvider()
};
