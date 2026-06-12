import {
  ACTIVITY_CATEGORIES,
  GENERAL_ACTIVITY_PREFERENCE_SET
} from "@/lib/types";
import type {
  ActivityOption,
  ActivityPreference,
  AccuracyStatus,
  AvailabilityStatus,
  CuisinePreference,
  DietaryTag,
  GroupType,
  Occasion,
  PlanRecommendation,
  PlanningRequest,
  RecommendationEvidence,
  RestaurantOption,
  ScoreBreakdown,
  UserTasteProfile,
  Vibe
} from "@/lib/types";
import { clamp, createId, formatMoney, roundScore } from "@/lib/utils";

const WEIGHTS: ScoreBreakdown = {
  occasionFit: 0.13,
  groupFit: 0.09,
  capacity: 0.13,
  distance: 0.12,
  budget: 0.14,
  dietary: 0.13,
  vibe: 0.11,
  quality: 0.08,
  availability: 0.07
};
const REPEATED_RESTAURANT_TRADEOFF =
  "Repeated restaurant because fewer than 3 valid unique restaurants matched.";
const BAR_ACTIVITY_PREFERENCES = new Set<ActivityPreference>([
  "bar",
  "cocktails",
  "wine_bar",
  "lounge"
]);
const NIGHTCLUB_ACTIVITY_PREFERENCES = new Set<ActivityPreference>([
  "nightclub",
  "dancing",
  "late_night"
]);
const FOOD_ACTIVITY_PREFERENCES = new Set<ActivityPreference>([
  "food_drink_general",
  "coffee",
  "dessert",
  "brunch",
  "tasting_menu",
  "casual_dining",
  "fine_dining",
  "food_hall",
  "picnic",
  "bar",
  "cocktails",
  "wine_bar"
]);
const FOOD_OCCASIONS = new Set<Occasion>([
  "dinner",
  "brunch",
  "coffee_catchup",
  "dessert_run",
  "birthday",
  "celebration",
  "anniversary",
  "date_night",
  "team_dinner",
  "client_meal"
]);
const CUISINE_MATCH_TERMS: Record<CuisinePreference, string[]> = {
  american: ["american", "new american", "steakhouse", "deli"],
  italian: ["italian", "osteria", "pizza"],
  japanese: ["japanese", "sushi", "ramen", "izakaya", "udon"],
  chinese: ["chinese", "dim sum", "szechuan", "sichuan", "cantonese"],
  korean: ["korean"],
  thai: ["thai"],
  mexican: ["mexican", "cal-mex", "taco"],
  mediterranean: ["mediterranean", "greek", "persian"],
  indian: ["indian"],
  french: ["french", "bistro"],
  seafood: ["seafood", "oyster", "fish"],
  vegetarian: ["vegetarian", "vegan", "plant"],
  bbq: ["bbq", "barbecue", "smokehouse"],
  pizza: ["pizza"],
  cafe: ["cafe", "coffee", "bakery", "deli"],
  dessert: ["dessert", "bakery", "ice cream"]
};
const GENERAL_ACTIVITY_EXPANSIONS: Partial<Record<ActivityPreference, ActivityPreference[]>> = {
  food_drink_general: ACTIVITY_CATEGORIES.food_drink.preferences.filter(
    (preference) => !GENERAL_ACTIVITY_PREFERENCE_SET.has(preference)
  ),
  arts_culture_general: ACTIVITY_CATEGORIES.arts_culture_learning.preferences.filter(
    (preference) => !GENERAL_ACTIVITY_PREFERENCE_SET.has(preference)
  ),
  entertainment_general: ACTIVITY_CATEGORIES.entertainment_nightlife.preferences.filter(
    (preference) => !GENERAL_ACTIVITY_PREFERENCE_SET.has(preference)
  ),
  active_general: ACTIVITY_CATEGORIES.active_outdoors.preferences.filter(
    (preference) => !GENERAL_ACTIVITY_PREFERENCE_SET.has(preference)
  ),
  games_general: ACTIVITY_CATEGORIES.games_interactive.preferences.filter(
    (preference) => !GENERAL_ACTIVITY_PREFERENCE_SET.has(preference)
  ),
  exploration_general: ACTIVITY_CATEGORIES.exploration_shopping.preferences.filter(
    (preference) => !GENERAL_ACTIVITY_PREFERENCE_SET.has(preference)
  ),
  home_general: ACTIVITY_CATEGORIES.home_low_key.preferences.filter(
    (preference) => !GENERAL_ACTIVITY_PREFERENCE_SET.has(preference)
  )
};

function overlapRatio<T extends string>(wanted: T[], offered: T[]) {
  if (wanted.length === 0) {
    return 1;
  }

  const offeredSet = new Set(offered);
  const matches = wanted.filter((item) => offeredSet.has(item)).length;
  return matches / wanted.length;
}

function fitScore<T extends Occasion | GroupType>(
  value: T,
  fits: readonly T[],
  fallback = 0.55
) {
  return fits.includes(value) ? 1 : fallback;
}

function capacityScore(groupSize: number, restaurant: RestaurantOption, activity?: ActivityOption) {
  const capacity = Math.min(restaurant.capacity, activity?.capacity ?? restaurant.capacity);
  if (capacity < groupSize) {
    return Math.max(0, capacity / groupSize - 0.15);
  }

  if (capacity >= groupSize * 1.5) {
    return 1;
  }

  return 0.82 + (capacity - groupSize) / Math.max(groupSize * 2, 1);
}

function activityCapacityScore(groupSize: number, activity: ActivityOption) {
  if (activity.capacity < groupSize) {
    return Math.max(0, activity.capacity / groupSize - 0.15);
  }

  if (activity.capacity >= groupSize * 1.5) {
    return 1;
  }

  return 0.82 + (activity.capacity - groupSize) / Math.max(groupSize * 2, 1);
}

function distanceFor(request: PlanningRequest, option: RestaurantOption | ActivityOption) {
  if (request.location.strategy === "from_host") {
    return option.distanceFromHostMiles;
  }

  if (request.location.strategy === "between_attendees") {
    return option.distanceFromCenterMiles;
  }

  if (
    request.location.targetNeighborhood &&
    option.neighborhood.toLowerCase() ===
      request.location.targetNeighborhood.toLowerCase()
  ) {
    return Math.min(option.distanceFromCenterMiles, 0.2);
  }

  return option.distanceFromCenterMiles;
}

