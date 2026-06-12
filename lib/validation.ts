import { z } from "zod";
import {
  ACTIVITY_PREFERENCES,
  CUISINE_PREFERENCES,
  DIETARY_TAGS,
  GROUP_TYPES,
  LOCATION_STRATEGIES,
  OCCASIONS,
  USER_PLACE_CATEGORIES,
  USER_PLACE_SOURCES,
  USER_PLACE_STATUSES,
  VIBES
} from "./types";

const isoDateTime = z
  .string()
  .min(1, "Choose a date and time")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Use a valid date/time");

const resolvedLocationSchema = z.object({
  placeId: z.string().optional(),
  query: z.string(),
  label: z.string(),
  formattedAddress: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  locality: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  timeZone: z.string().optional(),
  sourceProvider: z.enum(["google_places", "mock"])
});

export const planningRequestInputSchema = z
  .object({
    groupProfile: z.object({
      numberOfPeople: z
        .number({ invalid_type_error: "Enter the number of people" })
        .int("Use a whole number")
        .min(1, "Add at least one person")
        .max(40, "Mock booking supports up to 40 people"),
      typeOfPeople: z.enum(GROUP_TYPES)
    }),
    occasion: z.enum(OCCASIONS),
    location: z.object({
      strategy: z.enum(LOCATION_STRATEGIES),
      maxDistanceMiles: z
        .number({ invalid_type_error: "Enter a distance" })
        .min(0.5, "Use at least 0.5 miles")
        .max(50, "Use 50 miles or less"),
      hostNeighborhood: z.string().trim().optional(),
      targetNeighborhood: z.string().trim().optional(),
      attendeeSpreadMiles: z.number().min(0).max(100).optional(),
      attendeeNeighborhoods: z.array(z.string().trim()).optional(),
      resolvedLocation: resolvedLocationSchema.optional()
    }),
    timeWindow: z.object({
      start: isoDateTime,
      end: isoDateTime,
      localStart: isoDateTime.optional(),
      localEnd: isoDateTime.optional(),
      timeZone: z.string().trim().optional()
    }),
    budgetPerPerson: z
      .number({ invalid_type_error: "Enter a budget" })
      .min(15, "Budget should be at least $15/person")
      .max(500, "Budget should be $500/person or less"),
    dietaryRestrictions: z.array(z.enum(DIETARY_TAGS)).default([]),
    cuisinePreferences: z.array(z.enum(CUISINE_PREFERENCES)).default([]),
    activityPreferences: z.array(z.enum(ACTIVITY_PREFERENCES)).default([]),
    vibe: z.array(z.enum(VIBES)).min(1, "Choose at least one vibe")
  })
  .superRefine((value, context) => {
    const start = new Date(value.timeWindow.start);
    const end = new Date(value.timeWindow.end);

    if (start >= end) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timeWindow", "end"],
        message: "End time must be after start time"
      });
    }

    if (
      value.location.strategy === "target_neighborhood" &&
      !value.location.targetNeighborhood
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["location", "targetNeighborhood"],
        message: "Add a target neighborhood"
      });
    }

    if (
      value.location.strategy === "from_host" &&
      !value.location.hostNeighborhood
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["location", "hostNeighborhood"],
        message: "Add a host neighborhood"
      });
    }

    if (value.location.strategy === "between_attendees") {
      const neighborhoods = value.location.attendeeNeighborhoods ?? [];
      const validNeighborhoods = neighborhoods.filter((neighborhood) => neighborhood.trim());

      if (validNeighborhoods.length < value.groupProfile.numberOfPeople) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["location", "attendeeNeighborhoods"],
          message: "Add a neighborhood for each attendee"
        });
      }
    }
  });

export type PlanningRequestValidationInput = z.infer<
  typeof planningRequestInputSchema
>;

export function parsePlanningRequestInput(input: unknown) {
  return planningRequestInputSchema.parse(input);
}

export const userPlaceInputSchema = z.object({
  name: z.string().trim().min(1, "Add a place name").max(120),
  category: z.enum(USER_PLACE_CATEGORIES),
  status: z.enum(USER_PLACE_STATUSES),
  neighborhood: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(400).optional(),
  tags: z.array(z.string().trim().max(30)).default([]),
  source: z.enum(USER_PLACE_SOURCES),
  mapUrl: z.string().trim().url("Use a valid map URL").optional().or(z.literal("")),
  externalPlaceId: z.string().trim().optional(),
  lastVisitedAt: z.string().trim().optional()
});

export function parseUserPlaceInput(input: unknown) {
  const normalized =
    typeof input === "object" && input !== null
      ? {
          ...input,
          status:
            (input as { status?: unknown }).status === "saved"
              ? "bookmarked"
              : (input as { status?: unknown }).status === "want_to_try"
                ? "want_to_go"
                : (input as { status?: unknown }).status
        }
      : input;
  const parsed = userPlaceInputSchema.parse(normalized);
  return {
    ...parsed,
    mapUrl: parsed.mapUrl || undefined,
    neighborhood: parsed.neighborhood || undefined,
    notes: parsed.notes || undefined,
    externalPlaceId: parsed.externalPlaceId || undefined,
    lastVisitedAt: parsed.lastVisitedAt || undefined
  };
}

export function parseMapBookmarkLines(rawText: string) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [namePart, neighborhoodPart] = line.split(/\s[-–—]\s/, 2);
      return {
        name: namePart.trim(),
        neighborhood: neighborhoodPart?.trim()
      };
    })
    .filter((place) => place.name.length > 0);
}
