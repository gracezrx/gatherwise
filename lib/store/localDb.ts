import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type {
  BookingAttempt,
  BookingConfirmation,
  BookingState,
  PlanRecommendation,
  PlanningRequest,
  StoredPlanningSession,
  UserPlaceCategory,
  UserPlace,
  UserPlaceInput,
  UserPlaceStatus,
  UserTasteProfile
} from "@/lib/types";
import { createId } from "@/lib/utils";

interface LocalDbShape {
  sessions: Record<string, StoredPlanningSession>;
  places: Record<string, UserPlace>;
}

const REMOTE_DB_KEY = process.env.GATHERWISE_REDIS_KEY ?? "gatherwise:db:v1";

type StorageMode = "local-json" | "ephemeral-json" | "upstash-redis";

interface RedisRestResponse<T> {
  result?: T;
  error?: string;
}

function emptyDb(): LocalDbShape {
  return { sessions: {}, places: {} };
}

function normalizeDbShape(db: Partial<LocalDbShape>): LocalDbShape {
  return {
    sessions: db.sessions ?? {},
    places: normalizePlaces(db.places ?? {})
  };
}

function getRedisRestConfig() {
  const url = (
    process.env.KV_REST_API_URL ??
    process.env.UPSTASH_REDIS_REST_URL ??
    ""
  )
    .trim()
    .replace(/\/+$/, "");
  const token = (
    process.env.KV_REST_API_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    ""
  ).trim();

  return url && token ? { url, token } : undefined;
}

function redisHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`
  };
}

async function readRemoteDb(config: { url: string; token: string }): Promise<LocalDbShape> {
  const response = await fetch(`${config.url}/get/${encodeURIComponent(REMOTE_DB_KEY)}`, {
    headers: redisHeaders(config.token),
    cache: "no-store"
  });

  const payload = (await response.json()) as RedisRestResponse<string | null>;

  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? "Unable to read Gatherwise remote storage.");
  }

  if (!payload.result) {
    return emptyDb();
  }

  return normalizeDbShape(JSON.parse(payload.result) as Partial<LocalDbShape>);
}

async function writeRemoteDb(
  config: { url: string; token: string },
  db: LocalDbShape
) {
  const response = await fetch(`${config.url}/set/${encodeURIComponent(REMOTE_DB_KEY)}`, {
    method: "POST",
    headers: {
      ...redisHeaders(config.token),
      "content-type": "application/json"
    },
    body: JSON.stringify(db)
  });

  const payload = (await response.json()) as RedisRestResponse<string>;

  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? "Unable to write Gatherwise remote storage.");
  }
}

export function getDbStorageMode(): StorageMode {
  if (getRedisRestConfig()) {
    return "upstash-redis";
  }

  return process.env.VERCEL === "1" ? "ephemeral-json" : "local-json";
}

function getLocalDbPaths() {
  const dbDir =
    getDbStorageMode() === "ephemeral-json"
      ? path.join(os.tmpdir(), "gatherwise")
      : path.join(process.cwd(), "work");

  return {
    dbDir,
    dbFile: path.join(dbDir, "social-planner-db.json")
  };
}

function dbPath() {
  return getLocalDbPaths().dbFile;
}

async function ensureDb() {
  const { dbDir, dbFile } = getLocalDbPaths();

  await fs.mkdir(dbDir, { recursive: true });

  try {
    await fs.access(dbFile);
  } catch {
    await fs.writeFile(
      dbFile,
      JSON.stringify({ sessions: {}, places: {} }, null, 2),
      "utf8"
    );
  }
}

async function readDb(): Promise<LocalDbShape> {
  const redisConfig = getRedisRestConfig();

  if (redisConfig) {
    return readRemoteDb(redisConfig);
  }

  await ensureDb();
  const raw = await fs.readFile(dbPath(), "utf8");
  return normalizeDbShape(JSON.parse(raw) as Partial<LocalDbShape>);
}

async function writeDb(db: LocalDbShape) {
  const redisConfig = getRedisRestConfig();

  if (redisConfig) {
    await writeRemoteDb(redisConfig, db);
    return;
  }

  await ensureDb();
  await fs.writeFile(dbPath(), JSON.stringify(db, null, 2), "utf8");
}

function normalizePlaceStatus(status: string): UserPlaceStatus {
  if (status === "saved") {
    return "bookmarked";
  }

  if (status === "want_to_try") {
    return "want_to_go";
  }

  if (
    status === "visited" ||
    status === "bookmarked" ||
    status === "rejected" ||
    status === "approved" ||
    status === "want_to_go"
  ) {
    return status;
  }

  return "bookmarked";
}

function normalizePlaces(places: Record<string, UserPlace>) {
  return Object.fromEntries(
    Object.entries(places).map(([id, place]) => [
      id,
      {
        ...place,
        status: normalizePlaceStatus(String(place.status))
      }
    ])
  );
}

function identityPart(value?: string) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function placeIdentityKey(input: Pick<UserPlaceInput, "name" | "neighborhood" | "externalPlaceId">) {
  if (input.externalPlaceId) {
    return `external:${input.externalPlaceId}`;
  }

  return `name:${identityPart(input.name)}:${identityPart(input.neighborhood)}`;
}

function categoryForPlan(plan: PlanRecommendation): UserPlaceCategory {
  if (plan.restaurant) {
    const text = [
      plan.restaurant.name,
      plan.restaurant.cuisine,
      plan.restaurant.primaryType,
      ...(plan.restaurant.placeTypes ?? [])
    ].join(" ").toLowerCase();

    if (text.includes("night_club") || text.includes("nightclub")) return "nightclub";
    if (text.includes("bar") || text.includes("pub")) return "bar";
    if (text.includes("cafe") || text.includes("coffee")) return "cafe";
    return "restaurant";
  }

  if (plan.activity) {
    const text = [
      plan.activity.name,
      plan.activity.type,
      plan.activity.primaryType,
      ...(plan.activity.placeTypes ?? [])
    ].join(" ").toLowerCase();

    if (text.includes("night_club") || text.includes("nightclub")) return "nightclub";
    if (text.includes("bar") || text.includes("pub")) return "bar";
    if (text.includes("cafe") || text.includes("coffee")) return "cafe";
    if (
      text.includes("museum") ||
      text.includes("gallery") ||
      text.includes("park") ||
      text.includes("tourist") ||
      text.includes("landmark")
    ) {
      return "sight";
    }
    return "activity";
  }

  return "other";
}

function placeInputForPlan(
  plan: PlanRecommendation,
  status: UserPlaceStatus
): UserPlaceInput | undefined {
  const primary = plan.restaurant ?? plan.activity;

  if (!primary) {
    return undefined;
  }

  return {
    name: primary.name,
    category: categoryForPlan(plan),
    status,
    neighborhood: primary.neighborhood,
    source: "past_booking",
    mapUrl: primary.googleMapsUri,
    externalPlaceId: primary.placeId,
    tags: [
      plan.planType ?? (plan.restaurant ? "restaurant" : "activity"),
      plan.accuracyStatus,
      ...plan.diversityTags.slice(0, 4)
    ],
    notes:
      status === "rejected"
        ? "Rejected from a Gatherwise recommendation."
        : status === "approved"
          ? "Approved from a Gatherwise recommendation."
          : "Saved from a Gatherwise recommendation."
  };
}

function upsertUserPlaceInDb(db: LocalDbShape, input: UserPlaceInput) {
  const now = new Date().toISOString();
  const wantedKey = placeIdentityKey(input);
  const existing = Object.values(db.places).find(
    (place) => placeIdentityKey(place) === wantedKey
  );

  if (existing) {
    const mergedTags = Array.from(new Set([...(existing.tags ?? []), ...(input.tags ?? [])]));
    db.places[existing.id] = {
      ...existing,
      ...input,
      name: input.name.trim(),
      neighborhood: input.neighborhood?.trim() ?? existing.neighborhood,
      notes: input.notes?.trim() ?? existing.notes,
      tags: mergedTags,
      updatedAt: now
    };
    return db.places[existing.id];
  }

  const id = createId("place");
  const place: UserPlace = {
    ...input,
    id,
    name: input.name.trim(),
    neighborhood: input.neighborhood?.trim(),
    notes: input.notes?.trim(),
    tags: input.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [],
    createdAt: now,
    updatedAt: now
  };

  db.places[id] = place;
  return place;
}

export async function savePlanningSession(
  request: PlanningRequest,
  recommendations: PlanRecommendation[]
) {
  const db = await readDb();
  db.sessions[request.id] = {
    request,
    recommendations,
    approvedPlanIds: [],
    bookingState: "pending_review",
    attempts: [],
    updatedAt: new Date().toISOString()
  };
  await writeDb(db);
  return db.sessions[request.id];
}

export async function getPlanningSession(requestId: string) {
  const db = await readDb();
  return db.sessions[requestId];
}

export async function listPlanningSessions() {
  const db = await readDb();
  return Object.values(db.sessions).sort((first, second) =>
    second.updatedAt.localeCompare(first.updatedAt)
  );
}

export async function updatePlanningSession(
  requestId: string,
  updater: (session: StoredPlanningSession) => StoredPlanningSession
) {
  const db = await readDb();
  const session = db.sessions[requestId];

  if (!session) {
    return undefined;
  }

  db.sessions[requestId] = {
    ...updater(session),
    updatedAt: new Date().toISOString()
  };
  await writeDb(db);
  return db.sessions[requestId];
}

export async function setApprovedPlanIds(requestId: string, approvedPlanIds: string[]) {
  const updated = await updatePlanningSession(requestId, (session) => ({
    ...session,
    approvedPlanIds,
    bookingState: approvedPlanIds.length > 0 ? "approved" : "needs_user_action",
    recommendations: session.recommendations.map((plan) => ({
      ...plan,
      state: approvedPlanIds.includes(plan.id) ? "approved" : plan.state
    }))
  }));

  for (const planId of approvedPlanIds) {
    await recordPlanPlaceFeedback(requestId, planId, "approved");
  }

  return updated;
}

export async function saveBookingResult(
  requestId: string,
  state: BookingState,
  attempts: BookingAttempt[],
  confirmation?: BookingConfirmation
) {
  return updatePlanningSession(requestId, (session) => ({
    ...session,
    bookingState: state,
    attempts,
    confirmation,
    recommendations: session.recommendations.map((plan) => {
      const lastAttempt = [...attempts]
        .reverse()
        .find((attempt) => attempt.planId === plan.id);
      return lastAttempt ? { ...plan, state: lastAttempt.status } : plan;
    })
  }));
}

export async function listUserPlaces() {
  const db = await readDb();
  return Object.values(db.places).sort((first, second) =>
    second.updatedAt.localeCompare(first.updatedAt)
  );
}

export async function saveUserPlace(input: UserPlaceInput) {
  const db = await readDb();
  const place = upsertUserPlaceInDb(db, input);
  await writeDb(db);
  return place;
}

export async function getUserTasteProfile(): Promise<UserTasteProfile> {
  const places = await listUserPlaces();
  return {
    feedback: places.map((place) => ({
      placeId: place.externalPlaceId,
      name: place.name,
      category: place.category,
      status: place.status,
      neighborhood: place.neighborhood,
      tags: place.tags ?? [],
      notes: place.notes
    }))
  };
}

export async function recordPlanPlaceFeedback(
  requestId: string,
  planId: string,
  status: UserPlaceStatus
) {
  const db = await readDb();
  const session = db.sessions[requestId];
  const plan = session?.recommendations.find((recommendation) => recommendation.id === planId);
  const input = plan ? placeInputForPlan(plan, status) : undefined;

  if (!input) {
    return undefined;
  }

  const place = upsertUserPlaceInDb(db, input);
  await writeDb(db);
  return place;
}

export async function updateUserPlace(
  placeId: string,
  updater: (place: UserPlace) => UserPlace
) {
  const db = await readDb();
  const place = db.places[placeId];

  if (!place) {
    return undefined;
  }

  db.places[placeId] = {
    ...updater(place),
    updatedAt: new Date().toISOString()
  };
  await writeDb(db);
  return db.places[placeId];
}

export async function deleteUserPlace(placeId: string) {
  const db = await readDb();

  if (!db.places[placeId]) {
    return false;
  }

  delete db.places[placeId];
  await writeDb(db);
  return true;
}