function distanceScore(request: PlanningRequest, restaurant: RestaurantOption, activity?: ActivityOption) {
  const maxDistance = request.location.maxDistanceMiles;
  const restaurantDistance = distanceFor(request, restaurant);
  const activityDistance = activity ? distanceFor(request, activity) : restaurantDistance;
  const routeDistance = Math.max(restaurantDistance, activityDistance);

  if (routeDistance <= maxDistance) {
    return clamp(1 - (routeDistance / Math.max(maxDistance, 1)) * 0.4, 0.6, 1);
  }

  const overBy = routeDistance - maxDistance;
  return clamp(0.58 - overBy / Math.max(maxDistance * 1.8, 1), 0.05, 0.58);
}

function activityDistanceScore(request: PlanningRequest, activity: ActivityOption) {
  const maxDistance = request.location.maxDistanceMiles;
  const routeDistance = distanceFor(request, activity);

  if (routeDistance <= maxDistance) {
    return clamp(1 - (routeDistance / Math.max(maxDistance, 1)) * 0.4, 0.6, 1);
  }

  const overBy = routeDistance - maxDistance;
  return clamp(0.58 - overBy / Math.max(maxDistance * 1.8, 1), 0.05, 0.58);
}

function budgetScore(request: PlanningRequest, restaurant: RestaurantOption, activity?: ActivityOption) {
  const cost = restaurant.pricePerPerson + (activity?.pricePerPerson ?? 0);
  const budget = request.budgetPerPerson;

  if (cost <= budget) {
    return clamp(0.78 + (budget - cost) / Math.max(budget * 2, 1), 0.78, 1);
  }

  return clamp(1 - (cost - budget) / Math.max(budget, 1), 0.05, 0.72);
}

function activityBudgetScore(request: PlanningRequest, activity: ActivityOption) {
  const cost = activity.pricePerPerson;
  const budget = request.budgetPerPerson;

  if (cost <= budget) {
    return clamp(0.78 + (budget - cost) / Math.max(budget * 2, 1), 0.78, 1);
  }

  return clamp(1 - (cost - budget) / Math.max(budget, 1), 0.05, 0.72);
}

function dietaryScore(requested: DietaryTag[], restaurant: RestaurantOption) {
  if (requested.length === 0) {
    return 1;
  }

  const base = overlapRatio(requested, restaurant.dietaryTags);
  const allergyFriendly = restaurant.dietaryTags.includes("nut-free") ? 0.08 : 0;
  return clamp(base + allergyFriendly, 0, 1);
}

function cuisineText(restaurant: RestaurantOption) {
  return [
    restaurant.name,
    restaurant.cuisine,
    ...(restaurant.cuisineTags ?? []),
    ...(restaurant.mealTypeTags ?? []),
    ...(restaurant.placeTypes ?? []),
    restaurant.primaryType
  ].join(" ").toLowerCase();
}

function cuisineScore(request: PlanningRequest, restaurant: RestaurantOption) {
  const requested = request.cuisinePreferences ?? [];
  if (requested.length === 0) {
    return 1;
  }

  const text = cuisineText(restaurant);
  const matches = requested.filter((preference) =>
    (CUISINE_MATCH_TERMS[preference] ?? [preference]).some((term) =>
      text.includes(term.toLowerCase())
    )
  ).length;

  return clamp(matches / requested.length, 0, 1);
}

function vibeScore(requested: Vibe[], restaurant: RestaurantOption, activity?: ActivityOption) {
  const combined = [...restaurant.vibes, ...(activity?.vibes ?? [])];
  return clamp(overlapRatio(requested, combined), 0, 1);
}

function availabilityScore(restaurant: RestaurantOption, activity?: ActivityOption) {
  const activityProbability = activity?.availabilityProbability ?? 1;
  return clamp(
    Math.min(
      restaurant.availabilityProbability,
      activityProbability,
      (restaurant.availabilityProbability + activityProbability) / 2
    )
  );
}

function activityQualityScore(activity: ActivityOption) {
  const rating = activity.googleRating ?? activity.rating;
  const reviewCount = activity.googleReviewCount ?? activity.userRatingCount;
  const ratingScore =
    typeof rating === "number" ? clamp((rating - 3.4) / 1.6, 0.25, 1) : 0.58;
  const reviewScore =
    typeof reviewCount === "number"
      ? clamp(Math.log10(Math.max(reviewCount, 1)) / 4, 0.2, 1)
      : 0.5;
  const dataScore = activity.dataConfidenceScore ?? 0.65;

  return clamp(ratingScore * 0.5 + reviewScore * 0.3 + dataScore * 0.2);
}

function qualityScore(restaurant: RestaurantOption) {
  const rating = restaurant.googleRating ?? restaurant.rating;
  const reviewCount = restaurant.googleReviewCount ?? restaurant.userRatingCount;
  const ratingScore =
    typeof rating === "number" ? clamp((rating - 3.4) / 1.6, 0.25, 1) : 0.58;
  const reviewScore =
    typeof reviewCount === "number"
      ? clamp(Math.log10(Math.max(reviewCount, 1)) / 4, 0.2, 1)
      : 0.5;
  const dataScore = restaurant.dataConfidenceScore ?? 0.65;

  return clamp(ratingScore * 0.5 + reviewScore * 0.3 + dataScore * 0.2);
}

function timeConfidenceFor(timeFit?: RestaurantOption["timeFit"] | ActivityOption["timeFit"]) {
  if (!timeFit) return 0.72;
  if (timeFit.status === "open_for_window") return 1;
  if (timeFit.status === "possibly_closed") return 0.3;
  return 0.56;
}

function sourceCompletenessFor(option: RestaurantOption | ActivityOption) {
  let score = option.source === "mock" ? 0.62 : 0.3;
  if (option.placeId) score += 0.14;
  if (option.formattedAddress) score += 0.12;
  if (typeof option.latitude === "number" && typeof option.longitude === "number") score += 0.12;
  if (option.googleMapsUri) score += 0.1;
  if (option.websiteUri) score += 0.08;
  if (option.nationalPhoneNumber || option.internationalPhoneNumber) score += 0.08;
  if (option.placeTypes?.length) score += 0.08;
  if (option.timeFit) score += 0.08;
  return clamp(score, 0, 1);
}

function ratingConfidenceFor(option: RestaurantOption | ActivityOption) {
  const rating = option.googleRating ?? option.rating;
  const reviewCount = option.googleReviewCount ?? option.userRatingCount;
  if (typeof rating !== "number" && typeof reviewCount !== "number") {
    return option.source === "mock" ? 0.72 : 0.38;
  }

  const ratingScore =
    typeof rating === "number" ? clamp((rating - 3.4) / 1.6, 0.2, 1) : 0.42;
  const reviewScore =
    typeof reviewCount === "number"
      ? clamp(Math.log10(Math.max(reviewCount, 1)) / 4, 0.15, 1)
      : 0.35;
  return clamp(ratingScore * 0.45 + reviewScore * 0.55, 0, 1);
}

