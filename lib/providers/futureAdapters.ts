import type {
  ActivitySearchProvider,
  AvailabilityProvider,
  AvailabilityResult,
  BookingProvider,
  BookingResult,
  RestaurantSearchProvider
} from "./interfaces";
import type {
  ActivityOption,
  PlanRecommendation,
  PlanningRequest,
  RestaurantOption
} from "@/lib/types";

class NotConfiguredRestaurantAdapter implements RestaurantSearchProvider {
  constructor(public name: string) {}

  async searchRestaurants(): Promise<RestaurantOption[]> {
    throw new Error(`${this.name} adapter is a placeholder. Configure official API credentials before use.`);
  }
}

class NotConfiguredActivityAdapter implements ActivitySearchProvider {
  constructor(public name: string) {}

  async searchActivities(): Promise<ActivityOption[]> {
    throw new Error(`${this.name} adapter is a placeholder. Configure official API credentials before use.`);
  }
}

class NotConfiguredAvailabilityAdapter implements AvailabilityProvider {
  constructor(public name: string) {}

  async checkPlan(
    _request: PlanningRequest,
    _plan: PlanRecommendation
  ): Promise<AvailabilityResult> {
    throw new Error(`${this.name} availability adapter is a placeholder for official API integration.`);
  }
}

class NotConfiguredBookingAdapter implements BookingProvider {
  constructor(public name: string) {}

  async bookPlan(): Promise<BookingResult> {
    throw new Error(`${this.name} booking adapter is a placeholder for official API integration.`);
  }
}

export const futureProviderAdapters = {
  resy: {
    restaurants: new NotConfiguredRestaurantAdapter("Resy"),
    availability: new NotConfiguredAvailabilityAdapter("Resy"),
    booking: new NotConfiguredBookingAdapter("Resy")
  },
  openTable: {
    restaurants: new NotConfiguredRestaurantAdapter("OpenTable"),
    availability: new NotConfiguredAvailabilityAdapter("OpenTable"),
    booking: new NotConfiguredBookingAdapter("OpenTable")
  },
  yelp: {
    restaurants: new NotConfiguredRestaurantAdapter("Yelp")
  },
  ticketmaster: {
    activities: new NotConfiguredActivityAdapter("Ticketmaster"),
    availability: new NotConfiguredAvailabilityAdapter("Ticketmaster"),
    booking: new NotConfiguredBookingAdapter("Ticketmaster")
  },
  eventbrite: {
    activities: new NotConfiguredActivityAdapter("Eventbrite"),
    availability: new NotConfiguredAvailabilityAdapter("Eventbrite"),
    booking: new NotConfiguredBookingAdapter("Eventbrite")
  }
};
