import type {
  ActivityOption,
  BookingConfirmation,
  PlanRecommendation,
  PlanningRequest,
  ReservationDiscovery,
  RestaurantIdentity,
  RestaurantOption
} from "@/lib/types";

export interface RestaurantSearchProvider {
  name: string;
  searchRestaurants(request: PlanningRequest): Promise<RestaurantOption[]>;
}

export interface ActivitySearchProvider {
  name: string;
  searchActivities(request: PlanningRequest): Promise<ActivityOption[]>;
}

export interface AvailabilityResult {
  status: "available" | "unavailable" | "needs_user_action";
  message: string;
  provider: "mock";
}

export interface AvailabilityProvider {
  name: string;
  checkPlan(
    request: PlanningRequest,
    plan: PlanRecommendation
  ): Promise<AvailabilityResult>;
}

export interface RestaurantIdentityResolver {
  name: string;
  resolve(
    request: PlanningRequest,
    plan: PlanRecommendation
  ): Promise<RestaurantIdentity>;
}

export interface ReservationDiscoveryProvider {
  name: string;
  discover(
    request: PlanningRequest,
    plan: PlanRecommendation
  ): Promise<ReservationDiscovery>;
}

export interface BookingResult {
  status: "booked" | "failed" | "needs_user_action";
  confirmation?: BookingConfirmation;
  message: string;
}

export interface BookingProvider {
  name: string;
  bookPlan(
    request: PlanningRequest,
    plan: PlanRecommendation,
    availability: AvailabilityResult
  ): Promise<BookingResult>;
}
