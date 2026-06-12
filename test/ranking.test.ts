import { describe, expect, it } from "vitest";
import { mockActivities, mockRestaurants } from "@/lib/data/mockOptions";
import {
  dedupePlanRecommendationsByRestaurant,
  generatePlanRecommendations
} from "@/lib/services/ranking";
import { baseRequest } from "./fixtures";
import type {
  ActivityPreference,
  Occasion,
  RestaurantOption,
  UserTasteProfile,
  Vibe
} from "@/lib/types";

type RestaurantPlan = ReturnType<typeof generatePlanRecommendations>[number] & {
  restaurant: NonNullable<ReturnType<typeof generatePlanRecommendations>[number]["restaurant"]>;
};

const restaurantRequest = {
  ...baseRequest,
  activityPreferences: [] as ActivityPreference[]
};

function requireRestaurantPlan(plan: ReturnType<typeof generatePlanRecommendations>[number]) {
  if (!plan.restaurant) {
    throw new Error("Expected a restaurant plan in this test.");
  }

  return plan as RestaurantPlan;
}

describe("generatePlanRecommendations", () => {
  it("returns 3-7 ranked plans with transparent scoring and explanations", () => {
    const plans = generatePlanRecommendations(
      baseRequest,
      mockRestaurants,
      mockActivities
    );

    expect(plans.length).toBeGreaterThanOrEqual(3);
    expect(plans.length).toBeLessThanOrEqual(7);
    expect(plans.map((plan) => plan.rank)).toEqual([1, 2, 3, 4, 5, 6, 7].slice(0, plans.length));
    expect(plans[0].confidenceScore).toBeGreaterThanOrEqual(plans[1].confidenceScore);
    expect(plans[0].whyRecommended.length).toBeGreaterThan(0);
    expect(plans[0].scoreBreakdown.dietary).toBeGreaterThan(0);
    expect(["verified", "likely", "exploratory"]).toContain(plans[0].accuracyStatus);
    expect(plans[0].evidenceScore).toBeGreaterThan(0);
    expect(plans[0].diversityTags.length).toBeGreaterThan(0);
    expect(plans[0].estimatedCostTotal).toBe(
      plans[0].estimatedCostPerPerson * baseRequest.groupProfile.numberOfPeople
    );
  });

  it("recommends activity-only plans when the user asks for a museum", () => {
    const plans = generatePlanRecommendations(
      {
        ...baseRequest,
        occasion: "museum_day",
        budgetPerPerson: 40,
        dietaryRestrictions: [],
        activityPreferences: ["museum"],
        vibe: ["casual"]
      },
      mockRestaurants,
      mockActivities
    );

    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((plan) => plan.planType === "activity")).toBe(true);
    expect(plans.every((plan) => plan.restaurant === undefined)).toBe(true);
    expect(plans[0].activity?.preferences).toContain("museum");
  });

  it("uses category general preferences as broad activity requests", () => {
    const plans = generatePlanRecommendations(
      {
        ...baseRequest,
        occasion: "birthday",
        budgetPerPerson: 70,
        dietaryRestrictions: [],
        activityPreferences: ["games_general"],
        vibe: ["casual"]
      },
      mockRestaurants,
      mockActivities
    );

    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((plan) => plan.planType === "activity")).toBe(true);
    expect(plans.every((plan) => plan.restaurant === undefined)).toBe(true);
    expect(
      plans.some((plan) => plan.activity?.preferences.includes("games"))
    ).toBe(true);
  });

  it("rewards options that match diet, vibe, capacity, and budget", () => {
    const plans = generatePlanRecommendations(
      {
        ...restaurantRequest,
        groupProfile: { numberOfPeople: 14, typeOfPeople: "family" },
        occasion: "birthday",
        budgetPerPerson: 45,
        dietaryRestrictions: ["vegan", "gluten-free"],
        vibe: ["kid-friendly", "casual"]
      },
      mockRestaurants,
      mockActivities
    );

    const topPlan = requireRestaurantPlan(plans[0]);
    expect(topPlan.restaurant.capacity).toBeGreaterThanOrEqual(14);
    expect(topPlan.estimatedCostPerPerson).toBeLessThanOrEqual(45);
    expect(topPlan.scoreBreakdown.vibe).toBeGreaterThanOrEqual(0.5);
    expect(topPlan.scoreBreakdown.dietary).toBeGreaterThanOrEqual(0.5);
  });

  it("boosts restaurants that match selected cuisine preferences", () => {
    const japaneseRestaurant = {
      ...mockRestaurants[0],
      id: "cuisine_japanese",
      name: "Sakura Udon",
      cuisine: "Japanese izakaya",
      pricePerPerson: 45,
      availabilityProbability: 0.78,
      formattedAddress: "1 Sakura Way, Palo Alto, CA"
    };
    const unrelatedRestaurant = {
      ...mockRestaurants[1],
      id: "cuisine_unrelated",
      name: "Generic Grill",
      cuisine: "American",
      pricePerPerson: 40,
      availabilityProbability: 0.9,
      formattedAddress: "2 Generic Way, Palo Alto, CA"
    };

    const plans = generatePlanRecommendations(
      {
        ...restaurantRequest,
        budgetPerPerson: 100,
        dietaryRestrictions: [],
        cuisinePreferences: ["japanese"]
      },
      [unrelatedRestaurant, japaneseRestaurant],
      []
    );

    expect(requireRestaurantPlan(plans[0]).restaurant.name).toBe("Sakura Udon");
    expect(plans[0].whyRecommended).toContain("Cuisine match");
  });

  it("does not repeat the same restaurant when enough unique choices exist", () => {
    const plans = generatePlanRecommendations(
      restaurantRequest,
      mockRestaurants,
      mockActivities
    );
    const restaurantIds = plans.map((plan) => {
      const restaurantPlan = requireRestaurantPlan(plan);
      return restaurantPlan.restaurant.placeId ?? restaurantPlan.restaurant.id;
    });

    expect(new Set(restaurantIds).size).toBe(restaurantIds.length);
  });

  it("diversifies restaurant batches with activity-paired plans", () => {
    const plans = generatePlanRecommendations(
      {
        ...restaurantRequest,
        budgetPerPerson: 110,
        dietaryRestrictions: [],
        vibe: ["casual", "lively"]
      },
      mockRestaurants,
      mockActivities
    );
    const pairedPlans = plans.filter((plan) => plan.restaurant && plan.activity);

    expect(plans.length).toBeGreaterThanOrEqual(4);
    expect(pairedPlans.length).toBeGreaterThanOrEqual(2);
  });

  it("limits exploratory options to one and marks them with warnings", () => {
    const exactRestaurants = mockRestaurants.slice(0, 3).map((restaurant, index) => ({
      ...restaurant,
      id: `exact_${index}`,
      formattedAddress: `${index} Exact St, Palo Alto, CA`,
      evidence: {
        categoryConfidence: 0.95,
        locationConfidence: 0.95,
        timeConfidence: 0.9,
        sourceCompleteness: 0.86,
        ratingConfidence: 0.8,
        queryStage: "exact" as const,
        warnings: []
      }
    }));
    const exploratoryRestaurants = mockRestaurants.slice(3, 7).map((restaurant, index) => ({
      ...restaurant,
      id: `exploratory_${index}`,
      pricePerPerson: 30 + index,
      availabilityProbability: 0.95,
      formattedAddress: `${index} Exploratory St, Palo Alto, CA`,
      evidence: {
        categoryConfidence: 0.42,
        locationConfidence: 0.82,
        timeConfidence: 0.5,
        sourceCompleteness: 0.45,
        ratingConfidence: 0.35,
        queryStage: "exploratory" as const,
        warnings: ["Less verified, included for variety."]
      }
    }));

    const plans = generatePlanRecommendations(
      {
        ...restaurantRequest,
        budgetPerPerson: 120,
        dietaryRestrictions: []
      },
      [...exactRestaurants, ...exploratoryRestaurants],
      []
    );
    const exploratoryPlans = plans.filter((plan) => plan.accuracyStatus === "exploratory");

    expect(plans.length).toBe(4);
    expect(exploratoryPlans).toHaveLength(1);
    expect(exploratoryPlans[0].qualityWarnings.join(" ")).toContain("Less verified");
  });

  it("uses profile feedback to suppress rejected and non-favorite visited places", () => {
    const rejectedRestaurant = {
      ...mockRestaurants[0],
      id: "profile_rejected",
      name: "Profile Rejected Cafe",
      formattedAddress: "1 Rejected Way, Palo Alto, CA"
    };
    const visitedRestaurant = {
      ...mockRestaurants[1],
      id: "profile_visited",
      name: "Already Visited Bistro",
      formattedAddress: "2 Visited Way, Palo Alto, CA"
    };
    const allowedRestaurant = {
      ...mockRestaurants[2],
      id: "profile_allowed",
      name: "Allowed Table",
      formattedAddress: "3 Allowed Way, Palo Alto, CA"
    };
    const profile: UserTasteProfile = {
      feedback: [
        {
          name: rejectedRestaurant.name,
          category: "restaurant",
          status: "rejected",
          tags: []
        },
        {
          name: visitedRestaurant.name,
          category: "restaurant",
          status: "visited",
          tags: []
        }
      ]
    };

    const plans = generatePlanRecommendations(
      {
        ...restaurantRequest,
        budgetPerPerson: 120,
        dietaryRestrictions: []
      },
      [rejectedRestaurant, visitedRestaurant, allowedRestaurant],
      [],
      profile
    );
    const names = plans.map((plan) => requireRestaurantPlan(plan).restaurant.name);

    expect(names).toEqual(["Allowed Table"]);
  });

  it("boosts exact bookmarked and want-to-go places with visible reasons", () => {
    const bookmarkedRestaurant: RestaurantOption = {
      ...mockRestaurants[4],
      id: "profile_bookmarked",
      name: "Bookmarked Supper Club",
      formattedAddress: "4 Bookmarked Way, Palo Alto, CA",
      pricePerPerson: 45,
      availabilityProbability: 0.8
    };
    const profile: UserTasteProfile = {
      feedback: [
        {
          name: bookmarkedRestaurant.name,
          category: "restaurant",
          status: "want_to_go",
          tags: ["upscale"]
        }
      ]
    };

    const plans = generatePlanRecommendations(
      {
        ...restaurantRequest,
        budgetPerPerson: 120,
        dietaryRestrictions: []
      },
      [bookmarkedRestaurant],
      [],
      profile
    );

    expect(plans[0].whyRecommended).toContain("Matches a place from your dashboard");
  });

  it("returns fewer plans instead of padding with duplicate restaurants", () => {
    const duplicateRestaurant = {
      ...mockRestaurants[0],
      pricePerPerson: 30,
      availabilityProbability: 0.9,
      formattedAddress: "1 Duplicate Way, Palo Alto, CA",
      latitude: 37.444,
      longitude: -122.161
    };
    const plans = generatePlanRecommendations(
      {
        ...restaurantRequest,
        budgetPerPerson: 120,
        dietaryRestrictions: [],
        vibe: ["upscale", "quiet"]
      },
      [
        {
          ...duplicateRestaurant,
          id: "duplicate_a",
          placeId: "external_a"
        },
        {
          ...duplicateRestaurant,
          id: "duplicate_b",
          placeId: "external_b"
        }
      ],
      mockActivities.slice(0, 3)
    );

    expect(plans).toHaveLength(1);
    expect(requireRestaurantPlan(plans[0]).restaurant.name).toBe(duplicateRestaurant.name);
    expect(plans[0].tradeoffs.join(" ")).not.toContain("Repeated restaurant");
  });

  it("deduplicates by restaurant name and address even when external ids differ", () => {
    const plans = generatePlanRecommendations(
      {
        ...restaurantRequest,
        budgetPerPerson: 80,
        dietaryRestrictions: []
      },
      [
        {
          ...mockRestaurants[1],
          id: "same_place_a",
          placeId: "google_a",
          formattedAddress: "412 Emerson St, Palo Alto, CA",
          latitude: 37.445,
          longitude: -122.162
        },
        {
          ...mockRestaurants[1],
          id: "same_place_b",
          placeId: "google_b",
          formattedAddress: "412 Emerson St, Palo Alto, CA",
          latitude: 37.445,
          longitude: -122.162
        },
        {
          ...mockRestaurants[2],
          id: "unique_place",
          placeId: "google_c",
          formattedAddress: "99 Bryant St, Palo Alto, CA",
          latitude: 37.446,
          longitude: -122.163
        }
      ],
      []
    );

    const names = plans.map((plan) => requireRestaurantPlan(plan).restaurant.name);
    expect(names.filter((name) => name === mockRestaurants[1].name)).toHaveLength(1);
    expect(new Set(names).size).toBe(names.length);
  });

  it("cleans duplicate restaurants from previously saved recommendations", () => {
    const [plan] = generatePlanRecommendations(
      {
        ...restaurantRequest,
        budgetPerPerson: 90,
        dietaryRestrictions: []
      },
      [
        {
          ...mockRestaurants[0],
          formattedAddress: "1 Duplicate Way, Palo Alto, CA"
        }
      ],
      []
    );

    const cleaned = dedupePlanRecommendationsByRestaurant([
      plan,
      {
        ...plan,
        id: "old_duplicate",
        rank: 2,
        tradeoffs: [
          ...plan.tradeoffs,
          "Repeated restaurant because fewer than 3 valid unique restaurants matched."
        ]
      }
    ]);

    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].rank).toBe(1);
    expect(cleaned[0].tradeoffs.join(" ")).not.toContain("Repeated restaurant");
  });

  it("cleans duplicate activities from previously saved recommendations", () => {
    const plans = generatePlanRecommendations(
      {
        ...baseRequest,
        occasion: "night_out",
        budgetPerPerson: 120,
        dietaryRestrictions: [],
        activityPreferences: ["nightclub"],
        vibe: ["lively"]
      },
      [
        {
          ...mockRestaurants[0],
          id: "restaurant_a",
          formattedAddress: "1 Restaurant Way, Palo Alto, CA"
        },
        {
          ...mockRestaurants[1],
          id: "restaurant_b",
          formattedAddress: "2 Restaurant Way, Palo Alto, CA"
        }
      ],
      [
        {
          ...mockActivities[0],
          id: "same_club",
          name: "Cat Club",
          type: "Nightclub",
          primaryType: "night_club",
          placeTypes: ["night_club"],
          formattedAddress: "1190 Folsom St, San Francisco, CA",
          preferences: ["nightclub", "dancing", "late_night"] as ActivityPreference[],
          vibes: ["lively", "casual"] as Vibe[],
          occasionFits: ["night_out"] as Occasion[]
        }
      ]
    );

    expect(plans).toHaveLength(1);
    expect(plans[0].activity?.name).toBe("Cat Club");
  });

  it("filters places that are clearly outside hard budget constraints", () => {
    const plans = generatePlanRecommendations(
      {
        ...restaurantRequest,
        budgetPerPerson: 35,
        dietaryRestrictions: []
      },
      mockRestaurants,
      mockActivities
    );

    expect(plans.every((plan) => plan.estimatedCostPerPerson <= 35)).toBe(true);
  });

  it("keeps strong places with uncertain hours and shows a time warning", () => {
    const plans = generatePlanRecommendations(
      {
        ...restaurantRequest,
        budgetPerPerson: 70,
        dietaryRestrictions: [],
        vibe: ["casual"]
      },
      [
        {
          ...mockRestaurants[0],
          id: "maybe_closed",
          pricePerPerson: 40,
          capacity: 10,
          distanceFromCenterMiles: 0.4,
          distanceFromHostMiles: 0.4,
          availabilityProbability: 0.5,
          timeFit: {
            status: "possibly_closed",
            label: "May be closed then",
            detail: "The requested window does not appear to fit Google regular hours."
          }
        }
      ],
      []
    );

    expect(plans).toHaveLength(1);
    expect(plans[0].tradeoffs).toContain(
      "Requested time may be outside listed hours; confirm before going."
    );
  });

  it("does not substitute a bar when nightclub is requested", () => {
    const restaurant = {
      ...mockRestaurants[0],
      pricePerPerson: 35,
      availabilityProbability: 0.9,
      capacity: 12
    };
    const barActivity = {
      ...mockActivities[0],
      id: "activity_bar",
      name: "Downtown Cocktail Bar",
      type: "Bar",
      primaryType: "bar",
      placeTypes: ["bar"],
      pricePerPerson: 15,
      preferences: ["bar", "cocktails"] as ActivityPreference[],
      vibes: ["lively", "casual"] as Vibe[],
      occasionFits: ["night_out", "date_night", "casual_hangout"] as Occasion[],
      availabilityProbability: 0.95
    };
    const nightclubActivity = {
      ...mockActivities[0],
      id: "activity_nightclub",
      name: "Downtown Dance Club",
      type: "Nightclub",
      primaryType: "night_club",
      placeTypes: ["night_club"],
      pricePerPerson: 20,
      preferences: ["nightclub", "dancing", "late_night"] as ActivityPreference[],
      vibes: ["lively", "casual"] as Vibe[],
      occasionFits: ["night_out", "group_night", "date_night"] as Occasion[],
      availabilityProbability: 0.82
    };
    const landmarkActivity = {
      ...mockActivities[0],
      id: "activity_landmark",
      name: "Union Square",
      type: "Historical landmark",
      primaryType: "historical_landmark",
      placeTypes: ["historical_landmark", "tourist_attraction"],
      pricePerPerson: 0,
      preferences: ["sightseeing", "landmarks"] as ActivityPreference[],
      vibes: ["lively", "casual"] as Vibe[],
      occasionFits: ["night_out", "tourist_day", "sightseeing"] as Occasion[],
      availabilityProbability: 0.99
    };
    const plans = generatePlanRecommendations(
      {
        ...baseRequest,
        occasion: "night_out",
        budgetPerPerson: 90,
        dietaryRestrictions: [],
        activityPreferences: ["nightclub"],
        vibe: ["lively"]
      },
      [restaurant],
      [barActivity, landmarkActivity, nightclubActivity]
    );

    expect(plans).toHaveLength(1);
    expect(plans[0].activity?.name).toBe("Downtown Dance Club");
    expect(plans[0].activity?.preferences).toContain("nightclub");
  });
});
