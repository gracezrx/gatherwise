import { getGooglePlacesApiKey } from "@/lib/store/providerConfig";
import type {
  ActivityOption,
  ActivityPreference,
  DietaryTag,
  EvidenceQueryStage,
  GroupType,
  Occasion,
  PlanningRequest,
  RecommendationEvidence,
  PlaceTimeFit,
  RestaurantOption,
  Vibe
} from "@/lib/types";
import { clamp, stableHash, toTitle } from "@/lib/utils";
import type { ActivitySearchProvider, RestaurantSearchProvider } from "./interfaces";

const PLACES_TEXT_SEARCH_ENDPOINT =
  "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.types",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.accessibilityOptions",
  "places.priceLevel",
  "places.rating",
  "places.regularOpeningHours",
  "places.currentOpeningHours",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.reservable",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.businessStatus",
  "places.goodForChildren",
  "places.servesBeer",
  "places.servesBreakfast",
  "places.servesBrunch",
  "places.servesCocktails",
  "places.servesCoffee",
  "places.servesDessert",
  "places.servesDinner",
  "places.servesLunch",
  "places.servesVegetarianFood",
  "places.servesWine"
].join(",");

const ALL_GROUP_TYPES: GroupType[] = [
  "friends",
  "coworkers",
  "family",
  "date",
  "clients",
  "mixed group"
];

const CORE_OCCASIONS: Occasion[] = [
  "dinner",
  "brunch",
  "coffee_catchup",
  "dessert_run",
  "birthday",
  "celebration",
  "anniversary",
  "date_night",
  "team_dinner",
  "client_meal",
  "museum_day",
  "gallery_day",
  "campus_visit",
  "sightseeing",
  "date_day",
  "family_day",
  "learning_day",
  "parents_visiting",
  "night_out",
  "casual_hangout",
  "team_outing",
  "after_work_hangout",
  "double_date",
  "outdoor_day",
  "casual_workout",
  "wellness_day",
  "weekend_plan",
  "group_night",
  "local_discovery",
  "tourist_day",
  "low_key_meetup",
  "rainy_day_plan",
  "kids_outing"
];

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
const CUISINE_SEARCH_TERMS: Record<string, string[]> = {
  american: ["american restaurants"],
  italian: ["italian restaurants"],
  japanese: ["japanese restaurants", "sushi restaurants", "ramen restaurants"],
  chinese: ["chinese restaurants", "dim sum restaurants"],
  korean: ["korean restaurants", "korean bbq restaurants"],
  thai: ["thai restaurants"],
  mexican: ["mexican restaurants", "taco restaurants"],
  mediterranean: ["mediterranean restaurants", "greek restaurants"],
  indian: ["indian restaurants"],
  french: ["french restaurants", "bistros"],
  seafood: ["seafood restaurants"],
  vegetarian: ["vegetarian restaurants", "vegan restaurants"],
  bbq: ["bbq restaurants", "barbecue restaurants"],
  pizza: ["pizza restaurants"],
  cafe: ["cafes", "coffee shops"],
  dessert: ["dessert shops", "bakeries"]
};

const NEIGHBORHOOD_COORDINATES = [
  { name: "Downtown Palo Alto", latitude: 37.4443, longitude: -122.1612 },
  { name: "University South", latitude: 37.4422, longitude: -122.1584 },
  { name: "Professorville", latitude: 37.4426, longitude: -122.1508 },
  { name: "Crescent Park", latitude: 37.4539, longitude: -122.1466 },
  { name: "Stanford", latitude: 37.4275, longitude: -122.1697 },
  { name: "California Ave", latitude: 37.4294, longitude: -122.143 },
  { name: "Evergreen Park", latitude: 37.4243, longitude: -122.1391 },
  { name: "Midtown Palo Alto", latitude: 37.4339, longitude: -122.1318 },
  { name: "Barron Park", latitude: 37.4145, longitude: -122.1352 },
  { name: "Charleston Meadow", latitude: 37.4228, longitude: -122.1133 },
  { name: "Palo Verde", latitude: 37.4277, longitude: -122.1205 },
  { name: "Menlo Park", latitude: 37.4529, longitude: -122.1817 },
  { name: "Mountain View", latitude: 37.3861, longitude: -122.0839 }
];

type Coordinates = {
  latitude: number;
  longitude: number;
};

type OpeningHoursPoint = {
  day?: number;
  hour?: number;
  minute?: number;
};

type OpeningHoursPeriod = {
  open?: OpeningHoursPoint;
  close?: OpeningHoursPoint;
};

type OpeningHours = {
  openNow?: boolean;
  periods?: OpeningHoursPeriod[];
  weekdayDescriptions?: string[];
};

type GooglePlace = {
  id?: string;
  displayName?: {
    text?: string;
  };
  formattedAddress?: string;
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
  location?: Coordinates;
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: {
    text?: string;
  };
  priceLevel?:
    | "PRICE_LEVEL_FREE"
    | "PRICE_LEVEL_INEXPENSIVE"
    | "PRICE_LEVEL_MODERATE"
    | "PRICE_LEVEL_EXPENSIVE"
    | "PRICE_LEVEL_VERY_EXPENSIVE";
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  reservable?: boolean;
  regularOpeningHours?: OpeningHours;
  currentOpeningHours?: OpeningHours;
  businessStatus?: string;
  accessibilityOptions?: Record<string, boolean>;
  goodForChildren?: boolean;
  servesBeer?: boolean;
  servesBreakfast?: boolean;
  servesBrunch?: boolean;
  servesCocktails?: boolean;
  servesCoffee?: boolean;
  servesDessert?: boolean;
  servesDinner?: boolean;
  servesLunch?: boolean;
  servesVegetarianFood?: boolean;
  servesWine?: boolean;
  queryStage?: EvidenceQueryStage;
};

