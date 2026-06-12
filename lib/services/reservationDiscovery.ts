import type {
  PlanRecommendation,
  PlanningRequest,
  ReservationAction,
  ReservationDiscovery,
  ReservationSource,
  ReservationSourceProvider,
  ReservationSourceStatus,
  RestaurantIdentity
} from "@/lib/types";
import type { ReservationDiscoveryProvider } from "@/lib/providers/interfaces";
import {
  buildOpenTableSearchUrl,
  buildResySearchUrl
} from "@/lib/reservationLinks";
import { getReservationGuidance } from "@/lib/reservationGuidance";
import {
  googleRestaurantIdentityResolver,
  resolveRestaurantIdentity
} from "./restaurantIdentity";

const PROVIDER_LABELS: Record<ReservationSourceProvider, string> = {
  restaurant_website: "Restaurant website",
  google_places: "Google",
  opentable: "OpenTable",
  resy: "Resy",
  phone: "Phone",
  maps: "Google Maps"
};

type DiscoveredWebsiteLink = {
  url: string;
  provider: ReservationSourceProvider;
  label: string;
};

function source({
  confidence,
  provider,
  reason,
  requiresUserAction = true,
  status,
  url
}: {
  provider: ReservationSourceProvider;
  status: ReservationSourceStatus;
  reason: string;
  url?: string;
  confidence: number;
  requiresUserAction?: boolean;
}): ReservationSource {
  return {
    provider,
    label: PROVIDER_LABELS[provider],
    status,
    reason,
    url,
    confidence,
    requiresUserAction
  };
}

