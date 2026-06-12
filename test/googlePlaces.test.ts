import { describe, expect, it } from "vitest";
import {
  activitySearchQueriesForRequest,
  dedupeGooglePlaces,
  restaurantSearchQueriesForRequest,
  weekMinuteForPlanningTime
} from "@/lib/providers/googlePlacesProvider";
import { shouldAskUserToChoose } from "@/lib/services/locationResolution";
import type { LocationChoice } from "@/lib/types";
import { baseRequest } from "./fixtures";

describe("Google Places helpers", () => {
  it("deduplicates places by place id before falling back to name/address/coordinates", () => {
    const places = dedupeGooglePlaces([
      {
        id: "place_1",
        displayName: { text: "Cafe One" },
        formattedAddress: "1 Main St",
        location: { latitude: 1, longitude: 2 }
      },
      {
        id: "place_1",
        displayName: { text: "Cafe One duplicate" },
        formattedAddress: "1 Main St",
        location: { latitude: 1, longitude: 2 }
      },
      {
        displayName: { text: "Cafe Two" },
        formattedAddress: "2 Main St",
        location: { latitude: 1.000001, longitude: 2.000001 }
      },
      {
        displayName: { text: "Cafe Two" },
        formattedAddress: "2 Main St",
        location: { latitude: 1.000002, longitude: 2.000002 }
      }
    ]);

    expect(places).toHaveLength(2);
  });

  it("flags short globally ambiguous location names for user selection", () => {
    const choices: LocationChoice[] = [
      {
        query: "Paris",
        label: "Paris",
        formattedAddress: "Paris, France",
        latitude: 48.8566,
        longitude: 2.3522,
        locality: "Paris",
        country: "France",
        sourceProvider: "google_places"
      },
      {
        query: "Paris",
        label: "Paris",
        formattedAddress: "Paris, TX, USA",
        latitude: 33.6609,
        longitude: -95.5555,
        locality: "Paris",
        region: "Texas",
        country: "United States",
        sourceProvider: "google_places"
      }
    ];

    expect(shouldAskUserToChoose("Paris", choices)).toBe(true);
    expect(shouldAskUserToChoose("Paris, France", choices)).toBe(false);
  });

  it("keeps destination-local datetime-local values as local wall-clock time", () => {
    const mondayAt11 = 1 * 24 * 60 + 11 * 60;

    expect(weekMinuteForPlanningTime("2026-06-15T11:00", "Australia/Sydney")).toBe(
      mondayAt11
    );
    expect(
      weekMinuteForPlanningTime("2026-06-15T01:00:00.000Z", "Australia/Sydney")
    ).toBe(mondayAt11);
  });

  it("uses broad restaurant queries before concrete vibe expansions", () => {
    const request = {
      ...baseRequest,
      occasion: "brunch" as const,
      activityPreferences: ["brunch" as const],
      vibe: ["quiet" as const, "upscale" as const],
      location: {
        ...baseRequest.location,
        resolvedLocation: {
          query: "Vaucluse, Sydney",
          label: "Vaucluse",
          formattedAddress: "Vaucluse NSW 2030, Australia",
          latitude: -33.8586,
          longitude: 151.2786,
          locality: "Vaucluse",
          region: "New South Wales",
          country: "Australia",
          timeZone: "Australia/Sydney",
          sourceProvider: "google_places" as const
        }
      }
    };
    const queries = restaurantSearchQueriesForRequest(request);
    const joined = queries.join(" ").toLowerCase();

    expect(queries[0]).toContain("brunch restaurants near Vaucluse NSW 2030");
    expect(queries[1]).toContain("restaurants near Vaucluse NSW 2030");
    expect(joined).not.toMatch(/\bquiet\b|\bupscale\b/);
    expect(joined).toContain("fine dining restaurants");
    expect(joined).toContain("cafes");
  });

  it("adds selected cuisines to restaurant searches", () => {
    const request = {
      ...baseRequest,
      occasion: "dinner" as const,
      cuisinePreferences: ["japanese" as const, "thai" as const],
      activityPreferences: [],
      vibe: ["casual" as const],
      location: {
        ...baseRequest.location,
        resolvedLocation: {
          query: "Downtown Palo Alto",
          label: "Downtown Palo Alto",
          formattedAddress: "Downtown Palo Alto, Palo Alto, CA, USA",
          latitude: 37.4443,
          longitude: -122.1612,
          locality: "Palo Alto",
          region: "California",
          country: "United States",
          timeZone: "America/Los_Angeles",
          sourceProvider: "google_places" as const
        }
      }
    };
    const joined = restaurantSearchQueriesForRequest(request).join(" ").toLowerCase();

    expect(joined).toContain("japanese restaurants");
    expect(joined).toContain("sushi restaurants");
    expect(joined).toContain("thai restaurants");
  });

  it("turns activity vibes into concrete searches instead of vague vibe searches", () => {
    const request = {
      ...baseRequest,
      activityPreferences: ["gallery" as const],
      vibe: ["quiet" as const, "lively" as const],
      location: {
        ...baseRequest.location,
        resolvedLocation: {
          query: "Sydney CBD",
          label: "Sydney CBD",
          formattedAddress: "Sydney NSW, Australia",
          latitude: -33.8688,
          longitude: 151.2093,
          locality: "Sydney",
          region: "New South Wales",
          country: "Australia",
          timeZone: "Australia/Sydney",
          sourceProvider: "google_places" as const
        }
      }
    };
    const queries = activitySearchQueriesForRequest(request);
    const joined = queries.join(" ").toLowerCase();

    expect(queries[0]).toContain("Gallery");
    expect(queries[1]).toContain("things to do near Sydney NSW");
    expect(joined).not.toMatch(/\bquiet\b|\blively\b/);
    expect(joined).toContain("museums");
    expect(joined).toContain("live music");
  });

  it("turns general category preferences into broad activity searches", () => {
    const request = {
      ...baseRequest,
      occasion: "birthday" as const,
      activityPreferences: ["games_general" as const],
      vibe: ["casual" as const],
      location: {
        ...baseRequest.location,
        resolvedLocation: {
          query: "Downtown Palo Alto",
          label: "Downtown Palo Alto",
          formattedAddress: "Downtown Palo Alto, Palo Alto, CA, USA",
          latitude: 37.4443,
          longitude: -122.1612,
          locality: "Palo Alto",
          region: "California",
          country: "United States",
          timeZone: "America/Los_Angeles",
          sourceProvider: "google_places" as const
        }
      }
    };
    const joined = activitySearchQueriesForRequest(request).join(" ").toLowerCase();

    expect(joined).toContain("arcades");
    expect(joined).toContain("bowling");
    expect(joined).toContain("escape rooms");
    expect(joined).toContain("board game cafes");
    expect(joined).not.toContain("games general");
  });

  it("separates bar searches from nightclub searches", () => {
    const location = {
      ...baseRequest.location,
      resolvedLocation: {
        query: "Downtown Palo Alto",
        label: "Downtown Palo Alto",
        formattedAddress: "Downtown Palo Alto, Palo Alto, CA, USA",
        latitude: 37.4443,
        longitude: -122.1612,
        locality: "Palo Alto",
        region: "California",
        country: "United States",
        timeZone: "America/Los_Angeles",
        sourceProvider: "google_places" as const
      }
    };
    const barQueries = activitySearchQueriesForRequest({
      ...baseRequest,
      occasion: "night_out",
      activityPreferences: ["bar" as const],
      vibe: ["lively" as const],
      location
    }).join(" ").toLowerCase();
    const nightclubQueries = activitySearchQueriesForRequest({
      ...baseRequest,
      occasion: "night_out",
      activityPreferences: ["nightclub" as const],
      vibe: ["lively" as const],
      location
    }).join(" ").toLowerCase();

    expect(barQueries).toContain("cocktail bars");
    expect(barQueries).toContain("pubs");
    expect(nightclubQueries).toContain("nightclubs");
    expect(nightclubQueries).toContain("dance clubs");
    expect(barQueries.indexOf("cocktail bars")).toBeLessThan(
      barQueries.indexOf("nightclubs")
    );
    expect(nightclubQueries.indexOf("nightclubs")).toBeLessThan(
      nightclubQueries.indexOf("bars")
    );
  });
});
