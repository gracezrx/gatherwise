export const GROUP_TYPES = [
  "friends",
  "coworkers",
  "family",
  "date",
  "clients",
  "mixed group"
] as const;

export type ActivityCategory =
  | "food_drink"
  | "arts_culture_learning"
  | "entertainment_nightlife"
  | "active_outdoors"
  | "games_interactive"
  | "exploration_shopping"
  | "home_low_key";

export type OccasionTag =
  | "dinner"
  | "brunch"
  | "coffee_catchup"
  | "dessert_run"
  | "birthday"
  | "celebration"
  | "anniversary"
  | "date_night"
  | "team_dinner"
  | "client_meal"
  | "museum_day"
  | "gallery_day"
  | "campus_visit"
  | "sightseeing"
  | "date_day"
  | "family_day"
  | "learning_day"
  | "parents_visiting"
  | "night_out"
  | "casual_hangout"
  | "team_outing"
  | "after_work_hangout"
  | "double_date"
  | "outdoor_day"
  | "casual_workout"
  | "wellness_day"
  | "weekend_plan"
  | "group_night"
  | "local_discovery"
  | "tourist_day"
  | "low_key_meetup"
  | "rainy_day_plan"
  | "kids_outing";

export const LOCATION_STRATEGIES = [
  "between_attendees",
  "from_host",
  "target_neighborhood"
] as const;

export const VIBES = [
  "quiet",
  "lively",
  "upscale",
  "casual",
  "outdoors",
  "kid-friendly"
] as const;

export const DIETARY_TAGS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "nut-free",
  "halal",
  "kosher",
  "pescatarian"
] as const;

export const CUISINE_PREFERENCES = [
  "american",
  "italian",
  "japanese",
  "chinese",
  "korean",
  "thai",
  "mexican",
  "mediterranean",
  "indian",
  "french",
  "seafood",
  "vegetarian",
  "bbq",
  "pizza",
  "cafe",
  "dessert"
] as const;

export type ActivityPreferenceTag =
  | "food_drink_general"
  | "coffee"
  | "dessert"
  | "brunch"
  | "tasting_menu"
  | "casual_dining"
  | "fine_dining"
  | "food_hall"
  | "picnic"
  | "bar"
  | "cocktails"
  | "wine_bar"
  | "arts_culture_general"
  | "art"
  | "museum"
  | "gallery"
  | "history"
  | "architecture"
  | "cultural_site"
  | "public_art"
  | "campus_walk"
  | "class"
  | "workshop"
  | "entertainment_general"
  | "live_music"
  | "concert"
  | "comedy"
  | "theater"
  | "movie"
  | "karaoke"
  | "nightclub"
  | "dancing"
  | "lounge"
  | "late_night"
  | "active_general"
  | "walk"
  | "hiking"
  | "biking"
  | "yoga"
  | "pickleball"
  | "sports"
  | "park"
  | "garden"
  | "beach"
  | "scenic_view"
  | "games_general"
  | "games"
  | "board_games"
  | "arcade"
  | "bowling"
  | "trivia"
  | "mini_golf"
  | "escape_room"
  | "pool"
  | "ping_pong"
  | "exploration_general"
  | "sightseeing"
  | "landmarks"
  | "walking_tour"
  | "neighborhood_exploring"
  | "local_gems"
  | "shopping"
  | "bookstore"
  | "farmers_market"
  | "vintage"
  | "home_general"
  | "low_key"
  | "quiet"
  | "cozy"
  | "private"
  | "home_dinner"
  | "takeout"
  | "potluck"
  | "movie_night"
  | "backyard";

export type ActivityCategoryConfig = {
  label: string;
  description: string;
  occasions: OccasionTag[];
  preferences: ActivityPreferenceTag[];
};

export const OCCASIONS = [
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
] as const satisfies readonly OccasionTag[];