type GooglePlacesResponse = {
  places?: GooglePlace[];
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function optionId(prefix: string, place: GooglePlace) {
  const seed = place.id ?? place.displayName?.text ?? "google-place";
  return `${prefix}_${stableHash(seed).toString(36)}`;
}

function metersFromMiles(miles: number) {
  return Math.round(clamp(miles, 0.5, 30) * 1609.344);
}

function toCoordinates(coordinates: Coordinates): Coordinates {
  return {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude
  };
}

function coordinateForNeighborhood(neighborhood?: string): Coordinates {
  if (!neighborhood) {
    return toCoordinates(NEIGHBORHOOD_COORDINATES[0]);
  }

  const wanted = normalize(neighborhood);
  const exact = NEIGHBORHOOD_COORDINATES.find(
    (candidate) => normalize(candidate.name) === wanted
  );

  if (exact) {
    return toCoordinates(exact);
  }

  const nearest =
    NEIGHBORHOOD_COORDINATES.find((candidate) => {
      const normalizedName = normalize(candidate.name);
      return normalizedName.includes(wanted) || wanted.includes(normalizedName);
    }) ?? NEIGHBORHOOD_COORDINATES[0];

  return toCoordinates(nearest);
}

function milesBetween(first: Coordinates, second: Coordinates) {
  const earthRadiusMiles = 3958.8;
  const lat1 = (first.latitude * Math.PI) / 180;
  const lat2 = (second.latitude * Math.PI) / 180;
  const deltaLat = ((second.latitude - first.latitude) * Math.PI) / 180;
  const deltaLng = ((second.longitude - first.longitude) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function averageCoordinates(coordinates: Coordinates[]) {
  if (coordinates.length === 0) {
    return toCoordinates(NEIGHBORHOOD_COORDINATES[0]);
  }

  return {
    latitude:
      coordinates.reduce((total, coordinate) => total + coordinate.latitude, 0) /
      coordinates.length,
    longitude:
      coordinates.reduce((total, coordinate) => total + coordinate.longitude, 0) /
      coordinates.length
  };
}

function anchorsFor(request: PlanningRequest) {
  const resolved = request.location.resolvedLocation;

  if (resolved) {
    const center = {
      latitude: resolved.latitude,
      longitude: resolved.longitude
    };

    return {
      host: center,
      center,
      label: resolved.formattedAddress || resolved.label,
      timeZone: resolved.timeZone,
      locality: resolved.locality,
      region: resolved.region,
      country: resolved.country
    };
  }

  if (request.location.strategy === "from_host") {
    const host = coordinateForNeighborhood(request.location.hostNeighborhood);
    return {
      host,
      center: host,
      label: request.location.hostNeighborhood ?? "Palo Alto",
      timeZone: "America/Los_Angeles"
    };
  }

  if (request.location.strategy === "between_attendees") {
    const attendeeCoordinates = (request.location.attendeeNeighborhoods ?? [])
      .filter(Boolean)
      .map((neighborhood) => coordinateForNeighborhood(neighborhood));
    const center = averageCoordinates(attendeeCoordinates);
    return {
      host: attendeeCoordinates[0] ?? center,
      center,
      label: nearestNeighborhood(center),
      timeZone: "America/Los_Angeles"
    };
  }

  const target = coordinateForNeighborhood(request.location.targetNeighborhood);
  return {
    host: coordinateForNeighborhood(request.location.hostNeighborhood),
    center: target,
    label: request.location.targetNeighborhood ?? "Palo Alto",
    timeZone: "America/Los_Angeles"
  };
}

function nearestNeighborhood(coordinates: Coordinates) {
  return NEIGHBORHOOD_COORDINATES.reduce((nearest, candidate) => {
    const nearestDistance = milesBetween(coordinates, nearest);
    const candidateDistance = milesBetween(coordinates, candidate);
    return candidateDistance < nearestDistance ? candidate : nearest;
  }, NEIGHBORHOOD_COORDINATES[0]).name;
}

const LOCAL_DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?$/;

function zonedWeekMinute(date: Date, timeZone = "America/Los_Angeles") {
  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const valueFor = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekday = valueFor("weekday");
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const hour = Number(valueFor("hour"));
  const minute = Number(valueFor("minute"));

  return Math.max(day, 0) * 24 * 60 + hour * 60 + minute;
}

export function weekMinuteForPlanningTime(
  value: string,
  timeZone = "America/Los_Angeles"
) {
  const localMatch = LOCAL_DATETIME_PATTERN.exec(value);

  if (localMatch) {
    const [, year, month, day, hour, minute] = localMatch;
    const weekday = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), 12)
    ).getUTCDay();

    return weekday * 24 * 60 + Number(hour) * 60 + Number(minute);
  }

  return zonedWeekMinute(new Date(value), timeZone);
}

function pointWeekMinute(point?: OpeningHoursPoint) {
  if (!point || point.day === undefined || point.hour === undefined) {
    return undefined;
  }

  return point.day * 24 * 60 + point.hour * 60 + (point.minute ?? 0);
}

function isWindowCoveredByOpeningHours(
  request: PlanningRequest,
  periods: OpeningHoursPeriod[],
  timeZone?: string
) {
  if (periods.length === 0) {
    return false;
  }

  const week = 7 * 24 * 60;
  const start = weekMinuteForPlanningTime(
    request.timeWindow.localStart ?? request.timeWindow.start,
    timeZone
  );
  let end = weekMinuteForPlanningTime(
    request.timeWindow.localEnd ?? request.timeWindow.end,
    timeZone
  );

  if (end <= start) {
    end += week;
  }

  return periods.some((period) => {
    const open = pointWeekMinute(period.open);
    const close = pointWeekMinute(period.close);

    if (open === undefined) {
      return false;
    }

    if (close === undefined) {
      return true;
    }

    let normalizedClose = close;
    if (normalizedClose <= open) {
      normalizedClose += week;
    }

    return [-week, 0, week].some((offset) => {
      const shiftedOpen = open + offset;
      const shiftedClose = normalizedClose + offset;
      return start >= shiftedOpen && end <= shiftedClose;
    });
  });
}

