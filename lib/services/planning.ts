import type { PlanningRequest, PlanningRequestInput } from "@/lib/types";
import { createId } from "@/lib/utils";
import { parsePlanningRequestInput } from "@/lib/validation";
import { mockProviderBundle } from "@/lib/providers/mockProviders";
import { googlePlacesProviderBundle } from "@/lib/providers/googlePlacesProvider";
import {
  buildNoOptionsSuggestions,
  dedupePlanRecommendationsByRestaurant,
  generatePlanRecommendations
} from "./ranking";
import {
  getPlanningSession,
  getUserTasteProfile,
  savePlanningSession
} from "@/lib/store/localDb";
import { hasGooglePlacesApiKey } from "@/lib/store/providerConfig";
import { resolvePlanningRequestLocation } from "./locationResolution";

async function loadMockOptions(request: PlanningRequest) {
  const [restaurants, activities] = await Promise.all([
    mockProviderBundle.restaurants.searchRestaurants(request),
    mockProviderBundle.activities.searchActivities(request)
  ]);

  return { restaurants, activities };
}

async function loadGooglePlacesOptions(request: PlanningRequest) {
  const [restaurantResult, activityResult] = await Promise.allSettled([
    googlePlacesProviderBundle.restaurants.searchRestaurants(request),
    googlePlacesProviderBundle.activities.searchActivities(request)
  ]);

  if (restaurantResult.status === "rejected") {
    console.warn("Google Places restaurant search failed:", restaurantResult.reason);
  }

  if (activityResult.status === "rejected") {
    console.warn("Google Places activity search failed:", activityResult.reason);
  }

  return {
    restaurants:
      restaurantResult.status === "fulfilled" ? restaurantResult.value : [],
    activities: activityResult.status === "fulfilled" ? activityResult.value : []
  };
}

async function loadCandidateOptions(request: PlanningRequest) {
  if (await hasGooglePlacesApiKey()) {
    const googleOptions = await loadGooglePlacesOptions(request);

    if (googleOptions.restaurants.length > 0) {
      return googleOptions;
    }
  }

  return loadMockOptions(request);
}

export async function createPlanningSession(input: PlanningRequestInput) {
  const parsed = parsePlanningRequestInput(input);
  const initialRequest: PlanningRequest = {
    ...parsed,
    id: createId("request"),
    createdAt: new Date().toISOString(),
    mockMode: true
  };
  const request = await resolvePlanningRequestLocation(initialRequest);

  const { restaurants, activities } = await loadCandidateOptions(request);
  const profile = await getUserTasteProfile();

  const recommendations = dedupePlanRecommendationsByRestaurant(
    generatePlanRecommendations(request, restaurants, activities, profile)
  );
  const session = await savePlanningSession(request, recommendations);

  return {
    ...session,
    noOptionsSuggestions:
      recommendations.length === 0 ? buildNoOptionsSuggestions(request) : []
  };
}

export async function getPlanningSessionView(requestId: string) {
  const session = await getPlanningSession(requestId);

  if (!session) {
    return undefined;
  }

  const recommendations = dedupePlanRecommendationsByRestaurant(
    session.recommendations
  );

  return {
    ...session,
    recommendations,
    noOptionsSuggestions:
      recommendations.length === 0
        ? buildNoOptionsSuggestions(session.request)
        : []
  };
}