export const ACTIVITY_PREFERENCES = [
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
  "wine_bar",
  "arts_culture_general",
  "art",
  "museum",
  "gallery",
  "history",
  "architecture",
  "cultural_site",
  "public_art",
  "campus_walk",
  "class",
  "workshop",
  "entertainment_general",
  "live_music",
  "concert",
  "comedy",
  "theater",
  "movie",
  "karaoke",
  "nightclub",
  "dancing",
  "lounge",
  "late_night",
  "active_general",
  "walk",
  "hiking",
  "biking",
  "yoga",
  "pickleball",
  "sports",
  "park",
  "garden",
  "beach",
  "scenic_view",
  "games_general",
  "games",
  "board_games",
  "arcade",
  "bowling",
  "trivia",
  "mini_golf",
  "escape_room",
  "pool",
  "ping_pong",
  "exploration_general",
  "sightseeing",
  "landmarks",
  "walking_tour",
  "neighborhood_exploring",
  "local_gems",
  "shopping",
  "bookstore",
  "farmers_market",
  "vintage",
  "home_general",
  "low_key",
  "quiet",
  "cozy",
  "private",
  "home_dinner",
  "takeout",
  "potluck",
  "movie_night",
  "backyard"
] as const satisfies readonly ActivityPreferenceTag[];

export const BOOKING_STATES = [
  "pending_review",
  "approved",
  "checking_availability",
  "booking_attempted",
  "booked",
  "unavailable",
  "failed",
  "needs_user_action"
] as const;

export const USER_PLACE_STATUSES = [
  "visited",
  "bookmarked",
  "rejected",
  "approved",
  "want_to_go"
] as const;

export const USER_PLACE_CATEGORIES = [
  "restaurant",
    "activity",
    "sight",
    "bar",
    "nightclub",
    "cafe",
  "other"
] as const;

export const USER_PLACE_SOURCES = [
  "manual",
  "google_maps_bookmark",
  "past_booking"
] as const;

export type GroupType = (typeof GROUP_TYPES)[number];
export type Occasion = OccasionTag;
export type LocationStrategy = (typeof LOCATION_STRATEGIES)[number];
export type Vibe = (typeof VIBES)[number];
export type DietaryTag = (typeof DIETARY_TAGS)[number];
export type CuisinePreference = (typeof CUISINE_PREFERENCES)[number];
export type ActivityPreference = ActivityPreferenceTag;
export type BookingState = (typeof BOOKING_STATES)[number];
export type UserPlaceStatus = (typeof USER_PLACE_STATUSES)[number];
export type UserPlaceCategory = (typeof USER_PLACE_CATEGORIES)[number];
export type UserPlaceSource = (typeof USER_PLACE_SOURCES)[number];