function timeFitFor(place: GooglePlace, request: PlanningRequest): PlaceTimeFit {
  const regularHours = place.regularOpeningHours;
  const weekdayDescriptions = regularHours?.weekdayDescriptions;
  const timeZone = request.timeWindow.timeZone ?? anchorsFor(request).timeZone;

  if (!regularHours?.periods?.length) {
    return {
      status: "hours_unknown",
      label: "Hours need confirmation",
      detail: "Google did not return regular hours for this place.",
      openNow: place.currentOpeningHours?.openNow ?? regularHours?.openNow,
      weekdayDescriptions
    };
  }

  if (isWindowCoveredByOpeningHours(request, regularHours.periods, timeZone)) {
    return {
      status: "open_for_window",
      label: "Looks open for your time",
      detail: "The requested window appears to fit Google regular hours.",
      openNow: place.currentOpeningHours?.openNow ?? regularHours.openNow,
      weekdayDescriptions
    };
  }

  return {
    status: "possibly_closed",
    label: "May be closed then",
    detail: "The requested window does not appear to fit Google regular hours.",
    openNow: place.currentOpeningHours?.openNow ?? regularHours.openNow,
    weekdayDescriptions
  };
}

function placeCoordinates(place: GooglePlace, fallback: Coordinates) {
  return place.location ?? fallback;
}

function componentValue(place: GooglePlace, wantedType: string) {
  return place.addressComponents?.find((component) =>
    component.types?.includes(wantedType)
  )?.longText;
}

function placeLocality(place: GooglePlace) {
  return (
    componentValue(place, "neighborhood") ??
    componentValue(place, "sublocality") ??
    componentValue(place, "locality") ??
    componentValue(place, "postal_town")
  );
}

function pricePerPersonForRestaurant(priceLevel?: GooglePlace["priceLevel"]) {
  switch (priceLevel) {
    case "PRICE_LEVEL_INEXPENSIVE":
      return 24;
    case "PRICE_LEVEL_MODERATE":
      return 48;
    case "PRICE_LEVEL_EXPENSIVE":
      return 78;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 120;
    case "PRICE_LEVEL_FREE":
      return 0;
    default:
      return 44;
  }
}

function pricePerPersonForActivity(place: GooglePlace) {
  if (
    place.priceLevel === "PRICE_LEVEL_FREE" ||
    place.types?.some((type) => ["park", "tourist_attraction"].includes(type))
  ) {
    return 0;
  }

  switch (place.priceLevel) {
    case "PRICE_LEVEL_INEXPENSIVE":
      return 12;
    case "PRICE_LEVEL_MODERATE":
      return 28;
    case "PRICE_LEVEL_EXPENSIVE":
      return 55;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 85;
    default:
      return 18;
  }
}

function cuisineFor(place: GooglePlace) {
  const text = normalize(
    [
      place.displayName?.text,
      place.primaryTypeDisplayName?.text,
      ...(place.types ?? [])
    ].join(" ")
  );

  if (text.includes("night club") || text.includes("nightclub")) return "Nightclub";
  if (text.includes("thai")) return "Thai";
  if (text.includes("indian")) return "Indian";
  if (text.includes("japanese") || text.includes("sushi")) return "Japanese";
  if (text.includes("chinese")) return "Chinese";
  if (text.includes("italian") || text.includes("pizza")) return "Italian";
  if (text.includes("mexican")) return "Mexican";
  if (text.includes("korean")) return "Korean";
  if (text.includes("vietnamese")) return "Vietnamese";
  if (text.includes("mediterranean")) return "Mediterranean";
  if (text.includes("bakery")) return "Bakery";
  if (text.includes("cafe") || text.includes("coffee")) return "Cafe";
  if (text.includes("bar")) return "Bar";
  return "Restaurant";
}

function cuisineTagsFor(place: GooglePlace) {
  const cuisine = cuisineFor(place);
  return cuisine === "Restaurant" ? [] : [cuisine];
}

function mealTypeTagsFor(place: GooglePlace) {
  const tags = new Set<string>();
  const text = normalize(
    [
      place.displayName?.text,
      place.primaryType,
      place.primaryTypeDisplayName?.text,
      ...(place.types ?? [])
    ].join(" ")
  );

  if (place.servesBreakfast) tags.add("breakfast");
  if (place.servesBrunch) tags.add("brunch");
  if (place.servesLunch) tags.add("lunch");
  if (place.servesDinner) tags.add("dinner");
  if (place.servesDessert || text.includes("dessert")) tags.add("dessert");
  if (place.servesCoffee || text.includes("coffee") || text.includes("cafe")) tags.add("coffee");
  if (place.servesBeer || place.servesCocktails || place.servesWine || text.includes("bar")) {
    tags.add("drinks");
  }

  return [...tags];
}

function dietaryTagsFor(place: GooglePlace, request: PlanningRequest) {
  const text = normalize(
    [place.displayName?.text, place.formattedAddress, ...(place.types ?? [])].join(" ")
  );
  const tags = new Set<DietaryTag>();

  if (text.includes("vegan")) tags.add("vegan");
  if (place.servesVegetarianFood || text.includes("vegetarian") || text.includes("vegan")) {
    tags.add("vegetarian");
  }
  if (text.includes("gluten")) tags.add("gluten-free");
  if (text.includes("halal")) tags.add("halal");
  if (text.includes("kosher")) tags.add("kosher");
  if (text.includes("seafood") || text.includes("sushi")) tags.add("pescatarian");

  return [...tags];
}

