const LOCAL_DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?$/;

export function dateTimeForReservationUrl(
  value: string,
  timeZone = "America/Los_Angeles"
) {
  const localMatch = LOCAL_DATETIME_PATTERN.exec(value);

  if (localMatch) {
    const [, year, month, day, hour, minute] = localMatch;
    return `${year}-${month}-${day}T${hour}:${minute}:00`;
  }

  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "00";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part(
    "minute"
  )}:00`;
}

function cleanSearchTerm(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function buildOpenTableSearchUrl({
  partySize,
  restaurantName,
  start,
  timeZone
}: {
  neighborhood?: string;
  partySize: number;
  restaurantName: string;
  start: string;
  timeZone?: string;
}) {
  const params = new URLSearchParams({
    covers: String(partySize),
    dateTime: dateTimeForReservationUrl(start, timeZone),
    term: cleanSearchTerm(restaurantName)
  });

  return `https://www.opentable.com/s?${params.toString()}`;
}

export function buildResySearchUrl({
  restaurantName
}: {
  partySize: number;
  restaurantName: string;
  start: string;
  timeZone?: string;
}) {
  const query = new URLSearchParams({
    q: `site:resy.com ${cleanSearchTerm(restaurantName)}`
  });

  return `https://www.google.com/search?${query.toString()}`;
}