export const ACTIVITY_CATEGORIES: Record<ActivityCategory, ActivityCategoryConfig> = {
  food_drink: {
    label: "Food & Drink",
    description:
      "Restaurants, coffee, dessert, brunch, drinks, tastings, food halls, picnics, and other food-centered plans.",
    occasions: [
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
    ],
    preferences: [
      "food_drink_general",
      "coffee",
      "dessert",
      "brunch",
      "tasting_menu",
      "casual_dining",
      "fine_dining",
      "food_hall",
      "picnic",
      "cocktails",
      "wine_bar"
    ]
  },
  arts_culture_learning: {
    label: "Arts, Culture & Learning",
    description:
      "Museums, galleries, exhibitions, public art, architecture, cultural sites, classes, workshops, and educational experiences.",
    occasions: [
      "museum_day",
      "gallery_day",
      "campus_visit",
      "sightseeing",
      "date_day",
      "family_day",
      "learning_day",
      "parents_visiting"
    ],
    preferences: [
      "arts_culture_general",
      "art",
      "museum",
      "gallery",
      "history",
      "architecture",
      "cultural_site",
      "public_art",
      "campus_walk",
      "class",
      "workshop"
    ]
  },
  entertainment_nightlife: {
    label: "Entertainment & Nightlife",
    description:
      "Live music, comedy, theater, movies, bars, lounges, dancing, karaoke, late-night plans, and high-energy evening activities.",
    occasions: [
      "date_night",
      "birthday",
      "celebration",
      "anniversary",
      "night_out",
      "casual_hangout",
      "team_outing",
      "after_work_hangout",
      "double_date"
    ],
    preferences: [
      "entertainment_general",
      "live_music",
      "concert",
      "comedy",
      "theater",
      "movie",
      "karaoke",
      "nightclub",
      "dancing",
      "bar",
      "cocktails",
      "lounge",
      "late_night"
    ]
  },
  active_outdoors: {
    label: "Active & Outdoors",
    description:
      "Movement-based plans, parks, hikes, beaches, sports, gardens, scenic walks, outdoor activities, and wellness-oriented outings.",
    occasions: [
      "outdoor_day",
      "casual_workout",
      "wellness_day",
      "family_day",
      "date_day",
      "casual_hangout",
      "team_outing",
      "weekend_plan",
      "sightseeing"
    ],
    preferences: [
      "active_general",
      "walk",
      "hiking",
      "biking",
      "yoga",
      "pickleball",
      "sports",
      "park",
      "garden",
      "beach",
      "scenic_view"
    ]
  },
  games_interactive: {
    label: "Games & Interactive",
    description:
      "Social activities built around play, competition, teamwork, or interactive group participation.",
    occasions: [
      "birthday",
      "team_outing",
      "casual_hangout",
      "date_night",
      "family_day",
      "celebration",
      "after_work_hangout",
      "group_night"
    ],
    preferences: [
      "games_general",
      "games",
      "board_games",
      "arcade",
      "bowling",
      "trivia",
      "karaoke",
      "mini_golf",
      "escape_room",
      "pool",
      "ping_pong"
    ]
  },
  exploration_shopping: {
    label: "Exploration & Shopping",
    description:
      "Sightseeing, neighborhood exploring, campus walks, landmarks, markets, bookstores, boutiques, vintage shopping, and browse-friendly outings.",
    occasions: [
      "sightseeing",
      "campus_visit",
      "family_day",
      "parents_visiting",
      "casual_hangout",
      "date_day",
      "weekend_plan",
      "local_discovery",
      "tourist_day"
    ],
    preferences: [
      "exploration_general",
      "sightseeing",
      "campus_walk",
      "landmarks",
      "walking_tour",
      "neighborhood_exploring",
      "local_gems",
      "shopping",
      "bookstore",
      "farmers_market",
      "vintage"
    ]
  },
  home_low_key: {
    label: "Home & Low-Key",
    description:
      "Private, casual, flexible, or slower-paced plans, including home dinners, takeout, movie nights, potlucks, backyard hangouts, and kid-friendly easy plans.",
    occasions: [
      "casual_hangout",
      "family_day",
      "low_key_meetup",
      "date_day",
      "birthday",
      "rainy_day_plan",
      "kids_outing",
      "weekend_plan"
    ],
    preferences: [
      "home_general",
      "low_key",
      "quiet",
      "cozy",
      "private",
      "home_dinner",
      "takeout",
      "potluck",
      "movie_night",
      "board_games",
      "backyard"
    ]
  }
};

export const ACTIVITY_CATEGORY_ORDER = [
  "food_drink",
  "arts_culture_learning",
  "entertainment_nightlife",
  "active_outdoors",
  "games_interactive",
  "exploration_shopping",
  "home_low_key"
] as const satisfies readonly ActivityCategory[];

export const GENERAL_ACTIVITY_PREFERENCES = {
  food_drink: "food_drink_general",
  arts_culture_learning: "arts_culture_general",
  entertainment_nightlife: "entertainment_general",
  active_outdoors: "active_general",
  games_interactive: "games_general",
  exploration_shopping: "exploration_general",
  home_low_key: "home_general"
} as const satisfies Record<ActivityCategory, ActivityPreferenceTag>;

export const GENERAL_ACTIVITY_PREFERENCE_SET = new Set<ActivityPreferenceTag>(
  Object.values(GENERAL_ACTIVITY_PREFERENCES)
);

export const EXPERIENCE_CATEGORIES = ACTIVITY_CATEGORY_ORDER.map((id) => ({
  id,
  ...ACTIVITY_CATEGORIES[id]
})) satisfies ReadonlyArray<ActivityCategoryConfig & { id: ActivityCategory }>;

export type AvailabilityStatus =
  | "likely_available"
  | "limited"
  | "unlikely";

export type ProviderAvailability = "available" | "limited" | "unavailable";

export type PlaceTimeStatus =
  | "open_for_window"
  | "possibly_closed"
  | "hours_unknown";

export type ReservationNeed =
  | "reservation_recommended"
  | "walk_in_likely"
  | "call_to_confirm";

export interface ReservationGuidance {
  need: ReservationNeed;
  label: string;
  detail: string;
  actionLabel: string;
}

export type ReservationSourceProvider =
  | "restaurant_website"
  | "google_places"
  | "opentable"
  | "resy"
  | "phone"
  | "maps";