function locationConfidenceFor(request: PlanningRequest, option: RestaurantOption | ActivityOption) {
  const distance = distanceFor(request, option);
  const maxDistance = request.location.maxDistanceMiles;
  if (distance <= maxDistance) return 1;
  if (distance <= maxDistance * 1.5) return 0.72;
  if (distance <= maxDistance * 3) return 0.4;
  return 0.15;
}

function restaurantCategoryConfidence(request: PlanningRequest, restaurant: RestaurantOption) {
  if (restaurant.evidence?.categoryConfidence !== undefined) {
    return restaurant.evidence.categoryConfidence;
  }

  if (activityFirstRequest(request)) {
    return request.activityPreferences.some((preference) =>
      FOOD_ACTIVITY_PREFERENCES.has(preference)
    )
      ? 0.82
      : 0.25;
  }

  return 0.9;
}

function activityCategoryConfidence(request: PlanningRequest, activity: ActivityOption) {
  if (activity.evidence?.categoryConfidence !== undefined) {
    return activity.evidence.categoryConfidence;
  }

  if (request.activityPreferences.length === 0) {
    return activity.occasionFits.includes(request.occasion) ? 0.82 : 0.64;
  }

  return request.activityPreferences.some((preference) =>
    activityPreferenceMatches(preference, activity)
  )
    ? 1
    : 0.42;
}

function evidenceWarnings(evidence: RecommendationEvidence) {
  const warnings = new Set(evidence.warnings);

  if (evidence.queryStage === "exploratory") {
    warnings.add("Less verified, included for variety.");
  }
  if (evidence.categoryConfidence < 0.7) {
    warnings.add("Category match is less certain.");
  }
  if (evidence.locationConfidence < 0.7) {
    warnings.add("Location is outside the preferred area.");
  }
  if (evidence.timeConfidence < 0.6) {
    warnings.add("Hours need confirmation for your time.");
  }
  if (evidence.sourceCompleteness < 0.55) {
    warnings.add("Place details are incomplete.");
  }
  if (evidence.ratingConfidence < 0.45) {
    warnings.add("Limited public rating signal.");
  }

  return Array.from(warnings);
}

function optionEvidence(
  request: PlanningRequest,
  option: RestaurantOption | ActivityOption,
  categoryConfidence: number
): RecommendationEvidence {
  const base = option.evidence;
  const evidence: RecommendationEvidence = {
    categoryConfidence: clamp(base?.categoryConfidence ?? categoryConfidence),
    locationConfidence: clamp(base?.locationConfidence ?? locationConfidenceFor(request, option)),
    timeConfidence: clamp(base?.timeConfidence ?? timeConfidenceFor(option.timeFit)),
    sourceCompleteness: clamp(base?.sourceCompleteness ?? sourceCompletenessFor(option)),
    ratingConfidence: clamp(base?.ratingConfidence ?? ratingConfidenceFor(option)),
    queryStage: base?.queryStage ?? "exact",
    warnings: base?.warnings ?? []
  };

  return {
    ...evidence,
    warnings: evidenceWarnings(evidence)
  };
}

function combineEvidence(evidences: RecommendationEvidence[]) {
  const lowest = (key: keyof Omit<RecommendationEvidence, "queryStage" | "warnings">) =>
    Math.min(...evidences.map((evidence) => evidence[key]));
  const queryStage = evidences.some((evidence) => evidence.queryStage === "exploratory")
    ? "exploratory"
    : evidences.some((evidence) => evidence.queryStage === "broad")
      ? "broad"
      : evidences.some((evidence) => evidence.queryStage === "expanded")
        ? "expanded"
        : "exact";
  const warnings = Array.from(new Set(evidences.flatMap((evidence) => evidence.warnings)));

  return {
    categoryConfidence: lowest("categoryConfidence"),
    locationConfidence: lowest("locationConfidence"),
    timeConfidence: lowest("timeConfidence"),
    sourceCompleteness: lowest("sourceCompleteness"),
    ratingConfidence: lowest("ratingConfidence"),
    queryStage,
    warnings
  } satisfies RecommendationEvidence;
}

function evidenceScore(evidence: RecommendationEvidence) {
  return clamp(
    evidence.categoryConfidence * 0.28 +
      evidence.locationConfidence * 0.22 +
      evidence.timeConfidence * 0.18 +
      evidence.sourceCompleteness * 0.16 +
      evidence.ratingConfidence * 0.16
  );
}

function accuracyStatusFor(evidence: RecommendationEvidence): AccuracyStatus {
  const score = evidenceScore(evidence);

  if (
    score >= 0.78 &&
    evidence.categoryConfidence >= 0.82 &&
    evidence.locationConfidence >= 0.72 &&
    evidence.timeConfidence >= 0.6
  ) {
    return "verified";
  }

  if (
    score >= 0.58 &&
    evidence.categoryConfidence >= 0.62 &&
    evidence.locationConfidence >= 0.4
  ) {
    return "likely";
  }

  return "exploratory";
}

function groupedRecommendationScore(breakdown: ScoreBreakdown, evidence: RecommendationEvidence) {
  const userFit =
    breakdown.occasionFit * 0.28 +
    breakdown.groupFit * 0.18 +
    breakdown.dietary * 0.18 +
    breakdown.vibe * 0.18 +
    breakdown.budget * 0.18;
  const logisticsFit =
    breakdown.capacity * 0.28 +
    breakdown.distance * 0.3 +
    breakdown.availability * 0.24 +
    breakdown.quality * 0.18;
  return clamp(userFit * 0.45 + logisticsFit * 0.3 + evidenceScore(evidence) * 0.25);
}

function priceTier(cost: number) {
  if (cost <= 25) return "low";
  if (cost <= 55) return "mid";
  if (cost <= 90) return "high";
  return "splurge";
}

function diversityTagsFor(
  recommendation: Pick<PlanRecommendation, "planType" | "restaurant" | "activity" | "estimatedCostPerPerson">
) {
  const tags = new Set<string>();
  tags.add(recommendation.planType ?? (recommendation.restaurant ? "restaurant" : "activity"));
  tags.add(priceTier(recommendation.estimatedCostPerPerson));
  if (recommendation.restaurant?.neighborhood) tags.add(recommendation.restaurant.neighborhood);
  if (recommendation.activity?.neighborhood) tags.add(recommendation.activity.neighborhood);
  if (recommendation.restaurant && recommendation.activity) tags.add("restaurant_activity_pair");
  return Array.from(tags);
}

function profileTextForOption(option: RestaurantOption | ActivityOption) {
  return [
    option.name,
    option.neighborhood,
    "cuisine" in option ? option.cuisine : option.type,
    ...("dietaryTags" in option ? option.dietaryTags : option.preferences),
    ...option.vibes,
    ...(option.placeTypes ?? [])
  ]
    .join(" ")
    .toLowerCase();
}