function vibesFor(place: GooglePlace, request: PlanningRequest) {
  const text = normalize(
    [
      place.displayName?.text,
      place.primaryType,
      place.primaryTypeDisplayName?.text,
      ...(place.types ?? [])
    ].join(" ")
  );
  const vibes = new Set<Vibe>(["casual"]);

  for (const vibe of request.vibe) {
    vibes.add(vibe);
  }

  if (
    place.priceLevel === "PRICE_LEVEL_EXPENSIVE" ||
    place.priceLevel === "PRICE_LEVEL_VERY_EXPENSIVE"
  ) {
    vibes.add("upscale");
  }
  if (text.includes("bar") || text.includes("night") || text.includes("music")) {
    vibes.add("lively");
  }
  if (text.includes("park") || text.includes("garden") || text.includes("trail")) {
    vibes.add("outdoors");
  }
  if (text.includes("museum") || text.includes("library") || text.includes("gallery")) {
    vibes.add("quiet");
  }
  if (text.includes("family") || text.includes("park")) {
    vibes.add("kid-friendly");
  }
  if (place.goodForChildren) {
    vibes.add("kid-friendly");
  }

  return [...vibes];
}

function availabilityProbability(
  place: GooglePlace,
  groupSize: number,
  timeFit?: PlaceTimeFit
) {
  if (place.businessStatus && place.businessStatus !== "OPERATIONAL") {
    return 0.18;
  }

  const ratingBonus =
    typeof place.rating === "number" ? clamp((place.rating - 4) * 0.08, -0.08, 0.08) : 0;
  const popularityBonus =
    typeof place.userRatingCount === "number"
      ? clamp(Math.log10(Math.max(place.userRatingCount, 1)) * 0.035, 0, 0.12)
      : 0.03;
  const groupPenalty = groupSize > 8 ? 0.08 : groupSize > 5 ? 0.04 : 0;
  const hoursPenalty = timeFit?.status === "possibly_closed" ? 0.28 : 0;

  return clamp(
    0.63 + ratingBonus + popularityBonus - groupPenalty - hoursPenalty,
    0.18,
    0.92
  );
}

function availabilityLabel(probability: number) {
  if (probability >= 0.72) {
    return "available" as const;
  }

  if (probability >= 0.45) {
    return "limited" as const;
  }

  return "unavailable" as const;
}

function bookingDifficulty(place: GooglePlace, groupSize: number) {
  if (
    groupSize >= 9 ||
    place.priceLevel === "PRICE_LEVEL_EXPENSIVE" ||
    place.priceLevel === "PRICE_LEVEL_VERY_EXPENSIVE" ||
    (place.rating ?? 0) >= 4.7
  ) {
    return "hard" as const;
  }

  if (groupSize >= 6 || (place.rating ?? 0) >= 4.4) {
    return "moderate" as const;
  }

  return "easy" as const;
}

function capacityFor(place: GooglePlace, request: PlanningRequest) {
  const popularity = place.userRatingCount ?? 0;
  const base = popularity > 800 ? 20 : popularity > 250 ? 16 : 10;
  return Math.min(40, Math.max(base, request.groupProfile.numberOfPeople + 2));
}

function notesFor(place: GooglePlace, sourceLabel: string) {
  const notes = [sourceLabel];

  if (typeof place.rating === "number") {
    notes.push(
      `${place.rating.toFixed(1)} rating${
        place.userRatingCount ? ` from ${place.userRatingCount.toLocaleString()} reviews` : ""
      }`
    );
  }

  if (place.formattedAddress) {
    notes.push(place.formattedAddress);
  }

  return notes;
}

function confidenceFor(place: GooglePlace) {
  let score = 0.35;
  if (place.id) score += 0.15;
  if (place.formattedAddress) score += 0.1;
  if (place.location) score += 0.1;
  if (typeof place.rating === "number") score += 0.1;
  if (typeof place.userRatingCount === "number") score += 0.08;
  if (place.types?.length) score += 0.07;
  if (place.regularOpeningHours?.periods?.length) score += 0.05;
  return clamp(score, 0, 1);
}

function timeConfidenceFor(timeFit?: PlaceTimeFit) {
  if (!timeFit) return 0.65;
  if (timeFit.status === "open_for_window") return 1;
  if (timeFit.status === "possibly_closed") return 0.3;
  return 0.55;
}

function ratingConfidenceFor(place: GooglePlace) {
  const reviewCount = place.userRatingCount ?? 0;
  const ratingScore = typeof place.rating === "number" ? clamp((place.rating - 3.5) / 1.5, 0.2, 1) : 0.45;
  const reviewScore = clamp(Math.log10(Math.max(reviewCount, 1)) / 4, 0.15, 1);
  return clamp(ratingScore * 0.45 + reviewScore * 0.55, 0, 1);
}

function sourceCompletenessFor(place: GooglePlace) {
  let score = 0.2;
  if (place.id) score += 0.16;
  if (place.formattedAddress) score += 0.14;
  if (place.location) score += 0.14;
  if (place.googleMapsUri) score += 0.12;
  if (place.websiteUri) score += 0.08;
  if (place.nationalPhoneNumber || place.internationalPhoneNumber) score += 0.08;
  if (place.types?.length) score += 0.08;
  if (place.regularOpeningHours?.periods?.length || place.currentOpeningHours?.periods?.length) {
    score += 0.1;
  }
  return clamp(score, 0, 1);
}

function locationConfidenceFor(request: PlanningRequest, distanceMiles: number) {
  const maxDistance = request.location.maxDistanceMiles;
  if (distanceMiles <= maxDistance) return 1;
  if (distanceMiles <= maxDistance * 1.5) return 0.72;
  if (distanceMiles <= maxDistance * 3) return 0.4;
  return 0.15;
}

