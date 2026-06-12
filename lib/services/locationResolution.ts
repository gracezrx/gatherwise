import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getGooglePlacesApiKey } from "@/lib/store/providerConfig";
import type {
  LocationChoice,
  PlanningRequest,
  ResolvedLocation
} from "@/lib/types";

const TEXT_SEARCH_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.addressComponents",
  "places.types",
  "places.timeZone"
].join(",");
const CACHE_DIR = path.join(process.cwd(), "work");
const CACHE_FILE = path.join(CACHE_DIR, "google-location-cache.json");

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GoogleLocationPlace = {
  id?: string;
  displayName?: {
    text?: string;
  };
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  addressComponents?: GoogleAddressComponent[];
  timeZone?: string | { id?: string };
};

type LocationCache = Record<string, LocationChoice[]>;

export class AmbiguousLocationError extends Error {
  constructor(
    message: string,
    public choices: LocationChoice[]
  ) {
    super(message);
    this.name = "AmbiguousLocationError";
  }
}

export class LocationResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocationResolutionError";
  }
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cacheKey(query: string) {
  return normalize(query);
}

async function readCache(): Promise<LocationCache> {
  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    return JSON.parse(raw) as LocationCache;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {};
    }

    throw error;
  }
}

async function writeCache(cache: LocationCache) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

function componentValue(place: GoogleLocationPlace, wantedType: string) {
  return place.addressComponents?.find((component) =>
    component.types?.includes(wantedType)
  )?.longText;
}

function timezoneId(timeZone?: GoogleLocationPlace["timeZone"]) {
  if (!timeZone) {
    return undefined;
  }

  return typeof timeZone === "string" ? timeZone : timeZone.id;
}

function toChoice(query: string, place: GoogleLocationPlace): LocationChoice | undefined {
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;

  if (latitude === undefined || longitude === undefined) {
    return undefined;
  }

  return {
    placeId: place.id,
    query,
    label: place.displayName?.text ?? place.formattedAddress ?? query,
    formattedAddress: place.formattedAddress ?? place.displayName?.text ?? query,
    latitude,
    longitude,
    locality:
      componentValue(place, "locality") ??
      componentValue(place, "postal_town") ??
      componentValue(place, "administrative_area_level_3"),
    region: componentValue(place, "administrative_area_level_1"),
    country: componentValue(place, "country"),
    timeZone: timezoneId(place.timeZone),
    sourceProvider: "google_places"
  };
}

export function shouldAskUserToChoose(query: string, choices: LocationChoice[]) {
  if (choices.length <= 1) {
    return false;
  }

  const words = normalize(query).split(/\s+/).filter(Boolean);
  const hasSpecificAddressSignal = /\d/.test(query) || query.includes(",");
  const countries = new Set(choices.map((choice) => choice.country).filter(Boolean));
  const regions = new Set(choices.map((choice) => choice.region).filter(Boolean));
  const localities = new Set(choices.map((choice) => choice.locality).filter(Boolean));

  return (
    !hasSpecificAddressSignal &&
    words.length <= 2 &&
    (countries.size > 1 || regions.size > 1 || localities.size > 1)
  );
}

async function fetchLocationChoices(query: string) {
  const apiKey = (await getGooglePlacesApiKey())?.trim();

  if (!apiKey) {
    return [];
  }

  const cache = await readCache();
  const key = cacheKey(query);

  if (cache[key]?.length) {
    return cache[key];
  }

  const response = await fetch(TEXT_SEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 5
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const details = await response.text();
    throw new LocationResolutionError(
      `Unable to resolve location with Google Places (${response.status}): ${details.slice(
        0,
        180
      )}`
    );
  }

  const data = (await response.json()) as { places?: GoogleLocationPlace[] };
  const choices = (data.places ?? [])
    .map((place) => toChoice(query, place))
    .filter((choice): choice is LocationChoice => choice !== undefined);

  cache[key] = choices;
  await writeCache(cache);
  return choices;
}

function locationQueryForRequest(request: PlanningRequest) {
  if (request.location.strategy === "from_host") {
    return request.location.hostNeighborhood?.trim();
  }

  if (request.location.strategy === "between_attendees") {
    return undefined;
  }

  return request.location.targetNeighborhood?.trim();
}

function averageLocation(query: string, choices: ResolvedLocation[]): ResolvedLocation {
  const latitude =
    choices.reduce((total, choice) => total + choice.latitude, 0) / choices.length;
  const longitude =
    choices.reduce((total, choice) => total + choice.longitude, 0) / choices.length;
  const countries = [...new Set(choices.map((choice) => choice.country).filter(Boolean))];
  const regions = [...new Set(choices.map((choice) => choice.region).filter(Boolean))];
  const timeZones = [...new Set(choices.map((choice) => choice.timeZone).filter(Boolean))];

  return {
    query,
    label: "Group midpoint",
    formattedAddress: choices.map((choice) => choice.label).join(" / "),
    latitude,
    longitude,
    region: regions.length === 1 ? regions[0] : undefined,
    country: countries.length === 1 ? countries[0] : undefined,
    timeZone: timeZones.length === 1 ? timeZones[0] : undefined,
    sourceProvider: "google_places"
  };
}

function attachResolvedLocation(
  request: PlanningRequest,
  resolvedLocation: ResolvedLocation
): PlanningRequest {
  return {
    ...request,
    location: {
      ...request.location,
      resolvedLocation
    },
    timeWindow: {
      ...request.timeWindow,
      timeZone: resolvedLocation.timeZone ?? request.timeWindow.timeZone
    }
  };
}

async function resolveSingleLocation(query: string): Promise<ResolvedLocation> {
  const choices = await fetchLocationChoices(query);

  if (choices.length === 0) {
    throw new LocationResolutionError(
      `I could not resolve "${query}". Try a more specific city, neighborhood, address, or landmark.`
    );
  }

  if (shouldAskUserToChoose(query, choices)) {
    throw new AmbiguousLocationError(
      `Choose which "${query}" you mean.`,
      choices.slice(0, 4)
    );
  }

  return choices[0];
}

export async function resolvePlanningRequestLocation(
  request: PlanningRequest
): Promise<PlanningRequest> {
  if (request.location.resolvedLocation) {
    return attachResolvedLocation(request, request.location.resolvedLocation);
  }

  const apiKey = (await getGooglePlacesApiKey())?.trim();

  if (!apiKey) {
    return request;
  }

  if (request.location.strategy === "between_attendees") {
    const attendeeQueries = (request.location.attendeeNeighborhoods ?? [])
      .map((location) => location.trim())
      .filter(Boolean);
    const resolvedAttendees = await Promise.all(
      attendeeQueries.map((query) => resolveSingleLocation(query))
    );

    if (resolvedAttendees.length === 0) {
      return request;
    }

    return attachResolvedLocation(
      request,
      averageLocation(
        attendeeQueries.join(" / "),
        resolvedAttendees
      )
    );
  }

  const query = locationQueryForRequest(request);

  if (!query) {
    return request;
  }

  return attachResolvedLocation(request, await resolveSingleLocation(query));
}