function categoryMatchesProfile(
  option: RestaurantOption | ActivityOption,
  statusCategory: string
) {
  const text = profileTextForOption(option);
  if (statusCategory === "restaurant") return "cuisine" in option;
  if (statusCategory === "activity" || statusCategory === "sight") return !("cuisine" in option);
  return text.includes(statusCategory);
}

function profileExactMatch(option: RestaurantOption | ActivityOption, profileName: string, profilePlaceId?: string) {
  if (profilePlaceId && option.placeId === profilePlaceId) {
    return true;
  }

  const optionName = identityPart(option.name);
  const wantedName = identityPart(profileName);
  return optionName.length > 2 && wantedName.length > 2 && optionName === wantedName;
}

function isFavoriteFeedback(tags: string[], notes?: string) {
  const text = [...tags, notes ?? ""].join(" ").toLowerCase();
  return /\b(favorite|favourite|love|go-to|goto)\b/.test(text);
}

function profileAdjustmentForOption(
  option: RestaurantOption | ActivityOption,
  profile?: UserTasteProfile
) {
  if (!profile || profile.feedback.length === 0) {
    return { boost: 0, suppress: false, reasons: [] as string[], warnings: [] as string[] };
  }

  let boost = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  for (const feedback of profile.feedback) {
    const exact = profileExactMatch(option, feedback.name, feedback.placeId);
    const favorite = isFavoriteFeedback(feedback.tags, feedback.notes);

    if (exact && feedback.status === "rejected") {
      return {
        boost: -1,
        suppress: true,
        reasons,
        warnings: ["Suppressed because you rejected this place before."]
      };
    }

    if (exact && feedback.status === "visited" && !favorite) {
      return {
        boost: -1,
        suppress: true,
        reasons,
        warnings: ["Suppressed because you already marked this place visited."]
      };
    }

    if (exact && (feedback.status === "bookmarked" || feedback.status === "want_to_go")) {
      boost += 0.07;
      reasons.push("Matches a place from your dashboard");
    }

    if (exact && feedback.status === "approved") {
      boost += 0.05;
      reasons.push("You approved this place before");
    }

    if (exact && feedback.status === "visited" && favorite) {
      boost += 0.05;
      reasons.push("Favorite place from your dashboard");
    }

    if (
      !exact &&
      (feedback.status === "approved" ||
        feedback.status === "bookmarked" ||
        feedback.status === "want_to_go") &&
      categoryMatchesProfile(option, feedback.category)
    ) {
      const optionText = profileTextForOption(option);
      const sharedTag = feedback.tags.some((tag) => optionText.includes(tag.toLowerCase()));
      const sameNeighborhood =
        feedback.neighborhood &&
        option.neighborhood.toLowerCase() === feedback.neighborhood.toLowerCase();

      if (sharedTag || sameNeighborhood) {
        boost += feedback.status === "approved" ? 0.025 : 0.018;
      }
    }
  }

  return {
    boost: clamp(boost, 0, 0.12),
    suppress: false,
    reasons: Array.from(new Set(reasons)).slice(0, 2),
    warnings
  };
}

function profileAdjustmentForRecommendation(
  recommendation: PlanRecommendation,
  profile?: UserTasteProfile
) {
  const restaurantAdjustment = recommendation.restaurant
    ? profileAdjustmentForOption(recommendation.restaurant, profile)
    : undefined;
  const activityAdjustment = recommendation.activity
    ? profileAdjustmentForOption(recommendation.activity, profile)
    : undefined;

  return {
    suppress: Boolean(restaurantAdjustment?.suppress || activityAdjustment?.suppress),
    boost: clamp((restaurantAdjustment?.boost ?? 0) + (activityAdjustment?.boost ?? 0), 0, 0.14),
    reasons: Array.from(
      new Set([...(restaurantAdjustment?.reasons ?? []), ...(activityAdjustment?.reasons ?? [])])
    ),
    warnings: Array.from(
      new Set([...(restaurantAdjustment?.warnings ?? []), ...(activityAdjustment?.warnings ?? [])])
    )
  };
}

function applyProfileSignal<T extends ScoredRecommendation>(
  candidate: T,
  profile?: UserTasteProfile
) {
  const adjustment = profileAdjustmentForRecommendation(candidate.recommendation, profile);

  if (adjustment.suppress) {
    return { ...candidate, profileSuppressed: true };
  }

  if (adjustment.boost <= 0 && adjustment.reasons.length === 0) {
    return { ...candidate, profileSuppressed: false };
  }

  const boostedScore = clamp(candidate.score + adjustment.boost);
  return {
    ...candidate,
    score: boostedScore,
    profileSuppressed: false,
    recommendation: {
      ...candidate.recommendation,
      confidenceScore: roundScore(boostedScore),
      whyRecommended: [
        ...adjustment.reasons,
        ...candidate.recommendation.whyRecommended
      ].slice(0, 6),
      qualityWarnings: [
        ...candidate.recommendation.qualityWarnings,
        ...adjustment.warnings
      ]
    }
  };
}

function occasionScore(request: PlanningRequest, restaurant: RestaurantOption, activity?: ActivityOption) {
  const restaurantScore = fitScore(request.occasion, restaurant.occasionFits);
  const activityScore = activity ? fitScore(request.occasion, activity.occasionFits, 0.6) : 0.84;
  return (restaurantScore * 0.65 + activityScore * 0.35);
}

function groupScore(request: PlanningRequest, restaurant: RestaurantOption, activity?: ActivityOption) {
  const restaurantScore = fitScore(request.groupProfile.typeOfPeople, restaurant.groupTypeFits);
  const activityScore = activity ? fitScore(request.groupProfile.typeOfPeople, activity.groupTypeFits, 0.58) : 0.82;
  return (restaurantScore * 0.7 + activityScore * 0.3);
}

function weightedScore(breakdown: ScoreBreakdown) {
  return Object.entries(breakdown).reduce((total, [key, value]) => {
    return total + value * WEIGHTS[key as keyof ScoreBreakdown];
  }, 0);
}

function activityFirstRequest(request: PlanningRequest) {
  if (
    request.activityPreferences.some(
      (preference) => !FOOD_ACTIVITY_PREFERENCES.has(preference)
    )
  ) {
    return true;
  }

  return !FOOD_OCCASIONS.has(request.occasion);
}

function expandedActivityPreferences(preference: ActivityPreference) {
  return GENERAL_ACTIVITY_EXPANSIONS[preference] ?? [preference];
}

function activityPreferenceMatches(
  preference: ActivityPreference,
  activity: ActivityOption
) {
  return expandedActivityPreferences(preference).some((expandedPreference) =>
    activity.preferences.includes(expandedPreference)
  );
}