function evidenceWarningsFor(evidence: RecommendationEvidence) {
  const warnings: string[] = [];

  if (evidence.queryStage === "exploratory") {
    warnings.push("Exploratory result included for variety.");
  }
  if (evidence.categoryConfidence < 0.7) {
    warnings.push("Category match is less certain.");
  }
  if (evidence.locationConfidence < 0.7) {
    warnings.push("Location is outside the preferred area.");
  }
  if (evidence.timeConfidence < 0.6) {
    warnings.push("Hours need confirmation for your time.");
  }
  if (evidence.ratingConfidence < 0.45) {
    warnings.push("Limited public rating signal.");
  }

  return warnings;
}

function restaurantCategoryConfidence(place: GooglePlace, request: PlanningRequest) {
  const text = normalize(
    [
      place.displayName?.text,
      place.primaryType,
      place.primaryTypeDisplayName?.text,
      ...(place.types ?? [])
    ].join(" ")
  );
  const requestedFood = request.activityPreferences.some((preference) =>
    FOOD_ACTIVITY_PREFERENCES.has(preference)
  );

  if (text.includes("restaurant")) return 1;
  if (requestedFood && (text.includes("cafe") || text.includes("bakery") || text.includes("bar"))) {
    return 0.86;
  }
  return 0.72;
}

function activityCategoryConfidence(
  place: GooglePlace,
  request: PlanningRequest,
  preferences: ActivityPreference[]
) {
  if (request.activityPreferences.length === 0) {
    return 0.78;
  }

  const preferenceSet = new Set(preferences);
  const matches = request.activityPreferences.filter((preference) => preferenceSet.has(preference));
  if (matches.length > 0) {
    return 1;
  }

  if (place.queryStage === "exact") {
    return 0.82;
  }

  return place.queryStage === "exploratory" ? 0.48 : 0.64;
}

function buildEvidence({
  categoryConfidence,
  distanceMiles,
  place,
  request,
  timeFit
}: {
  categoryConfidence: number;
  distanceMiles: number;
  place: GooglePlace;
  request: PlanningRequest;
  timeFit?: PlaceTimeFit;
}): RecommendationEvidence {
  const evidence: RecommendationEvidence = {
    categoryConfidence: clamp(categoryConfidence),
    locationConfidence: locationConfidenceFor(request, distanceMiles),
    timeConfidence: timeConfidenceFor(timeFit),
    sourceCompleteness: sourceCompletenessFor(place),
    ratingConfidence: ratingConfidenceFor(place),
    queryStage: place.queryStage ?? "exact",
    warnings: []
  };

  return {
    ...evidence,
    warnings: evidenceWarningsFor(evidence)
  };
}

function durationFor(place: GooglePlace) {
  const types = new Set(place.types ?? []);

  if (types.has("night_club")) return 120;
  if (types.has("museum") || types.has("art_gallery")) return 90;
  if (types.has("park") || types.has("tourist_attraction")) return 75;
  if (types.has("movie_theater") || types.has("performing_arts_theater")) return 120;
  if (types.has("cafe") || types.has("bar")) return 60;
  return 75;
}

function preferencesFor(place: GooglePlace, request: PlanningRequest) {
  const types = new Set([place.primaryType, ...(place.types ?? [])].filter(Boolean));
  const text = normalize(
    [
      place.displayName?.text,
      place.primaryType,
      place.primaryTypeDisplayName?.text,
      ...(place.types ?? [])
    ].join(" ")
  );
  const preferences = new Set<ActivityPreference>();

  if (text.includes("coffee") || text.includes("cafe")) preferences.add("coffee");
  if (text.includes("bakery") || text.includes("dessert")) preferences.add("dessert");
  if (text.includes("museum")) preferences.add("museum");
  if (text.includes("gallery")) preferences.add("gallery");
  if (text.includes("art")) preferences.add("art");
  if (text.includes("history") || text.includes("historic")) preferences.add("history");
  if (text.includes("cultural")) preferences.add("cultural_site");
  if (text.includes("park")) preferences.add("park");
  if (text.includes("garden")) preferences.add("garden");
  if (text.includes("theater") || text.includes("theatre")) preferences.add("theater");
  if (text.includes("movie") || types.has("movie_theater")) preferences.add("movie");
  if (text.includes("comedy")) preferences.add("comedy");
  if (text.includes("concert")) preferences.add("concert");
  if (types.has("night_club") || text.includes("night club") || text.includes("nightclub")) {
    preferences.add("nightclub");
    preferences.add("dancing");
    preferences.add("late_night");
  } else if (types.has("bar") || text.includes("bar")) {
    preferences.add("bar");
    preferences.add("cocktails");
  }
  if (text.includes("wine bar")) preferences.add("wine_bar");
  if (text.includes("lounge")) preferences.add("lounge");
  if (text.includes("dance")) preferences.add("dancing");
  if (text.includes("live music")) preferences.add("live_music");
  if (text.includes("karaoke")) preferences.add("karaoke");
  if (text.includes("arcade") || types.has("video_arcade")) {
    preferences.add("games");
    preferences.add("arcade");
  }
  if (text.includes("bowling") || types.has("bowling_alley")) {
    preferences.add("games");
    preferences.add("bowling");
  }
  if (text.includes("escape room")) {
    preferences.add("games");
    preferences.add("escape_room");
  }
  if (text.includes("mini golf") || text.includes("miniature golf")) {
    preferences.add("games");
    preferences.add("mini_golf");
  }
  if (text.includes("pool hall") || text.includes("billiard")) {
    preferences.add("games");
    preferences.add("pool");
  }
  if (text.includes("trivia") || text.includes("game")) preferences.add("games");
  if (text.includes("yoga")) preferences.add("yoga");
  if (text.includes("hiking") || text.includes("trail")) preferences.add("hiking");
  if (text.includes("bike") || text.includes("biking")) preferences.add("biking");
  if (text.includes("pickleball")) preferences.add("pickleball");
  if (text.includes("sport")) preferences.add("sports");
  if (text.includes("shopping") || text.includes("store")) preferences.add("shopping");
  if (text.includes("book")) preferences.add("bookstore");
  if (text.includes("landmark") || text.includes("tourist")) preferences.add("sightseeing");
  if (text.includes("trail") || text.includes("walk")) preferences.add("walk");

  if (preferences.size === 0) {
    preferences.add("local_gems");
  }

  return [...preferences];
}