export type ReservationSourceStatus =
  | "checked"
  | "found"
  | "not_found"
  | "search_ready"
  | "failed"
  | "not_needed";

export type ReservationDiscoveryStatus =
  | "times_found"
  | "provider_link_found"
  | "google_reservable"
  | "walk_in_likely"
  | "needs_user_action"
  | "unavailable"
  | "failed";

export interface RestaurantIdentity {
  canonicalName: string;
  displayName: string;
  placeId?: string;
  formattedAddress?: string;
  neighborhood?: string;
  locality?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  distanceMiles?: number;
  timeZone?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  reservable?: boolean;
  matchConfidence: number;
  matchReason: string;
  sourceProvider: "plan_data" | "google_places";
}

export interface ReservationTimeSlot {
  start: string;
  label: string;
  provider: ReservationSourceProvider;
  sourceUrl?: string;
  confidence: number;
}

export interface ReservationAction {
  provider: ReservationSourceProvider;
  label: string;
  detail: string;
  url?: string;
  requiresUserAction: boolean;
}

export interface ReservationSource {
  provider: ReservationSourceProvider;
  label: string;
  status: ReservationSourceStatus;
  reason: string;
  url?: string;
  confidence: number;
  requiresUserAction: boolean;
  availableTimes?: ReservationTimeSlot[];
}

export interface ReservationDiscovery {
  status: ReservationDiscoveryStatus;
  restaurant: RestaurantIdentity;
  sources: ReservationSource[];
  bestAction?: ReservationAction;
  availableTimes: ReservationTimeSlot[];
  summary: string;
}

export interface PlaceTimeFit {
  status: PlaceTimeStatus;
  label: string;
  detail: string;
  openNow?: boolean;
  weekdayDescriptions?: string[];
}

export type EvidenceQueryStage = "exact" | "expanded" | "broad" | "exploratory";
export type AccuracyStatus = "verified" | "likely" | "exploratory";

export interface RecommendationEvidence {
  categoryConfidence: number;
  locationConfidence: number;
  timeConfidence: number;
  sourceCompleteness: number;
  ratingConfidence: number;
  queryStage: EvidenceQueryStage;
  warnings: string[];
}

export interface ResolvedLocation {
  placeId?: string;
  query: string;
  label: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  locality?: string;
  region?: string;
  country?: string;
  timeZone?: string;
  sourceProvider: "google_places" | "mock";
}

export interface LocationChoice extends ResolvedLocation {}

export interface GroupProfile {
  numberOfPeople: number;
  typeOfPeople: GroupType;
}

export interface LocationPreference {
  strategy: LocationStrategy;
  maxDistanceMiles: number;
  hostNeighborhood?: string;
  targetNeighborhood?: string;
  attendeeSpreadMiles?: number;
  attendeeNeighborhoods?: string[];
  resolvedLocation?: ResolvedLocation;
}

export interface TimeWindow {
  start: string;
  end: string;
  localStart?: string;
  localEnd?: string;
  timeZone?: string;
}

export interface PlanningRequestInput {
  groupProfile: GroupProfile;
  occasion: Occasion;
  location: LocationPreference;
  timeWindow: TimeWindow;
  budgetPerPerson: number;
  dietaryRestrictions: DietaryTag[];
  cuisinePreferences?: CuisinePreference[];
  activityPreferences: ActivityPreference[];
  vibe: Vibe[];
}

export interface PlanningRequest extends PlanningRequestInput {
  id: string;
  createdAt: string;
  mockMode: true;
}

export interface RestaurantOption {
  id: string;
  name: string;
  cuisine: string;
  neighborhood: string;
  pricePerPerson: number;
  vibes: Vibe[];
  dietaryTags: DietaryTag[];
  capacity: number;
  distanceFromHostMiles: number;
  distanceFromCenterMiles: number;
  occasionFits: Occasion[];
  groupTypeFits: GroupType[];
  availabilityProbability: number;
  mockAvailability: ProviderAvailability;
  bookingDifficulty: "easy" | "moderate" | "hard";
  notes: string[];
  source: "mock" | "resy" | "opentable" | "yelp" | "google_places";
  placeId?: string;
  formattedAddress?: string;
  locality?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  travelTimeMinutes?: number;
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  reservable?: boolean;
  rating?: number;
  userRatingCount?: number;
  googleRating?: number;
  googleReviewCount?: number;
  googlePriceLevel?: string;
  cuisineTags?: string[];
  mealTypeTags?: string[];
  atmosphereTags?: string[];
  primaryType?: string;
  placeTypes?: string[];
  timeFit?: PlaceTimeFit;
  dataConfidenceScore?: number;
  evidence?: RecommendationEvidence;
  sourceProvider?: "mock" | "google_places" | "resy" | "opentable" | "yelp";
}