function identityPart(value?: string) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function restaurantIdentityKey(restaurant: RestaurantOption) {
  const name = identityPart(restaurant.name);
  const address = identityPart(restaurant.formattedAddress);
  const coordinates =
    typeof restaurant.latitude === "number" && typeof restaurant.longitude === "number"
      ? `${restaurant.latitude.toFixed(4)}:${restaurant.longitude.toFixed(4)}`
      : "";

  if (name && address) {
    return `name-address:${name}:${address}`;
  }

  if (name && coordinates) {
    return `name-coordinates:${name}:${coordinates}`;
  }

  if (restaurant.placeId) {
    return `place:${restaurant.placeId}`;
  }

  return `fallback:${restaurant.id}`;
}

function activityIdentityKey(activity: ActivityOption) {
  const name = identityPart(activity.name);
  const address = identityPart(activity.formattedAddress);
  const coordinates =
    typeof activity.latitude === "number" && typeof activity.longitude === "number"
      ? `${activity.latitude.toFixed(4)}:${activity.longitude.toFixed(4)}`
      : "";

  if (name && address) {
    return `name-address:${name}:${address}`;
  }

  if (name && coordinates) {
    return `name-coordinates:${name}:${coordinates}`;
  }

  if (activity.placeId) {
    return `place:${activity.placeId}`;
  }

  return `fallback:${activity.id}`;
}

function availabilityLabel(score: number): AvailabilityStatus {
  if (score >= 0.75) {
    return "likely_available";
  }

  if (score >= 0.45) {
    return "limited";
  }

  return "unlikely";
}

function activityTimingFor(request: PlanningRequest, activity?: ActivityOption) {
  if (!activity) {
    return undefined;
  }

  if (request.occasion === "anniversary" || activity.preferences.includes("dessert")) {
    return "after" as const;
  }

  return "before" as const;
}

function buildTravelNotes(
  request: PlanningRequest,
  restaurant: RestaurantOption,
  activity?: ActivityOption
) {
  const basis =
    request.location.strategy === "from_host"
      ? "from host"
      : request.location.strategy === "between_attendees"
        ? "from group midpoint"
        : `near ${request.location.targetNeighborhood}`;
  const restaurantDistance = distanceFor(request, restaurant);
  const activityDistance = activity ? distanceFor(request, activity) : undefined;

  if (!activity || activity.neighborhood === restaurant.neighborhood) {
    return `${restaurant.neighborhood}; about ${restaurantDistance.toFixed(1)} mi ${basis}.`;
  }

  return `${restaurant.neighborhood} dinner plus ${activity.neighborhood} activity; farthest stop is ${Math.max(
    restaurantDistance,
    activityDistance ?? 0
  ).toFixed(1)} mi ${basis}.`;
}

function buildActivityTravelNotes(request: PlanningRequest, activity: ActivityOption) {
  const basis =
    request.location.strategy === "from_host"
      ? "from host"
      : request.location.strategy === "between_attendees"
        ? "from group midpoint"
        : `near ${request.location.targetNeighborhood}`;
  const distance = distanceFor(request, activity);

  return `${activity.neighborhood}; about ${distance.toFixed(1)} mi ${basis}.`;
}

function addReason(
  reasons: string[],
  condition: boolean,
  reason: string
) {
  if (condition && reasons.length < 5) {
    reasons.push(reason);
  }
}

function explainPlan(
  request: PlanningRequest,
  restaurant: RestaurantOption,
  breakdown: ScoreBreakdown,
  totalCost: number,
  activity?: ActivityOption
) {
  const reasons: string[] = [];
  const tradeoffs: string[] = [];
  const distance = Math.max(
    distanceFor(request, restaurant),
    activity ? distanceFor(request, activity) : 0
  );

  addReason(
    reasons,
    breakdown.distance >= 0.82,
    request.location.strategy === "from_host"
      ? "Closest to host"
      : request.location.strategy === "target_neighborhood"
        ? "Strong target-neighborhood match"
        : "Central for attendees"
  );
  addReason(
    reasons,
    breakdown.capacity >= 0.95 && restaurant.capacity >= request.groupProfile.numberOfPeople * 1.5,
    "Best for large groups"
  );
  addReason(reasons, breakdown.dietary >= 0.95, "Strong dietary fit");
  addReason(reasons, breakdown.vibe >= 0.9, "Vibe match is high");
  addReason(reasons, breakdown.quality >= 0.82, "Strong Google rating signal");
  addReason(reasons, breakdown.availability >= 0.78, "Highest availability");
  addReason(
    reasons,
    activity !== undefined,
    `${activity?.name} adds a natural ${activityTimingFor(request, activity)}-dinner activity`
  );
  addReason(
    reasons,
    restaurant.occasionFits.includes(request.occasion),
    `${request.occasion} fit is strong`
  );

  if (reasons.length === 0) {
    reasons.push("Balanced fit across budget, distance, and availability");
  }

  if (totalCost > request.budgetPerPerson) {
    tradeoffs.push(`Estimated ${formatMoney(totalCost - request.budgetPerPerson)}/person over budget`);
  }

  if (distance > request.location.maxDistanceMiles) {
    tradeoffs.push(`${(distance - request.location.maxDistanceMiles).toFixed(1)} mi beyond distance target`);
  }

  if (breakdown.dietary < 1 && request.dietaryRestrictions.length > 0) {
    tradeoffs.push("Some dietary restrictions need confirmation");
  }

  if (breakdown.availability < 0.55) {
    tradeoffs.push("Availability is tighter than other options");
  }

  if (restaurant.timeFit?.status === "possibly_closed") {
    tradeoffs.push("Requested time may be outside listed hours; confirm before going.");
  }

  if (restaurant.timeFit?.status === "hours_unknown") {
    tradeoffs.push("Opening hours need confirmation");
  }

  if (restaurant.capacity < request.groupProfile.numberOfPeople) {
    tradeoffs.push("Group exceeds listed capacity");
  }

  return { reasons, tradeoffs };
}

