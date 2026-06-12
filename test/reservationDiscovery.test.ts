import { describe, expect, it, vi, afterEach } from "vitest";
import { buildOpenTableSearchUrl, buildResySearchUrl } from "@/lib/reservationLinks";
import { discoverReservationOptions } from "@/lib/services/reservationDiscovery";
import {
  canonicalRestaurantSearchName,
  selectClosestRestaurantCandidate
} from "@/lib/services/restaurantIdentity";
import { generatePlanRecommendations } from "@/lib/services/ranking";
import { mockActivities, mockRestaurants } from "@/lib/data/mockOptions";
import { baseRequest } from "./fixtures";
import type { ActivityPreference, PlanRecommendation } from "@/lib/types";

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

vi.mock("@/lib/store/providerConfig", () => ({
  getGooglePlacesApiKey: vi.fn(async () => undefined)
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reservation discovery", () => {
  it("searches by canonical restaurant name without guessed neighborhood text", () => {
    expect(
      canonicalRestaurantSearchName(
        "Oren's Hummus North Palo Alto",
        "North Palo Alto"
      )
    ).toBe("Oren's Hummus");
    expect(
      canonicalRestaurantSearchName("Oren's Hummus (Palo Alto)", "Palo Alto")
    ).toBe("Oren's Hummus");
    expect(canonicalRestaurantSearchName("Palo Alto Creamery", "Downtown Palo Alto")).toBe(
      "Palo Alto Creamery"
    );
  });

  it("selects the closest matching branch after a name-only search", () => {
    const selected = selectClosestRestaurantCandidate({
      canonicalName: "Oren's Hummus",
      anchor: { latitude: 37.42, longitude: -122.1 },
      candidates: [
        {
          displayName: "Oren's Hummus",
          formattedAddress: "261 University Ave, Palo Alto, CA",
          latitude: 37.445,
          longitude: -122.162,
          distanceMiles: 4.2
        },
        {
          displayName: "Oren's Hummus",
          formattedAddress: "126 Castro St, Mountain View, CA",
          latitude: 37.394,
          longitude: -122.079,
          distanceMiles: 2.1
        },
        {
          displayName: "North Palo Alto Market",
          formattedAddress: "Palo Alto, CA",
          latitude: 37.45,
          longitude: -122.14,
          distanceMiles: 1
        }
      ]
    });

    expect(selected?.formattedAddress).toContain("Mountain View");
  });

  it("builds provider searches with canonical names and the request timezone", () => {
    const openTableUrl = new URL(
      buildOpenTableSearchUrl({
        restaurantName: "Oren's Hummus",
        neighborhood: "North Palo Alto",
        partySize: 4,
        start: "2026-06-15T18:30",
        timeZone: "Australia/Sydney"
      })
    );
    const resyUrl = new URL(
      buildResySearchUrl({
        restaurantName: "Oren's Hummus",
        partySize: 4,
        start: "2026-06-15T18:30",
        timeZone: "Australia/Sydney"
      })
    );

    expect(openTableUrl.searchParams.get("term")).toBe("Oren's Hummus");
    expect(openTableUrl.searchParams.get("term")).not.toContain("North Palo Alto");
    expect(openTableUrl.searchParams.get("dateTime")).toBe("2026-06-15T18:30:00");
    expect(resyUrl.searchParams.get("q")).toBe("site:resy.com Oren's Hummus");
  });

  it("prefers a restaurant website reservation link over generic provider searches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response('<a href="/reservations">Reserve a table</a>', {
          status: 200,
          headers: { "Content-Type": "text/html" }
        })
      )
    );
    const plan = requireRestaurantPlan(generatePlanRecommendations(
      restaurantRequest,
      mockRestaurants,
      mockActivities
    )[0]);
    const websitePlan = {
      ...plan,
      restaurant: {
        ...plan.restaurant,
        source: "google_places" as const,
        name: "Test Bistro North Palo Alto",
        neighborhood: "North Palo Alto",
        websiteUri: "https://test-bistro.example"
      }
    };

    const discovery = await discoverReservationOptions(baseRequest, websitePlan);

    expect(discovery.bestAction?.provider).toBe("restaurant_website");
    expect(discovery.bestAction?.url).toBe("https://test-bistro.example/reservations");
    expect(discovery.sources.find((source) => source.provider === "opentable")?.url).toContain(
      "term=Test+Bistro"
    );
  });

  it("does not choose generic OpenTable or Resy searches as the primary handoff", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response('<a href="/menu">Menu</a><a href="/contact">Contact</a>', {
          status: 200,
          headers: { "Content-Type": "text/html" }
        })
      )
    );
    const plan = requireRestaurantPlan(generatePlanRecommendations(
      restaurantRequest,
      mockRestaurants,
      mockActivities
    )[0]);
    const websitePlan = {
      ...plan,
      restaurant: {
        ...plan.restaurant,
        source: "google_places" as const,
        name: "Oren's Hummus North Palo Alto",
        neighborhood: "North Palo Alto",
        websiteUri: "https://orens.example",
        googleMapsUri: "https://maps.google.com/?cid=orens",
        reservable: undefined
      }
    };

    const discovery = await discoverReservationOptions(baseRequest, websitePlan);

    expect(discovery.sources.find((source) => source.provider === "opentable")?.status).toBe(
      "search_ready"
    );
    expect(discovery.sources.find((source) => source.provider === "resy")?.status).toBe(
      "search_ready"
    );
    expect(discovery.bestAction?.provider).not.toBe("opentable");
    expect(discovery.bestAction?.provider).not.toBe("resy");
    expect(discovery.bestAction?.url).toBe("https://orens.example");
  });

  it("labels walk-in spots as no booking needed", async () => {
    const plan = requireRestaurantPlan(generatePlanRecommendations(
      restaurantRequest,
      mockRestaurants,
      mockActivities
    )[0]);
    const dessertPlan = {
      ...plan,
      restaurant: {
        ...plan.restaurant,
        source: "google_places" as const,
        name: "Tong Sui Desserts & Drinks",
        cuisine: "Dessert",
        primaryType: "dessert_shop",
        placeTypes: ["dessert_shop", "cafe"],
        reservable: false,
        websiteUri: undefined
      }
    };

    const discovery = await discoverReservationOptions(baseRequest, dessertPlan);

    expect(discovery.status).toBe("walk_in_likely");
    expect(discovery.bestAction?.label).toBe("No booking needed");
    expect(discovery.summary).toContain("No booking needed");
  });
});
