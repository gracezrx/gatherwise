import type { PlanningRequest } from "@/lib/types";

export const baseRequest: PlanningRequest = {
  id: "request_test",
  createdAt: "2026-06-10T12:00:00.000Z",
  mockMode: true,
  groupProfile: {
    numberOfPeople: 6,
    typeOfPeople: "friends"
  },
  occasion: "birthday",
  location: {
    strategy: "target_neighborhood",
    maxDistanceMiles: 2.5,
    hostNeighborhood: "Downtown Palo Alto",
    targetNeighborhood: "Downtown Palo Alto",
    attendeeSpreadMiles: 4,
    attendeeNeighborhoods: [
      "Downtown Palo Alto",
      "California Ave",
      "Stanford",
      "Professorville",
      "Old Palo Alto",
      "Town & Country"
    ]
  },
  timeWindow: {
    start: "2026-06-15T01:30:00.000Z",
    end: "2026-06-15T04:30:00.000Z"
  },
  budgetPerPerson: 70,
  dietaryRestrictions: ["vegetarian", "gluten-free"],
  activityPreferences: ["games", "dessert"],
  vibe: ["lively", "casual"]
};
