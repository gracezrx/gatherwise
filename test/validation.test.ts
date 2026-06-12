import { describe, expect, it } from "vitest";
import {
  parseMapBookmarkLines,
  parsePlanningRequestInput,
  planningRequestInputSchema
} from "@/lib/validation";
import { baseRequest } from "./fixtures";

const validInput = {
  groupProfile: baseRequest.groupProfile,
  occasion: baseRequest.occasion,
  location: baseRequest.location,
  timeWindow: baseRequest.timeWindow,
  budgetPerPerson: baseRequest.budgetPerPerson,
  dietaryRestrictions: baseRequest.dietaryRestrictions,
  cuisinePreferences: baseRequest.cuisinePreferences ?? [],
  activityPreferences: baseRequest.activityPreferences,
  vibe: baseRequest.vibe
};

describe("planning request validation", () => {
  it("accepts a valid planning request", () => {
    expect(() => planningRequestInputSchema.parse(validInput)).not.toThrow();
  });

  it("accepts destination-local time fields for global searches", () => {
    const parsed = planningRequestInputSchema.parse({
      ...validInput,
      timeWindow: {
        ...validInput.timeWindow,
        localStart: "2026-06-15T11:00",
        localEnd: "2026-06-15T13:00",
        timeZone: "Australia/Sydney"
      }
    });

    expect(parsed.timeWindow.localStart).toBe("2026-06-15T11:00");
    expect(parsed.timeWindow.timeZone).toBe("Australia/Sydney");
  });

  it("accepts cuisine preferences for restaurant planning", () => {
    const parsed = parsePlanningRequestInput({
      ...validInput,
      cuisinePreferences: ["japanese", "thai"]
    });

    expect(parsed.cuisinePreferences).toEqual(["japanese", "thai"]);
  });

  it("rejects invalid group size, budget, and time windows", () => {
    expect(() =>
      planningRequestInputSchema.parse({
        ...validInput,
        groupProfile: { ...validInput.groupProfile, numberOfPeople: 0 }
      })
    ).toThrow();

    expect(() =>
      planningRequestInputSchema.parse({
        ...validInput,
        budgetPerPerson: 10
      })
    ).toThrow();

    expect(() =>
      planningRequestInputSchema.parse({
        ...validInput,
        timeWindow: {
          start: "2026-06-15T04:30:00.000Z",
          end: "2026-06-15T01:30:00.000Z"
        }
      })
    ).toThrow();
  });

  it("requires a target neighborhood for target-neighborhood planning", () => {
    expect(() =>
      planningRequestInputSchema.parse({
        ...validInput,
        location: {
          strategy: "target_neighborhood",
          maxDistanceMiles: 5
        }
      })
    ).toThrow();
  });

  it("requires one neighborhood per attendee for between-attendees planning", () => {
    expect(() =>
      planningRequestInputSchema.parse({
        ...validInput,
        location: {
          strategy: "between_attendees",
          maxDistanceMiles: 5,
          attendeeNeighborhoods: ["Downtown Palo Alto"]
        }
      })
    ).toThrow();
  });
});

describe("map bookmark parsing", () => {
  it("turns pasted map lines into place names and neighborhoods", () => {
    expect(
      parseMapBookmarkLines(
        "Coupa Cafe - Downtown Palo Alto\n\nCantor Arts Center - Stanford\nBaylands"
      )
    ).toEqual([
      { name: "Coupa Cafe", neighborhood: "Downtown Palo Alto" },
      { name: "Cantor Arts Center", neighborhood: "Stanford" },
      { name: "Baylands", neighborhood: undefined }
    ]);
  });
});
