import { getGooglePlacesApiKey } from "@/lib/store/providerConfig";
import type {
  PlanRecommendation,
  PlanningRequest,
  RestaurantIdentity
} from "@/lib/types";
import { clamp } from "@/lib/utils";
import type { RestaurantIdentityResolver } from "@/lib/providers/interfaces";

const PLACES_TEXT_SEARCH_ENDPOINT =
  "https://places.googleapis.com/v1/places:searchText";

const IDENTITY_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.reservable",
  "places.types",
  "places.primaryType"
].join(",");

type Coordinates = {
  latitude: number;
  longitude: number;
};

type NamedCoordinates = Coordinates & {
  name: string;
};

type GoogleIdentityPlace = {
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
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  reservable?: boolean;
};

type GoogleIdentityResponse = {
  places?: GoogleIdentityPlace[];
};

export type RestaurantIdentityCandidate = Omit<
  RestaurantIdentity,
  "canonicalName" | "matchConfidence" | "matchReason" | "sourceProvider"
> & {
  sourceProvider?: RestaurantIdentity["sourceProvider"];
};

const KNOWN_LOCATION_COORDINATES = [
  { name: "Downtown Palo Alto", latitude: 37.4443, longitude: -122.1612 },
  { name: "North Palo Alto", latitude: 37.4539, longitude: -122.1466 },
  { name: "Palo Alto", latitude: 37.4419, longitude: -122.143 },
  { name: "Menlo Park", latitude: 37.4529, longitude: -122.1817 },
  { name: "Mountain View", latitude: 37.3861, longitude: -122.0839 },
  { name: "Sydney", latitude: -33.8688, longitude: 151.2093 }
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTrailingLocation(value: string, location?: string) {
  if (!location?.trim()) {
    return value;
  }

  return value
    .replace(
      new RegExp(`(?:\\s*[-,|]\\s*|\\s+)${escapeRegExp(location.trim())}$`, "i"),
      ""
    )
    .trim();
}

function looksLikeLocationQualifier(value: string) {
  const normalized = normalize(value);

  return (
    /\b(north|south|east|west|downtown|midtown|central|near|city|district)\b/.test(
      normalized
    ) ||
    /\b(palo alto|mountain view|menlo park|stanford|california|ca|sydney|nsw|australia|usa)\b/.test(
      normalized
    ) ||
    /\d/.test(normalized)
  );
}

export function canonicalRestaurantSearchName(
  name: string,
  neighborhood?: string,
  formattedAddress?: string
) {
  let value = name.replace(/\s+/g, " ").trim();
  const parenMatch = /\s*\(([^)]*)\)\s*$/.exec(value);

  if (parenMatch && looksLikeLocationQualifier(parenMatch[1])) {
    value = value.slice(0, parenMatch.index).trim();
  }

  value = value
    .replace(/\s+(?:near|at)\s+.+$/i, "")
    .replace(/\s*[-|]\s*(?:location|restaurant)\s*$/i, "")
    .trim();

  const possibleLocations = [
    neighborhood,
    formattedAddress?.split(",")[0],
    formattedAddress?.split(",")[1]
  ].filter(Boolean) as string[];

  for (const location of possibleLocations) {
    value = stripTrailingLocation(value, location);
  }

  return value || name.trim();
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

function knownCoordinates(label?: string): NamedCoordinates | undefined {
  if (!label) {
    return undefined;
  }

  const wanted = normalize(label);
  return KNOWN_LOCATION_COORDINATES.find((candidate) => {
    const candidateName = normalize(candidate.name);
    return candidateName === wanted || wanted.includes(candidateName);
  });
}

function anchorFor(request: PlanningRequest, plan: PlanRecommendation) {
  const resolved = request.location.resolvedLocation;
  const restaurant = plan.restaurant;

  if (resolved) {
    return {
      center: {
        latitude: resolved.latitude,
        longitude: resolved.longitude
      },
      label: resolved.formattedAddress || resolved.label,
      timeZone: resolved.timeZone ?? request.timeWindow.timeZone
    };
  }

  if (
    restaurant &&
    typeof restaurant.latitude === "number" &&
    typeof restaurant.longitude === "number"
  ) {
    return {
      center: {
        latitude: restaurant.latitude,
        longitude: restaurant.longitude
      },
      label: restaurant.formattedAddress ?? restaurant.neighborhood,
      timeZone: request.timeWindow.timeZone
    };
  }

  const fallback =
    knownCoordinates(request.location.targetNeighborhood) ??
    knownCoordinates(request.location.hostNeighborhood) ??
    KNOWN_LOCATION_COORDINATES[2];

  return {
    center: {
      latitude: fallback.latitude,
      longitude: fallback.longitude
    },
    label: fallback.name,
    timeZone: request.timeWindow.timeZone ?? "America/Los_Angeles"
  };
}

function componentValue(place: GoogleIdentityPlace, wantedType: string) {
  return place.addressComponents?.find((component) =>
    component.types?.includes(wantedType)
  )?.longText;
}

function placeLocality(place: GoogleIdentityPlace) {
  return (
    componentValue(place, "neighborhood") ??
    componentValue(place, "sublocality") ??
    componentValue(place, "locality") ??
    componentValue(place, "postal_town")
  );
}

function regionFor(place: GoogleIdentityPlace) {
  return componentValue(place, "administrative_area_level_1");
}

function countryFor(place: GoogleIdentityPlace) {
  return componentValue(place, "country");
}

function identityFromPlan(
  request: PlanningRequest,
  plan: PlanRecommendation,
  canonicalName: string
): RestaurantIdentity {
  const restaurant = plan.restaurant;
  if (!restaurant) {
    throw new Error("Restaurant identity requires a restaurant plan.");
  }

  const anchor = anchorFor(request, plan);
  const distanceMiles =
    typeof restaurant.latitude === "number" &&
    typeof restaurant.longitude === "number"
      ? milesBetween(anchor.center, {
          latitude: restaurant.latitude,
          longitude: restaurant.longitude
        })
      : restaurant.distanceFromCenterMiles;

  return {
    canonicalName,
    displayName: restaurant.name,
    placeId: restaurant.placeId,
    formattedAddress: restaurant.formattedAddress,
    neighborhood: restaurant.neighborhood,
    locality: restaurant.locality,
    region: restaurant.region,
    country: restaurant.country,
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
    distanceMiles,
    timeZone: request.timeWindow.timeZone ?? anchor.timeZone,
    websiteUri: restaurant.websiteUri,
    googleMapsUri: restaurant.googleMapsUri,
    nationalPhoneNumber: restaurant.nationalPhoneNumber,
    internationalPhoneNumber: restaurant.internationalPhoneNumber,
    reservable: restaurant.reservable,
    matchConfidence: restaurant.placeId ? 0.72 : 0.55,
    matchReason:
      "Using the restaurant details already attached to the selected plan.",
    sourceProvider:
      restaurant.source === "google_places" ? "google_places" : "plan_data"
  };
}

function candidateFromGooglePlace(
  place: GoogleIdentityPlace,
  anchor: ReturnType<typeof anchorFor>
): RestaurantIdentityCandidate | undefined {
  const displayName = place.displayName?.text?.trim();

  if (!displayName) {
    return undefined;
  }

  const distanceMiles = place.location
    ? milesBetween(anchor.center, place.location)
    : undefined;

  return {
    displayName,
    placeId: place.id,
    formattedAddress: place.formattedAddress,
    neighborhood: placeLocality(place),
    locality: placeLocality(place),
    region: regionFor(place),
    country: countryFor(place),
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
    distanceMiles,
    timeZone: anchor.timeZone,
    websiteUri: place.websiteUri,
    googleMapsUri: place.googleMapsUri,
    nationalPhoneNumber: place.nationalPhoneNumber,
    internationalPhoneNumber: place.internationalPhoneNumber,
    reservable: place.reservable,
    sourceProvider: "google_places"
  };
}

function nameMatchScore(canonicalName: string, candidateName: string) {
  const canonical = normalize(canonicalName);
  const candidate = normalize(candidateName);

  if (!canonical || !candidate) {
    return 0;
  }

  if (candidate === canonical) {
    return 1;
  }

  if (candidate.includes(canonical) || canonical.includes(candidate)) {
    return 0.9;
  }

  const canonicalWords = canonical.split(" ").filter((word) => word.length > 1);
  const candidateWords = new Set(
    candidate.split(" ").filter((word) => word.length > 1)
  );
  const overlap = canonicalWords.filter((word) => candidateWords.has(word)).length;

  return canonicalWords.length === 0 ? 0 : overlap / canonicalWords.length;
}

export function selectClosestRestaurantCandidate({
  anchor,
  canonicalName,
  candidates
}: {
  anchor: Coordinates;
  canonicalName: string;
  candidates: RestaurantIdentityCandidate[];
}): RestaurantIdentityCandidate | undefined {
  const matches = candidates
    .map((candidate) => {
      const matchScore = nameMatchScore(canonicalName, candidate.displayName);
      const distanceMiles =
        candidate.distanceMiles ??
        (typeof candidate.latitude === "number" &&
        typeof candidate.longitude === "number"
          ? milesBetween(anchor, {
              latitude: candidate.latitude,
              longitude: candidate.longitude
            })
          : Number.POSITIVE_INFINITY);

      return { candidate, matchScore, distanceMiles };
    })
    .filter((entry) => entry.matchScore >= 0.5)
    .sort((first, second) => {
      const distanceDelta = first.distanceMiles - second.distanceMiles;

      if (Math.abs(distanceDelta) > 0.15) {
        return distanceDelta;
      }

      return second.matchScore - first.matchScore;
    });

  return matches[0]?.candidate;
}

async function searchGoogleCandidates(
  apiKey: string,
  request: PlanningRequest,
  plan: PlanRecommendation,
  canonicalName: string
) {
  const anchor = anchorFor(request, plan);
  const radiusMiles = clamp(
    Math.max(request.location.maxDistanceMiles * 4, 10),
    3,
    35
  );
  const response = await fetch(PLACES_TEXT_SEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": IDENTITY_FIELD_MASK
    },
    body: JSON.stringify({
      textQuery: canonicalName,
      pageSize: 20,
      includedType: "restaurant",
      strictTypeFiltering: true,
      locationBias: {
        circle: {
          center: anchor.center,
          radius: Math.round(radiusMiles * 1609.344)
        }
      }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as GoogleIdentityResponse;
  return (data.places ?? [])
    .map((place) => candidateFromGooglePlace(place, anchor))
    .filter(Boolean) as RestaurantIdentityCandidate[];
}

export async function resolveRestaurantIdentity(
  request: PlanningRequest,
  plan: PlanRecommendation
): Promise<RestaurantIdentity> {
  const restaurant = plan.restaurant;
  if (!restaurant) {
    throw new Error("Restaurant identity requires a restaurant plan.");
  }

  const canonicalName = canonicalRestaurantSearchName(
    restaurant.name,
    restaurant.neighborhood,
    restaurant.formattedAddress
  );
  const fallback = identityFromPlan(request, plan, canonicalName);
  const apiKey = (await getGooglePlacesApiKey())?.trim();

  if (!apiKey) {
    return fallback;
  }

  try {
    const anchor = anchorFor(request, plan);
    const candidates = await searchGoogleCandidates(apiKey, request, plan, canonicalName);
    const selected = selectClosestRestaurantCandidate({
      anchor: anchor.center,
      canonicalName,
      candidates
    });

    if (!selected) {
      return fallback;
    }

    const distanceMiles =
      selected.distanceMiles ??
      (typeof selected.latitude === "number" && typeof selected.longitude === "number"
        ? milesBetween(anchor.center, {
            latitude: selected.latitude,
            longitude: selected.longitude
          })
        : undefined);

    return {
      ...selected,
      canonicalName,
      distanceMiles,
      timeZone: request.timeWindow.timeZone ?? selected.timeZone ?? anchor.timeZone,
      matchConfidence: clamp(
        0.72 + nameMatchScore(canonicalName, selected.displayName) * 0.18,
        0,
        0.95
      ),
      matchReason: `${selected.displayName} matched the name-only search "${canonicalName}" and was the closest matching branch to ${anchor.label}.`,
      sourceProvider: "google_places"
    };
  } catch {
    return fallback;
  }
}

export const googleRestaurantIdentityResolver: RestaurantIdentityResolver = {
  name: "Google Places restaurant identity resolver",
  resolve: resolveRestaurantIdentity
};