const RESTAURANT_OCCASION_TERMS: Partial<Record<Occasion, string[]>> = {
  brunch: ["brunch", "restaurants"],
  coffee_catchup: ["coffee", "cafes"],
  dessert_run: ["dessert", "cafes"],
  dinner: ["restaurants"],
  birthday: ["restaurants"],
  celebration: ["restaurants"],
  anniversary: ["restaurants"],
  date_night: ["restaurants"],
  team_dinner: ["restaurants"],
  client_meal: ["restaurants"]
};

const FOOD_PREFERENCE_TERMS: Partial<Record<ActivityPreference, string[]>> = {
  food_drink_general: ["restaurants", "cafes", "dessert", "bars"],
  coffee: ["coffee", "cafes"],
  dessert: ["dessert", "cafes"],
  brunch: ["brunch", "restaurants"],
  tasting_menu: ["tasting menu", "restaurants"],
  casual_dining: ["restaurants"],
  fine_dining: ["fine dining", "restaurants"],
  food_hall: ["food hall"],
  picnic: ["food", "markets"],
  bar: ["bars", "cocktail bars"],
  cocktails: ["cocktails", "bars"],
  wine_bar: ["wine bars"]
};

const ACTIVITY_PREFERENCE_TERMS: Partial<Record<ActivityPreference, string[]>> = {
  food_drink_general: ["restaurants", "cafes", "dessert", "bars"],
  arts_culture_general: [
    "museums",
    "galleries",
    "cultural attractions",
    "art exhibitions",
    "classes workshops"
  ],
  entertainment_general: [
    "entertainment venues",
    "live music",
    "theaters",
    "arcades",
    "nightlife"
  ],
  active_general: ["parks", "outdoor activities", "fitness activities", "sports"],
  games_general: [
    "arcades",
    "bowling",
    "escape rooms",
    "board game cafes",
    "mini golf"
  ],
  exploration_general: [
    "things to do",
    "tourist attractions",
    "markets",
    "bookstores",
    "walking tours"
  ],
  home_general: ["low key activities", "movie theaters", "parks", "cafes", "bookstores"],
  bar: ["bars", "cocktail bars", "pubs"],
  cocktails: ["cocktail bars", "bars"],
  wine_bar: ["wine bars"],
  nightclub: ["nightclubs", "dance clubs"],
  dancing: ["dance clubs", "nightclubs"],
  lounge: ["lounges", "hotel lounges"],
  late_night: ["nightclubs", "late night bars"],
  live_music: ["live music venues"],
  concert: ["concert venues"],
  comedy: ["comedy clubs"],
  theater: ["theaters"],
  movie: ["movie theaters"],
  karaoke: ["karaoke bars"]
};

const ACTIVITY_OCCASION_TERMS: Partial<Record<Occasion, string[]>> = {
  museum_day: ["museums"],
  gallery_day: ["galleries"],
  campus_visit: ["campus walk"],
  sightseeing: ["sightseeing"],
  date_day: ["things to do"],
  family_day: ["family activities"],
  learning_day: ["classes workshops"],
  parents_visiting: ["sightseeing"],
  night_out: ["nightlife", "bars", "nightclubs"],
  casual_hangout: ["things to do"],
  team_outing: ["group activities"],
  after_work_hangout: ["after work activities"],
  double_date: ["date activities"],
  outdoor_day: ["parks walks"],
  casual_workout: ["fitness activities"],
  wellness_day: ["wellness activities"],
  weekend_plan: ["things to do"],
  group_night: ["group activities"],
  local_discovery: ["things to do"],
  tourist_day: ["tourist attractions"],
  low_key_meetup: ["cafes parks"],
  rainy_day_plan: ["indoor activities"],
  kids_outing: ["kids activities"]
};

const CONCRETE_RESTAURANT_VIBE_TERMS: Record<Vibe, string[]> = {
  quiet: ["cafes", "tea rooms", "bookstore cafes"],
  lively: ["live music restaurants", "popular restaurants", "bars and restaurants"],
  upscale: ["fine dining restaurants", "hotel restaurants", "wine bars"],
  casual: ["cafes", "bakeries", "counter service restaurants"],
  outdoors: ["outdoor seating restaurants", "waterfront restaurants", "garden restaurants"],
  "kid-friendly": ["family restaurants", "pizza restaurants", "ice cream shops"]
};

const CONCRETE_ACTIVITY_VIBE_TERMS: Record<Vibe, string[]> = {
  quiet: ["museums", "galleries", "gardens", "bookstores"],
  lively: ["live music", "dance clubs", "arcades", "bowling"],
  upscale: ["wine bars", "galleries", "hotel lounges"],
  casual: ["cafes", "parks", "markets"],
  outdoors: ["parks", "gardens", "walks", "scenic viewpoints"],
  "kid-friendly": ["playgrounds", "family activities", "parks", "ice cream"]
};