function explainActivityPlan(
  request: PlanningRequest,
  activity: ActivityOption,
  breakdown: ScoreBreakdown,
  totalCost: number
) {
  const reasons: string[] = [];
  const tradeoffs: string[] = [];
  const distance = distanceFor(request, activity);

  addReason(
    reasons,
    breakdown.distance >= 0.82,
    request.location.strategy === "from_host"
      ? "Closest to host"
      : request.location.strategy === "target_neighborhood"
        ? "Strong target-neighborhood match"
        : "Central for attendees"
  );
  addReason(
    reasons,
    breakdown.capacity >= 0.95 && activity.capacity >= request.groupProfile.numberOfPeople * 1.5,
    "Good fit for the group size"
  );
  addReason(reasons, breakdown.quality >= 0.82, "Strong Google rating signal");
  addReason(reasons, breakdown.availability >= 0.78, "Highest availability");
  addReason(
    reasons,
    activity.occasionFits.includes(request.occasion),
    `${request.occasion} fit is strong`
  );
  addReason(
    reasons,
    request.activityPreferences.some((preference) =>
      activityPreferenceMatches(preference, activity)
    ),
    "Matches the activity you asked for"
  );

  if (reasons.length === 0) {
    reasons.push("Balanced fit across budget, distance, and availability");
  }

  if (totalCost > request.budgetPerPerson) {
    tradeoffs.push(`Estimated ${formatMoney(totalCost - request.budgetPerPerson)}/person over budget`);
  }

  if (distance > request.location.maxDistanceMiles) {
    tradeoffs.push(`${(distance - request.location.maxDistanceMiles).toFixed(1)} mi beyond distance target`);
  }

  if (breakdown.availability < 0.55) {
    tradeoffs.push("Availability is tighter than other options");
  }

  if (activity.timeFit?.status === "possibly_closed") {
    tradeoffs.push("Requested time may be outside listed hours; confirm before going.");
  }

  if (activity.timeFit?.status === "hours_unknown") {
    tradeoffs.push("Opening hours need confirmation");
  }

  if (activity.capacity < request.groupProfile.numberOfPeople) {
    tradeoffs.push("Group exceeds listed capacity");
  }

  return { reasons, tradeoffs };
}

function scorePlan(
  request: PlanningRequest,
  restaurant: RestaurantOption,
  activity?: ActivityOption
) {
  const totalCost = restaurant.pricePerPerson + (activity?.pricePerPerson ?? 0);
  const breakdown: ScoreBreakdown = {
    occasionFit: occasionScore(request, restaurant, activity),
    groupFit: groupScore(request, restaurant, activity),
    capacity: capacityScore(request.groupProfile.numberOfPeople, restaurant, activity),
    distance: distanceScore(request, restaurant, activity),
    budget: budgetScore(request, restaurant, activity),
    dietary: dietaryScore(request.dietaryRestrictions, restaurant),
    vibe: vibeScore(request.vibe, restaurant, activity),
    quality: qualityScore(restaurant),
    availability: availabilityScore(restaurant, activity)
  };
  const evidence = combineEvidence([
    optionEvidence(request, restaurant, restaurantCategoryConfidence(request, restaurant)),
    ...(activity
      ? [optionEvidence(request, activity, activityCategoryConfidence(request, activity))]
      : [])
  ]);
  const evidenceValue = evidenceScore(evidence);
  const accuracyStatus = accuracyStatusFor(evidence);
  const cuisineFit = cuisineScore(request, restaurant);
  const cuisineWeight = (request.cuisinePreferences ?? []).length > 0 ? 0.28 : 0;
  const score = clamp(
    groupedRecommendationScore(breakdown, evidence) * (1 - cuisineWeight + cuisineFit * cuisineWeight)
  );
  const { reasons, tradeoffs } = explainPlan(
    request,
    restaurant,
    breakdown,
    totalCost,
    activity
  );

  return {
    score,
    recommendation: {
      id: createId("plan"),
      requestId: request.id,
      rank: 0,
      planType: "restaurant" as const,
      restaurant,
      activity,
      activityTiming: activityTimingFor(request, activity),
      estimatedCostPerPerson: totalCost,
      estimatedCostTotal: totalCost * request.groupProfile.numberOfPeople,
      travelNotes: buildTravelNotes(request, restaurant, activity),
      availabilityStatus: availabilityLabel(breakdown.availability),
      confidenceScore: roundScore(score),
      whyRecommended: [
        accuracyStatus === "verified"
          ? "Verified category and location"
          : accuracyStatus === "likely"
            ? "Likely fit with enough source evidence"
            : "Exploratory option for variety",
        ...(cuisineFit >= 0.9 && (request.cuisinePreferences ?? []).length > 0
          ? ["Cuisine match"]
          : []),
        ...reasons
      ].slice(0, 6),
      tradeoffs: [
        ...tradeoffs,
        ...(cuisineFit < 0.35 && (request.cuisinePreferences ?? []).length > 0
          ? ["Cuisine match needs confirmation"]
          : [])
      ],
      scoreBreakdown: breakdown,
      accuracyStatus,
      evidenceScore: roundScore(evidenceValue),
      diversityTags: diversityTagsFor({
        planType: "restaurant",
        restaurant,
        activity,
        estimatedCostPerPerson: totalCost
      }),
      qualityWarnings: evidence.warnings,
      state: "pending_review" as const
    }
  };
}

function scoreActivityPlan(request: PlanningRequest, activity: ActivityOption) {
  const totalCost = activity.pricePerPerson;
  const vibeBreakdown =
    request.vibe.length > 0 ? clamp(overlapRatio(request.vibe, activity.vibes), 0, 1) : 1;
  const breakdown: ScoreBreakdown = {
    occasionFit: fitScore(request.occasion, activity.occasionFits, 0.64),
    groupFit: fitScore(request.groupProfile.typeOfPeople, activity.groupTypeFits, 0.58),
    capacity: activityCapacityScore(request.groupProfile.numberOfPeople, activity),
    distance: activityDistanceScore(request, activity),
    budget: activityBudgetScore(request, activity),
    dietary: 1,
    vibe: vibeBreakdown,
    quality: activityQualityScore(activity),
    availability: clamp(activity.availabilityProbability)
  };
  const evidence = optionEvidence(
    request,
    activity,
    activityCategoryConfidence(request, activity)
  );
  const evidenceValue = evidenceScore(evidence);
  const accuracyStatus = accuracyStatusFor(evidence);
  const score = groupedRecommendationScore(breakdown, evidence);
  const { reasons, tradeoffs } = explainActivityPlan(
    request,
    activity,
    breakdown,
    totalCost
  );

  return {
    score,
    recommendation: {
      id: createId("plan"),
      requestId: request.id,
      rank: 0,
      planType: "activity" as const,
      activity,
      estimatedCostPerPerson: totalCost,
      estimatedCostTotal: totalCost * request.groupProfile.numberOfPeople,
      travelNotes: buildActivityTravelNotes(request, activity),
      availabilityStatus: availabilityLabel(breakdown.availability),
      confidenceScore: roundScore(score),
      whyRecommended: [
        accuracyStatus === "verified"
          ? "Verified category and location"
          : accuracyStatus === "likely"
            ? "Likely fit with enough source evidence"
            : "Exploratory option for variety",
        ...reasons
      ].slice(0, 6),
      tradeoffs,
      scoreBreakdown: breakdown,
      accuracyStatus,
      evidenceScore: roundScore(evidenceValue),
      diversityTags: diversityTagsFor({
        planType: "activity",
        activity,
        estimatedCostPerPerson: totalCost
      }),
      qualityWarnings: evidence.warnings,
      state: "pending_review" as const
    }
  };
}