function providerFromUrl(url: string): ReservationSourceProvider | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();

    if (host.includes("opentable.")) {
      return "opentable";
    }

    if (host === "resy.com" || host.endsWith(".resy.com")) {
      return "resy";
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function hasReservationIntent(text: string, href: string) {
  const haystack = `${stripTags(text)} ${href}`.toLowerCase();

  return (
    /\b(reserve|reservation|reservations|book|booking|table|waitlist)\b/.test(
      haystack
    ) &&
    !/\b(menu|order|delivery|gift|careers|jobs|privacy)\b/.test(haystack)
  );
}

function absoluteUrl(baseUrl: string, href: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function findReservationLink(baseUrl: string, html: string): DiscoveredWebsiteLink | undefined {
  const anchorPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
  const candidates: DiscoveredWebsiteLink[] = [];
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const [, rawHref, label] = match;

    if (!rawHref || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
      continue;
    }

    const url = absoluteUrl(baseUrl, rawHref);

    if (!url || !hasReservationIntent(label, rawHref)) {
      continue;
    }

    candidates.push({
      url,
      provider: providerFromUrl(url) ?? "restaurant_website",
      label: stripTags(label) || "Reservation link"
    });
  }

  return candidates.sort((first, second) => {
    const firstDirect = first.provider === "restaurant_website" ? 0 : 1;
    const secondDirect = second.provider === "restaurant_website" ? 0 : 1;
    return secondDirect - firstDirect;
  })[0];
}

async function discoverWebsiteReservationLink(
  websiteUri?: string
): Promise<{
  source: ReservationSource;
  directProviderSource?: ReservationSource;
}> {
  if (!websiteUri) {
    return {
      source: source({
        provider: "restaurant_website",
        status: "not_found",
        reason: "Google did not return a restaurant website.",
        confidence: 0.25,
        requiresUserAction: false
      })
    };
  }

  const directProvider = providerFromUrl(websiteUri);

  if (directProvider) {
    return {
      source: source({
        provider: "restaurant_website",
        status: "found",
        reason: `The website field points directly to ${PROVIDER_LABELS[directProvider]}.`,
        url: websiteUri,
        confidence: 0.86
      }),
      directProviderSource: source({
        provider: directProvider,
        status: "found",
        reason: `Direct ${PROVIDER_LABELS[directProvider]} booking link found.`,
        url: websiteUri,
        confidence: 0.9
      })
    };
  }

  try {
    const parsed = new URL(websiteUri);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Unsupported website URL.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(websiteUri, {
      headers: {
        Accept: "text/html"
      },
      signal: controller.signal,
      cache: "no-store"
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Website returned ${response.status}.`);
    }

    const html = await response.text();
    const link = findReservationLink(websiteUri, html);

    if (!link) {
      return {
        source: source({
          provider: "restaurant_website",
          status: "checked",
          reason: "Website loaded, but no clear reservation link was visible.",
          url: websiteUri,
          confidence: 0.48
        })
      };
    }

    return {
      source: source({
        provider: "restaurant_website",
        status: "found",
        reason: `Found a reservation link on the restaurant website: ${link.label}.`,
        url: link.url,
        confidence: 0.82
      }),
      directProviderSource:
        link.provider === "restaurant_website"
          ? undefined
          : source({
              provider: link.provider,
              status: "found",
              reason: `Restaurant website linked to ${PROVIDER_LABELS[link.provider]}.`,
              url: link.url,
              confidence: 0.86
            })
    };
  } catch {
    return {
      source: source({
        provider: "restaurant_website",
        status: "failed",
        reason:
          "Could not safely read the restaurant website. Gatherwise did not scrape booking platforms.",
        url: websiteUri,
        confidence: 0.35
      })
    };
  }
}

function googleSource(identity: RestaurantIdentity, plan: PlanRecommendation) {
  const restaurant = plan.restaurant;
  if (!restaurant) {
    return source({
      provider: "google_places",
      status: "not_found",
      reason: "Reservation discovery only applies to restaurant plans.",
      confidence: 0.2,
      requiresUserAction: false
    });
  }

  const reservable = identity.reservable ?? restaurant.reservable;
  const googleMapsUri = identity.googleMapsUri ?? restaurant.googleMapsUri;

  if (reservable === true) {
    return source({
      provider: "google_places",
      status: "found",
      reason:
        "Google marks this restaurant as reservable. Open Maps to continue with Google's booking surface.",
      url: googleMapsUri,
      confidence: 0.76
    });
  }

  if (reservable === false) {
    return source({
      provider: "google_places",
      status: "not_found",
      reason: "Google did not mark this place as reservable.",
      url: googleMapsUri,
      confidence: 0.62,
      requiresUserAction: false
    });
  }

  return source({
    provider: "google_places",
    status: "checked",
    reason: "Google did not provide a clear reservation flag.",
    url: googleMapsUri,
    confidence: 0.52
  });
}

function providerSearchSources(
  request: PlanningRequest,
  identity: RestaurantIdentity
) {
  const start = request.timeWindow.localStart ?? request.timeWindow.start;
  const timeZone =
    request.timeWindow.timeZone ?? identity.timeZone ?? "America/Los_Angeles";
  const common = {
    partySize: request.groupProfile.numberOfPeople,
    restaurantName: identity.canonicalName,
    start,
    timeZone
  };

  return [
    source({
      provider: "opentable",
      status: "search_ready",
      reason:
        "Prepared an optional OpenTable search with the canonical restaurant name only. This does not confirm the restaurant is on OpenTable.",
      url: buildOpenTableSearchUrl(common),
      confidence: 0.38
    }),
    source({
      provider: "resy",
      status: "search_ready",
      reason:
        "Prepared an optional Resy web search with the canonical restaurant name only. This does not confirm the restaurant is on Resy.",
      url: buildResySearchUrl(common),
      confidence: 0.34
    })
  ];
}

function contactSources(identity: RestaurantIdentity) {
  const sources: ReservationSource[] = [];

  if (identity.googleMapsUri) {
    sources.push(
      source({
        provider: "maps",
        status: "found",
        reason: "Google Maps link is available for directions and manual booking checks.",
        url: identity.googleMapsUri,
        confidence: 0.65
      })
    );
  }

  if (identity.nationalPhoneNumber || identity.internationalPhoneNumber) {
    sources.push(
      source({
        provider: "phone",
        status: "found",
        reason: "Phone number is available for direct confirmation.",
        url: `tel:${identity.internationalPhoneNumber ?? identity.nationalPhoneNumber}`,
        confidence: 0.7
      })
    );
  }

  return sources;
}

function firstSource(
  sources: ReservationSource[],
  provider: ReservationSourceProvider,
  status?: ReservationSourceStatus
) {
  return sources.find(
    (candidate) =>
      candidate.provider === provider &&
      (!status || candidate.status === status) &&
      Boolean(candidate.url)
  );
}

function chooseBestAction({
  guidanceNeed,
  identity,
  sources
}: {
  guidanceNeed: ReturnType<typeof getReservationGuidance>["need"];
  identity: RestaurantIdentity;
  sources: ReservationSource[];
}): ReservationAction | undefined {
  if (guidanceNeed === "walk_in_likely") {
    const maps = firstSource(sources, "maps");
    const website = firstSource(sources, "restaurant_website");

    return {
      provider: maps?.provider ?? website?.provider ?? "maps",
      label: "No booking needed",
      detail:
        "This looks walk-in friendly. Use the link only for directions or last-minute details.",
      url: maps?.url ?? website?.url,
      requiresUserAction: true
    };
  }

  const websiteReservation = firstSource(sources, "restaurant_website", "found");
  if (websiteReservation) {
    return {
      provider: "restaurant_website",
      label: "Open reservation link",
      detail: websiteReservation.reason,
      url: websiteReservation.url,
      requiresUserAction: true
    };
  }

  const googleReservable = firstSource(sources, "google_places", "found");
  if (googleReservable) {
    return {
      provider: "google_places",
      label: "Open Google booking",
      detail: googleReservable.reason,
      url: googleReservable.url,
      requiresUserAction: true
    };
  }

  for (const provider of ["opentable", "resy"] as const) {
    const direct = firstSource(sources, provider, "found");
    if (direct) {
      return {
        provider,
        label: `Open ${PROVIDER_LABELS[provider]}`,
        detail: direct.reason,
        url: direct.url,
        requiresUserAction: true
      };
    }
  }

  const website = firstSource(sources, "restaurant_website");
  const phone = firstSource(sources, "phone");
  const maps = firstSource(sources, "maps");
  const fallback = website ?? phone ?? maps;

  if (!fallback) {
    return {
      provider: "maps",
      label: `Confirm ${identity.displayName}`,
      detail: "No direct booking source was found.",
      requiresUserAction: true
    };
  }

  return {
    provider: fallback.provider,
    label:
      fallback.provider === "phone"
        ? "Call restaurant"
        : fallback.provider === "maps"
          ? "Open Maps"
          : "Open website",
    detail: fallback.reason,
    url: fallback.url,
    requiresUserAction: true
  };
}

function discoveryStatus(
  guidanceNeed: ReturnType<typeof getReservationGuidance>["need"],
  sources: ReservationSource[]
): ReservationDiscovery["status"] {
  if (guidanceNeed === "walk_in_likely") {
    return "walk_in_likely";
  }

  if (sources.some((candidate) => candidate.availableTimes?.length)) {
    return "times_found";
  }

  if (sources.some((candidate) => candidate.provider === "google_places" && candidate.status === "found")) {
    return "google_reservable";
  }

  if (
    sources.some(
      (candidate) =>
        candidate.status === "found" &&
        ["restaurant_website", "opentable", "resy"].includes(candidate.provider)
    )
  ) {
    return "provider_link_found";
  }

  if (sources.some((candidate) => candidate.url)) {
    return "needs_user_action";
  }

  return "failed";
}

export async function discoverReservationOptions(
  request: PlanningRequest,
  plan: PlanRecommendation
): Promise<ReservationDiscovery> {
  if (!plan.restaurant) {
    throw new Error("Reservation discovery requires a restaurant plan.");
  }

  const identity = await resolveRestaurantIdentity(request, plan);
  const guidance = getReservationGuidance(plan);
  const websiteResult = await discoverWebsiteReservationLink(identity.websiteUri);
  const checkedSources = [
    websiteResult.source,
    ...(websiteResult.directProviderSource ? [websiteResult.directProviderSource] : []),
    googleSource(identity, plan)
  ];
  const directProviderHits = new Set(
    checkedSources
      .filter((candidate) => candidate.status === "found")
      .map((candidate) => candidate.provider)
  );
  const sources = [
    ...checkedSources,
    ...providerSearchSources(request, identity).filter(
      (candidate) => !directProviderHits.has(candidate.provider)
    ),
    ...contactSources(identity)
  ];
  const bestAction = chooseBestAction({
    guidanceNeed: guidance.need,
    identity,
    sources
  });
  const availableTimes = sources.flatMap((candidate) => candidate.availableTimes ?? []);
  const status = discoveryStatus(guidance.need, sources);

  return {
    status,
    restaurant: identity,
    sources,
    bestAction,
    availableTimes,
    summary: `${guidance.label}. Matched ${identity.displayName}. ${identity.matchReason} Checked the restaurant website and Google. Prepared optional OpenTable and Resy searches without treating them as confirmed booking sources. ${
      availableTimes.length > 0
        ? "Safe availability times were found."
        : "No live reservation times were confirmed safely, so Gatherwise prepared the best handoff action."
    }`
  };
}

export const safeReservationDiscoveryProvider: ReservationDiscoveryProvider = {
  name: "Safe reservation discovery",
  discover: discoverReservationOptions
};

export const defaultRestaurantIdentityResolver = googleRestaurantIdentityResolver;