export interface ActivityOption {
  id: string;
  name: string;
  type: string;
  neighborhood: string;
  pricePerPerson: number;
  durationMinutes: number;
  vibes: Vibe[];
  preferences: ActivityPreference[];
  capacity: number;
  distanceFromHostMiles: number;
  distanceFromCenterMiles: number;
  occasionFits: Occasion[];
  groupTypeFits: GroupType[];
  availabilityProbability: number;
  mockAvailability: ProviderAvailability;
  notes: string[];
  source: "mock" | "ticketmaster" | "eventbrite" | "google_places";
  placeId?: string;
  formattedAddress?: string;
  locality?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  travelTimeMinutes?: number;
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  reservable?: boolean;
  rating?: number;
  userRatingCount?: number;
  googleRating?: number;
  googleReviewCount?: number;
  googlePriceLevel?: string;
  primaryType?: string;
  placeTypes?: string[];
  timeFit?: PlaceTimeFit;
  dataConfidenceScore?: number;
  evidence?: RecommendationEvidence;
  sourceProvider?: "mock" | "google_places" | "ticketmaster" | "eventbrite";
}

export interface ScoreBreakdown {
  occasionFit: number;
  groupFit: number;
  capacity: number;
  distance: number;
  budget: number;
  dietary: number;
  vibe: number;
  quality: number;
  availability: number;
}

export interface PlanRecommendation {
  id: string;
  requestId: string;
  rank: number;
  planType?: "restaurant" | "activity";
  restaurant?: RestaurantOption;
  activity?: ActivityOption;
  activityTiming?: "before" | "after";
  estimatedCostPerPerson: number;
  estimatedCostTotal: number;
  travelNotes: string;
  availabilityStatus: AvailabilityStatus;
  confidenceScore: number;
  whyRecommended: string[];
  tradeoffs: string[];
  scoreBreakdown: ScoreBreakdown;
  accuracyStatus: AccuracyStatus;
  evidenceScore: number;
  diversityTags: string[];
  qualityWarnings: string[];
  state: BookingState;
}

export interface ApprovedPlan {
  id: string;
  requestId: string;
  planId: string;
  approvedAt: string;
}

export interface BookingAttempt {
  id: string;
  requestId: string;
  planId: string;
  planRank: number;
  provider: "mock" | "handoff";
  status: BookingState;
  message: string;
  startedAt: string;
  completedAt?: string;
  reservationDiscovery?: ReservationDiscovery;
}

export interface BookingConfirmation {
  id: string;
  requestId: string;
  planId: string;
  confirmationCode: string;
  restaurantName: string;
  activityName?: string;
  partySize: number;
  dateTime: string;
  totalEstimate: number;
  createdAt: string;
  provider: "mock" | "handoff";
}

export interface BookingSummary {
  requestId: string;
  state: BookingState;
  attempts: BookingAttempt[];
  confirmation?: BookingConfirmation;
}

export interface StoredPlanningSession {
  request: PlanningRequest;
  recommendations: PlanRecommendation[];
  approvedPlanIds: string[];
  bookingState: BookingState;
  attempts: BookingAttempt[];
  confirmation?: BookingConfirmation;
  updatedAt: string;
}

export interface UserPlaceInput {
  name: string;
  category: UserPlaceCategory;
  status: UserPlaceStatus;
  neighborhood?: string;
  notes?: string;
  tags?: string[];
  source: UserPlaceSource;
  mapUrl?: string;
  externalPlaceId?: string;
  lastVisitedAt?: string;
}

export interface UserPlace extends UserPlaceInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPlaceFeedback {
  placeId?: string;
  name: string;
  category: UserPlaceCategory;
  status: UserPlaceStatus;
  neighborhood?: string;
  tags: string[];
  notes?: string;
}

export interface UserTasteProfile {
  feedback: UserPlaceFeedback[];
}