function activityText(activity: ActivityOption) {
  return [
    activity.name,
    activity.type,
    activity.primaryType,
    ...(activity.placeTypes ?? []),
    ...activity.preferences
  ].join(" ").toLowerCase();
}

function requestWantsNightclub(request: PlanningRequest) {
  return request.activityPreferences.some((preference) =>
    NIGHTCLUB_ACTIVITY_PREFERENCES.has(preference)
  );
}

function requestWantsBar(request: PlanningRequest) {
  return request.activityPreferences.some((preference) =>
    BAR_ACTIVITY_PREFERENCES.has(preference)
  );
}

function activityIsNightclub(activity: ActivityOption) {
  const text = activityText(activity);
  return (
    activity.preferences.some((preference) =>
      NIGHTCLUB_ACTIVITY_PREFERENCES.has(preference)
    ) ||
    text.includes("night_club") ||
    text.includes("night club") ||
    text.includes("nightclub") ||
    text.includes("dance club")
  );
}

function activityIsBar(activity: ActivityOption) {
  const text = activityText(activity);
  return (
    activity.preferences.some((preference) =>
      BAR_ACTIVITY_PREFERENCES.has(preference)
    ) ||
    text.includes("bar") ||
    text.includes("pub") ||
    text.includes("lounge")
  );
}

function incompatibleNightlifeSubtype(
  request: PlanningRequest,
  activity: ActivityOption
) {
  const wantsNightclub = requestWantsNightclub(request);
  const wantsBar = requestWantsBar(request);
  const isNightclub = activityIsNightclub(activity);
  const isBar = activityIsBar(activity);

  if (wantsNightclub && isBar && !isNightclub) {
    return true;
  }

  if (wantsBar && isNightclub && !wantsNightclub) {
    return true;
  }

  return false;
}

function requestRequiresActivity(request: PlanningRequest) {
  return request.activityPreferences.some((preference) =>
    NIGHTCLUB_ACTIVITY_PREFERENCES.has(preference)
  );
}

function recommendationPrimaryKey(recommendation: PlanRecommendation) {
  if (recommendation.planType === "activity" && recommendation.activity) {
    return activityIdentityKey(recommendation.activity);
  }

  if (recommendation.restaurant) {
    return restaurantIdentityKey(recommendation.restaurant);
  }

  if (recommendation.activity) {
    return activityIdentityKey(recommendation.activity);
  }

  return recommendation.id;
}

export function dedupePlanRecommendationsByRestaurant(
  recommendations: PlanRecommendation[]
) {
  const seenRestaurants = new Set<string>();
  const seenActivities = new Set<string>();
  const deduped: PlanRecommendation[] = [];

  for (const recommendation of recommendations) {
    const restaurantKey = recommendation.restaurant
      ? restaurantIdentityKey(recommendation.restaurant)
      : undefined;
    const activityKey = recommendation.activity
      ? activityIdentityKey(recommendation.activity)
      : undefined;

    if (
      (restaurantKey !== undefined && seenRestaurants.has(restaurantKey)) ||
      (activityKey !== undefined && seenActivities.has(activityKey))
    ) {
      continue;
    }

    if (restaurantKey !== undefined) {
      seenRestaurants.add(restaurantKey);
    }
    if (activityKey !== undefined) {
      seenActivities.add(activityKey);
    }
    deduped.push({
      ...recommendation,
      accuracyStatus: recommendation.accuracyStatus ?? "likely",
      evidenceScore: recommendation.evidenceScore ?? recommendation.confidenceScore,
      diversityTags:
        recommendation.diversityTags ??
        diversityTagsFor({
          planType: recommendation.planType,
          restaurant: recommendation.restaurant,
          activity: recommendation.activity,
          estimatedCostPerPerson: recommendation.estimatedCostPerPerson
        }),
      qualityWarnings: recommendation.qualityWarnings ?? []
    });
  }

  return deduped.map((recommendation, index) => ({
    ...recommendation,
    rank: index + 1,
    tradeoffs: recommendation.tradeoffs.filter(
      (tradeoff) => tradeoff !== REPEATED_RESTAURANT_TRADEOFF
    )
  }));
}

type ScoredRecommendation = {
  score: number;
  recommendation: PlanRecommendation;
};

function diversifyRestaurantCandidates<T extends ScoredRecommendation>(ordered: T[]) {
  const pairedPlans = ordered.filter(
    (candidate) => candidate.recommendation.restaurant && candidate.recommendation.activity
  );
  const restaurantOnlyPlans = ordered.filter(
    (candidate) => candidate.recommendation.restaurant && !candidate.recommendation.activity
  );
  const otherPlans = ordered.filter(
    (candidate) => !candidate.recommendation.restaurant
  );

  if (pairedPlans.length < 2 || restaurantOnlyPlans.length === 0) {
    return ordered;
  }

  return [...pairedPlans, ...restaurantOnlyPlans, ...otherPlans];
}

function activityMatchesRequest(request: PlanningRequest, activity: ActivityOption) {
  if (incompatibleNightlifeSubtype(request, activity)) {
    return false;
  }

  const requestedPrefs = request.activityPreferences;
  const preferenceMatch =
    requestedPrefs.length === 0 ||
    requestedPrefs.some((preference) =>
      activityPreferenceMatches(preference, activity)
    );

  if (requestedPrefs.length > 0) {
    return preferenceMatch;
  }

  const vibeMatch = request.vibe.some((vibe) => activity.vibes.includes(vibe));
  const occasionMatch = activity.occasionFits.includes(request.occasion);

  return vibeMatch || occasionMatch;
}

function shouldPair(
  request: PlanningRequest,
  restaurant: RestaurantOption,
  activity: ActivityOption
) {
  if (!activityMatchesRequest(request, activity)) {
    return false;
  }

  if (activity.capacity < request.groupProfile.numberOfPeople) {
    return false;
  }

  const routeDistance = Math.max(distanceFor(request, restaurant), distanceFor(request, activity));
  const sameNeighborhood = restaurant.neighborhood === activity.neighborhood;

  const activityBuffer = request.location.maxDistanceMiles <= 3 ? 0.75 : 2;
  return sameNeighborhood || routeDistance <= request.location.maxDistanceMiles + activityBuffer;
}