function uniqueTerms(terms: string[]) {
  const seen = new Set<string>();

  return terms
    .map((term) => term.trim())
    .filter(Boolean)
    .filter((term) => {
      const key = normalize(term);
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function restaurantTerms(request: PlanningRequest) {
  const terms = [
    ...(request.cuisinePreferences ?? []).flatMap(
      (preference) => CUISINE_SEARCH_TERMS[preference] ?? [`${preference} restaurants`]
    ),
    ...(RESTAURANT_OCCASION_TERMS[request.occasion] ?? ["restaurants"]),
    ...request.activityPreferences.flatMap(
      (preference) => FOOD_PREFERENCE_TERMS[preference] ?? []
    )
  ];

  return uniqueTerms(terms.length > 0 ? terms : ["restaurants"]);
}

function activityTerms(request: PlanningRequest) {
  const explicitTerms = request.activityPreferences.flatMap(
    (preference) => ACTIVITY_PREFERENCE_TERMS[preference] ?? [toTitle(preference)]
  );

  return uniqueTerms([
    ...explicitTerms,
    ...(ACTIVITY_OCCASION_TERMS[request.occasion] ?? ["things to do"])
  ]);
}

function searchQueries(label: string, terms: string[]) {
  return uniqueTerms(terms).map((term) => [term, "near", label].join(" "));
}

export function restaurantSearchQueriesForRequest(request: PlanningRequest) {
  const anchors = anchorsFor(request);
  const primary = restaurantTerms(request).join(" ");
  const concreteVibeTerms = request.vibe.flatMap(
    (vibe) => CONCRETE_RESTAURANT_VIBE_TERMS[vibe]
  );

  return searchQueries(anchors.label, [
    primary,
    "restaurants",
    "places to eat",
    ...concreteVibeTerms
  ]);
}

export function activitySearchQueriesForRequest(request: PlanningRequest) {
  const anchors = anchorsFor(request);
  const primary = activityTerms(request).join(" ");
  const concreteVibeTerms = request.vibe.flatMap(
    (vibe) => CONCRETE_ACTIVITY_VIBE_TERMS[vibe]
  );

  return searchQueries(anchors.label, [
    primary,
    "things to do",
    "local attractions",
    ...concreteVibeTerms
  ]);
}

async function fetchTextSearch(apiKey: string, body: Record<string, unknown>) {
  const response = await fetch(PLACES_TEXT_SEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Google Places search failed (${response.status}): ${details.slice(0, 240)}`
    );
  }

  const data = (await response.json()) as GooglePlacesResponse;
  return data.places ?? [];
}

async function searchPlaces(
  request: PlanningRequest,
  query: string,
  restaurantOnly = false,
  radiusMiles = request.location.maxDistanceMiles
) {
  const apiKey = (await getGooglePlacesApiKey())?.trim();

  if (!apiKey) {
    throw new Error("Google Places API key is not configured.");
  }

  const anchors = anchorsFor(request);
  const body: Record<string, unknown> = {
    textQuery: query,
    pageSize: restaurantOnly ? 12 : 10,
    locationBias: {
      circle: {
        center: anchors.center,
        radius: metersFromMiles(radiusMiles)
      }
    }
  };

  if (restaurantOnly) {
    body.includedType = "restaurant";
    body.strictTypeFiltering = true;
  }

  return fetchTextSearch(apiKey, body);
}

export function dedupeGooglePlaces(places: GooglePlace[]) {
  const seen = new Set<string>();
  const unique: GooglePlace[] = [];

  for (const place of places) {
    const coordinateKey = place.location
      ? `${place.location.latitude?.toFixed(5)}:${place.location.longitude?.toFixed(5)}`
      : "no-coordinates";
    const key =
      place.id ??
      [
        normalize(place.displayName?.text ?? ""),
        normalize(place.formattedAddress ?? ""),
        coordinateKey
      ].join("|");

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(place);
    }
  }

  return unique;
}

async function searchWithExpansion(
  request: PlanningRequest,
  query: string,
  restaurantOnly = false,
  queryStage: EvidenceQueryStage = "exact"
) {
  const radii = [
    request.location.maxDistanceMiles,
    Math.min(request.location.maxDistanceMiles * 1.8, 25),
    Math.min(request.location.maxDistanceMiles * 3, 50)
  ];
  const places: GooglePlace[] = [];

  for (const radius of radii) {
    const nextPlaces = await searchPlaces(request, query, restaurantOnly, radius);
    places.push(...nextPlaces.map((place) => ({ ...place, queryStage })));

    if (dedupeGooglePlaces(places).length >= (restaurantOnly ? 10 : 8)) {
      break;
    }
  }

  return dedupeGooglePlaces(places);
}

function queryStageForIndex(index: number, totalQueries: number): EvidenceQueryStage {
  if (index === 0) return "exact";
  if (index === totalQueries - 1 && totalQueries > 3) return "exploratory";
  if (index <= 2) return "broad";
  return "expanded";
}

async function searchManyWithExpansion(
  request: PlanningRequest,
  queries: string[],
  restaurantOnly = false
) {
  const places: GooglePlace[] = [];
  const seenQueries = new Set<string>();
  let searchedQueries = 0;

  for (const query of queries) {
    const key = normalize(query);
    if (seenQueries.has(key)) {
      continue;
    }

    const queryIndex = searchedQueries;
    const queryStage = queryStageForIndex(queryIndex, queries.length);
    seenQueries.add(key);
    searchedQueries += 1;
    places.push(...(await searchWithExpansion(request, query, restaurantOnly, queryStage)));

    if (dedupeGooglePlaces(places).length >= (restaurantOnly ? 12 : 10)) {
      break;
    }
  }

  return dedupeGooglePlaces(places);
}

function mapRestaurant(place: GooglePlace, request: PlanningRequest): RestaurantOption {
  const anchors = anchorsFor(request);
  const coordinates = placeCoordinates(place, anchors.center);
  const neighborhood =
    placeLocality(place) ?? anchors.locality ?? request.location.resolvedLocation?.label ?? nearestNeighborhood(coordinates);
  const timeFit = timeFitFor(place, request);
  const probability = availabilityProbability(
    place,
    request.groupProfile.numberOfPeople,
    timeFit
  );

  const distanceFromCenterMiles = milesBetween(anchors.center, coordinates);
  const distanceFromHostMiles = milesBetween(anchors.host, coordinates);
  const evidence = buildEvidence({
    categoryConfidence: restaurantCategoryConfidence(place, request),
    distanceMiles: distanceFromCenterMiles,
    place,
    request,
    timeFit
  });

  return {
    id: optionId("google_restaurant", place),
    placeId: place.id,
    name: place.displayName?.text ?? "Unnamed restaurant",
    cuisine: cuisineFor(place),
    neighborhood,
    pricePerPerson: pricePerPersonForRestaurant(place.priceLevel),
    vibes: vibesFor(place, request),
    dietaryTags: dietaryTagsFor(place, request),
    capacity: capacityFor(place, request),
    distanceFromHostMiles,
    distanceFromCenterMiles,
    occasionFits: Array.from(new Set([request.occasion, ...CORE_OCCASIONS])),
    groupTypeFits: ALL_GROUP_TYPES,
    availabilityProbability: probability,
    mockAvailability: availabilityLabel(probability),
    bookingDifficulty: bookingDifficulty(place, request.groupProfile.numberOfPeople),
    notes: notesFor(place, "Google Places result. Availability is still estimated until booking."),
    source: "google_places",
    formattedAddress: place.formattedAddress,
    locality: componentValue(place, "locality") ?? componentValue(place, "postal_town"),
    region: componentValue(place, "administrative_area_level_1"),
    country: componentValue(place, "country"),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    distanceMeters: Math.round(distanceFromCenterMiles * 1609.344),
    googleMapsUri: place.googleMapsUri,
    websiteUri: place.websiteUri,
    nationalPhoneNumber: place.nationalPhoneNumber,
    internationalPhoneNumber: place.internationalPhoneNumber,
    reservable: place.reservable,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    googleRating: place.rating,
    googleReviewCount: place.userRatingCount,
    googlePriceLevel: place.priceLevel,
    cuisineTags: cuisineTagsFor(place),
    mealTypeTags: mealTypeTagsFor(place),
    atmosphereTags: vibesFor(place, request),
    primaryType: place.primaryType,
    placeTypes: place.types,
    timeFit,
    dataConfidenceScore: confidenceFor(place),
    evidence,
    sourceProvider: "google_places"
  };
}

function mapActivity(place: GooglePlace, request: PlanningRequest): ActivityOption {
  const anchors = anchorsFor(request);
  const coordinates = placeCoordinates(place, anchors.center);
  const neighborhood =
    placeLocality(place) ?? anchors.locality ?? request.location.resolvedLocation?.label ?? nearestNeighborhood(coordinates);
  const timeFit = timeFitFor(place, request);
  const probability = availabilityProbability(
    place,
    request.groupProfile.numberOfPeople,
    timeFit
  );

  const distanceFromCenterMiles = milesBetween(anchors.center, coordinates);
  const distanceFromHostMiles = milesBetween(anchors.host, coordinates);
  const preferences = preferencesFor(place, request);
  const evidence = buildEvidence({
    categoryConfidence: activityCategoryConfidence(place, request, preferences),
    distanceMiles: distanceFromCenterMiles,
    place,
    request,
    timeFit
  });

  return {
    id: optionId("google_activity", place),
    placeId: place.id,
    name: place.displayName?.text ?? "Unnamed activity",
    type: place.primaryTypeDisplayName?.text ?? toTitle(place.primaryType ?? "activity"),
    neighborhood,
    pricePerPerson: pricePerPersonForActivity(place),
    durationMinutes: durationFor(place),
    vibes: vibesFor(place, request),
    preferences,
    capacity: capacityFor(place, request),
    distanceFromHostMiles,
    distanceFromCenterMiles,
    occasionFits: Array.from(new Set([request.occasion, ...CORE_OCCASIONS])),
    groupTypeFits: ALL_GROUP_TYPES,
    availabilityProbability: probability,
    mockAvailability: availabilityLabel(probability),
    notes: notesFor(place, "Google Places result. Booking support is not connected yet."),
    source: "google_places",
    formattedAddress: place.formattedAddress,
    locality: componentValue(place, "locality") ?? componentValue(place, "postal_town"),
    region: componentValue(place, "administrative_area_level_1"),
    country: componentValue(place, "country"),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    distanceMeters: Math.round(distanceFromCenterMiles * 1609.344),
    googleMapsUri: place.googleMapsUri,
    websiteUri: place.websiteUri,
    nationalPhoneNumber: place.nationalPhoneNumber,
    internationalPhoneNumber: place.internationalPhoneNumber,
    reservable: place.reservable,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    googleRating: place.rating,
    googleReviewCount: place.userRatingCount,
    googlePriceLevel: place.priceLevel,
    primaryType: place.primaryType,
    placeTypes: place.types,
    timeFit,
    dataConfidenceScore: confidenceFor(place),
    evidence,
    sourceProvider: "google_places"
  };
}

export class GooglePlacesRestaurantSearchProvider implements RestaurantSearchProvider {
  name = "Google Places restaurant search";

  async searchRestaurants(request: PlanningRequest): Promise<RestaurantOption[]> {
    const places = await searchManyWithExpansion(
      request,
      restaurantSearchQueriesForRequest(request),
      true
    );

    return places.map((place) => mapRestaurant(place, request));
  }
}

export class GooglePlacesActivitySearchProvider implements ActivitySearchProvider {
  name = "Google Places activity search";

  async searchActivities(request: PlanningRequest): Promise<ActivityOption[]> {
    const places = await searchManyWithExpansion(
      request,
      activitySearchQueriesForRequest(request),
      false
    );
    const foodActivityRequested = request.activityPreferences.some((preference) =>
      FOOD_ACTIVITY_PREFERENCES.has(preference)
    );

    return places
      .filter((place) => {
        const types = new Set(place.types ?? []);
        return foodActivityRequested || !types.has("restaurant");
      })
      .map((place) => mapActivity(place, request));
  }
}

export const googlePlacesProviderBundle = {
  restaurants: new GooglePlacesRestaurantSearchProvider(),
  activities: new GooglePlacesActivitySearchProvider()
};