function conflictsWithHardConstraints(
  request: PlanningRequest,
  recommendation: PlanRecommendation
) {
  const breakdown = recommendation.scoreBreakdown;
  const restaurant = recommendation.restaurant;
  const activity = recommendation.activity;
  const routeDistance = restaurant
    ? Math.max(
        distanceFor(request, restaurant),
        activity ? distanceFor(request, activity) : 0
      )
    : activity
      ? distanceFor(request, activity)
      : Number.POSITIVE_INFINITY;
  const text = [
    restaurant?.name,
    restaurant?.cuisine,
    restaurant?.primaryType,
    ...(restaurant?.placeTypes ?? []),
    activity?.name,
    activity?.type,
    activity?.primaryType,
    ...(activity?.placeTypes ?? [])
  ].join(" ").toLowerCase();

  if (routeDistance > request.location.maxDistanceMiles * 3) {
    return true;
  }

  if (recommendation.estimatedCostPerPerson > request.budgetPerPerson) {
    return true;
  }

  if (breakdown.capacity <= 0.25) {
    return true;
  }

  if (request.dietaryRestrictions.length > 0 && breakdown.dietary <= 0) {
    return true;
  }

  if (
    request.vibe.includes("kid-friendly") &&
    request.groupProfile.typeOfPeople === "family" &&
    (text.includes("bar") || text.includes("night_club"))
  ) {
    return true;
  }

  return false;
}

export function generatePlanRecommendations(
  request: PlanningRequest,
  restaurants: RestaurantOption[],
  activities: ActivityOption[],
  profile?: UserTasteProfile
) {
  const activityFirst = activityFirstRequest(request);
  const candidates = activityFirst
    ? activities
        .filter((activity) => activityMatchesRequest(request, activity))
        .filter((activity) => activity.capacity >= request.groupProfile.numberOfPeople)
        .map((activity) => scoreActivityPlan(request, activity))
    : restaurants.flatMap((restaurant) => {
        const restaurantOnly = requestRequiresActivity(request)
          ? []
          : [scorePlan(request, restaurant)];
        const activityPlans = activities
          .filter((activity) => shouldPair(request, restaurant, activity))
          .map((activity) => scorePlan(request, restaurant, activity));

        return [...restaurantOnly, ...activityPlans];
      });

  const adjustedCandidates = candidates.map((candidate) =>
    applyProfileSignal(candidate, profile)
  );
  const viable = adjustedCandidates
    .filter(({ recommendation, profileSuppressed }) => {
      const breakdown = recommendation.scoreBreakdown;
      return (
        !profileSuppressed &&
        !conflictsWithHardConstraints(request, recommendation) &&
        breakdown.budget > 0.12 &&
        breakdown.dietary > 0.25 &&
        recommendation.confidenceScore >= 45
      );
    })
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }

      return first.recommendation.estimatedCostPerPerson - second.recommendation.estimatedCostPerPerson;
    });

  const primaryViable = viable.filter(
    ({ recommendation }) => recommendation.accuracyStatus !== "exploratory"
  );
  const exploratoryViable = viable.filter(
    ({ recommendation }) =>
      recommendation.accuracyStatus === "exploratory" &&
      recommendation.qualityWarnings.length > 0
  );
  const orderedViable = activityFirst
    ? primaryViable
    : diversifyRestaurantCandidates(primaryViable);
  const selectedCandidates: typeof viable = [];
  const seenRestaurants = new Set<string>();
  const seenActivities = new Set<string>();
  const neighborhoodCounts = new Map<string, number>();
  const priceTierCounts = new Map<string, number>();

  const addCandidate = (candidate: (typeof viable)[number], strictDiversity: boolean) => {
    const recommendation = candidate.recommendation as PlanRecommendation;
    const primaryKey = recommendationPrimaryKey(recommendation);
    const restaurantKey = recommendation.restaurant
      ? restaurantIdentityKey(recommendation.restaurant)
      : undefined;
    const activityKey = recommendation.activity
      ? activityIdentityKey(recommendation.activity)
      : undefined;
    const neighborhoods = Array.from(
      new Set(
        [recommendation.restaurant?.neighborhood, recommendation.activity?.neighborhood]
          .filter(Boolean)
          .map((neighborhood) => neighborhood as string)
      )
    );
    const tier = priceTier(recommendation.estimatedCostPerPerson);

    if (
      (restaurantKey && seenRestaurants.has(restaurantKey)) ||
      (activityKey && seenActivities.has(activityKey)) ||
      (!restaurantKey && !activityKey && seenActivities.has(primaryKey))
    ) {
      return false;
    }

    if (
      strictDiversity &&
      neighborhoods.some((neighborhood) => (neighborhoodCounts.get(neighborhood) ?? 0) >= 2)
    ) {
      return false;
    }

    if (strictDiversity && (priceTierCounts.get(tier) ?? 0) >= 3) {
      return false;
    }

    selectedCandidates.push(candidate);
    if (restaurantKey) {
      seenRestaurants.add(restaurantKey);
    }
    if (activityKey) {
      seenActivities.add(activityKey);
    }
    if (!restaurantKey && !activityKey) {
      seenActivities.add(primaryKey);
    }
    for (const neighborhood of neighborhoods) {
      neighborhoodCounts.set(neighborhood, (neighborhoodCounts.get(neighborhood) ?? 0) + 1);
    }
    priceTierCounts.set(tier, (priceTierCounts.get(tier) ?? 0) + 1);

    return true;
  };

  for (const candidate of orderedViable) {
    addCandidate(candidate, true);
    if (selectedCandidates.length >= 7) break;
  }

  if (selectedCandidates.length < Math.min(7, orderedViable.length)) {
    for (const candidate of orderedViable) {
      addCandidate(candidate, false);
      if (selectedCandidates.length >= 7) break;
    }
  }

  if (selectedCandidates.length >= 3 && selectedCandidates.length < 7) {
    for (const candidate of exploratoryViable) {
      if (addCandidate(candidate, false)) break;
    }
  }

  return dedupePlanRecommendationsByRestaurant(
    selectedCandidates.map(({ recommendation }) => recommendation)
  );
}

export function buildNoOptionsSuggestions(request: PlanningRequest) {
  const suggestions: string[] = [];

  if (request.location.maxDistanceMiles < 4) {
    suggestions.push("Widen the distance radius by 0.5-1.5 miles.");
  } else if (request.location.maxDistanceMiles < 8) {
    suggestions.push("Widen the distance radius by 2-3 miles.");
  }

  if (request.budgetPerPerson < 45) {
    suggestions.push("Raise the budget or remove paid activities.");
  }

  if (request.dietaryRestrictions.length > 2) {
    suggestions.push("Confirm which dietary restrictions are strict versus preferred.");
  }

  if (request.location.strategy === "target_neighborhood") {
    suggestions.push("Try another nearby neighborhood.");
  }

  if (request.vibe.length > 1) {
    suggestions.push("Remove one vibe filter if the area has fewer matching places.");
  }

  suggestions.push("Broaden the time window to improve availability.");
  return suggestions;
}
