"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Compass,
  History,
  Import,
  MapPin,
  Plus,
  Trash2
} from "lucide-react";
import PageShell from "./PageShell";
import {
  USER_PLACE_CATEGORIES,
  USER_PLACE_STATUSES,
  type UserPlace,
  type UserPlaceCategory,
  type UserPlaceStatus
} from "@/lib/types";
import { toTitle } from "@/lib/utils";

type PlaceForm = {
  name: string;
  category: UserPlaceCategory;
  status: UserPlaceStatus;
  neighborhood: string;
  notes: string;
  tags: string;
  source: "manual" | "google_maps_bookmark";
  mapUrl: string;
};

const defaultForm: PlaceForm = {
  name: "",
  category: "restaurant",
  status: "visited",
  neighborhood: "Downtown Palo Alto",
  notes: "",
  tags: "",
  source: "manual",
  mapUrl: ""
};

const filters = ["all", ...USER_PLACE_STATUSES] as const;
type Filter = (typeof filters)[number];

function statusLabel(status: UserPlaceStatus) {
  if (status === "want_to_go") {
    return "Want to go";
  }
  if (status === "bookmarked") return "Bookmarked";
  return toTitle(status);
}

function StatCard({
  label,
  value,
  icon
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="interactive-card p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase text-stone-500">{label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-mist text-coral">
          {icon}
        </span>
      </div>
      <p className="display-title mt-2 text-4xl text-ink">{value}</p>
    </div>
  );
}

export default function PlacesDashboard() {
  const [places, setPlaces] = useState<UserPlace[]>([]);
  const [form, setForm] = useState<PlaceForm>(defaultForm);
  const [mapsText, setMapsText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPlaces() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/places");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load places.");
      }
      setPlaces(data.places);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load places.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlaces();
  }, []);

  const stats = useMemo(() => {
    return {
      visited: places.filter((place) => place.status === "visited").length,
      bookmarked: places.filter((place) => place.status === "bookmarked").length,
      wantToGo: places.filter((place) => place.status === "want_to_go").length
    };
  }, [places]);

  const visiblePlaces = useMemo(() => {
    if (filter === "all") {
      return places;
    }
    return places.filter((place) => place.status === filter);
  }, [filter, places]);

  async function addPlace() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to save place.");
      }
      setPlaces((current) => [data.place, ...current]);
      setForm(defaultForm);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save place.");
    } finally {
      setSaving(false);
    }
  }

  async function importMapsBookmarks() {
    if (!mapsText.trim()) {
      setError("Paste at least one place name from Maps.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "maps_import", rawText: mapsText })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to import bookmarks.");
      }
      setPlaces((current) => [...data.places, ...current]);
      setMapsText("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to import bookmarks.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(placeId: string, status: UserPlaceStatus) {
    setError(null);
    const previous = places;
    setPlaces((current) =>
      current.map((place) => (place.id === placeId ? { ...place, status } : place))
    );
    try {
      const response = await fetch("/api/places", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: placeId, status })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to update place.");
      }
      setPlaces((current) =>
        current.map((place) => (place.id === placeId ? data.place : place))
      );
    } catch (caught) {
      setPlaces(previous);
      setError(caught instanceof Error ? caught.message : "Unable to update place.");
    }
  }

  async function deletePlace(placeId: string) {
    setError(null);
    const previous = places;
    setPlaces((current) => current.filter((place) => place.id !== placeId));
    try {
      const response = await fetch(`/api/places?id=${placeId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to delete place.");
      }
    } catch (caught) {
      setPlaces(previous);
      setError(caught instanceof Error ? caught.message : "Unable to delete place.");
    }
  }

  return (
    <PageShell compact>
      <section className="motion-panel mb-5 overflow-hidden p-4 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <p className="editorial-kicker">( Your placebook )</p>
            <h1 className="display-title mt-2 max-w-4xl text-5xl leading-[0.9] text-ink sm:text-7xl">
              Places worth remembering
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
              A cleaner memory layer for spots you have visited, saved from Maps,
              or want the planning agent to consider later.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="interactive-card bg-mist/70 p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-coral shadow-sm">
                  <Compass className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase text-stone-500">
                    Memory total
                  </p>
                  <p className="display-title text-4xl text-ink">{places.length}</p>
                </div>
              </div>
            </div>
            <Link href="/" className="action-primary group">
              New plan
              <ArrowRight className="motion-arrow h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Visited"
            value={stats.visited}
            icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          />
          <StatCard
            label="Bookmarked"
            value={stats.bookmarked}
            icon={<Bookmark className="h-4 w-4" aria-hidden="true" />}
          />
          <StatCard
            label="Want to go"
            value={stats.wantToGo}
            icon={<History className="h-4 w-4" aria-hidden="true" />}
          />
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="motion-panel p-4 sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="editorial-kicker">( Collection )</p>
              <h2 className="display-title mt-1 text-4xl uppercase text-ink">
                Your local signal
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="chip"
                  data-active={filter === item}
                  onClick={() => setFilter(item)}
                >
                  {item === "all" ? "All" : statusLabel(item)}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-stone-300 bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            {loading ? (
              <div className="interactive-card p-5 text-sm font-bold text-stone-600">
                Loading places...
              </div>
            ) : visiblePlaces.length === 0 ? (
              <div className="interactive-card p-5">
                <p className="display-title text-3xl uppercase text-ink">
                  No places here yet
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Add a place manually or paste a Maps bookmark list to start building
                  memory.
                </p>
              </div>
            ) : (
              visiblePlaces.map((place) => (
                <article key={place.id} className="interactive-card p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className="arrival-mark min-h-7 text-[10px]">
                          {statusLabel(place.status)}
                        </span>
                        <span className="rounded-lg border border-ink/10 bg-white/70 px-2.5 py-1 text-xs font-black uppercase text-stone-500">
                          {toTitle(place.category)}
                        </span>
                        {place.source === "google_maps_bookmark" ? (
                          <span className="rounded-lg border border-flax bg-flax/30 px-2.5 py-1 text-xs font-black uppercase text-ink">
                            Maps
                          </span>
                        ) : null}
                      </div>
                      <h3 className="display-title text-3xl leading-none text-ink sm:text-4xl">
                        {place.name}
                      </h3>
                      <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-stone-600">
                        <MapPin className="h-4 w-4 text-coral" aria-hidden="true" />
                        {place.neighborhood || "Neighborhood not set"}
                      </p>
                      {place.notes ? (
                        <p className="mt-3 text-sm leading-6 text-stone-600">
                          {place.notes}
                        </p>
                      ) : null}
                      {place.tags && place.tags.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {place.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-lg bg-sage px-2.5 py-1 text-xs font-bold text-ink"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="grid min-w-44 gap-2">
                      {USER_PLACE_STATUSES.map((status) => (
                        <button
                          key={status}
                          type="button"
                          className="action-secondary min-h-9 px-3 text-xs"
                          disabled={place.status === status}
                          onClick={() => void updateStatus(place.id, status)}
                        >
                          {statusLabel(status)}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="action-reject min-h-9 px-3 text-xs"
                        onClick={() => void deletePlace(place.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="grid gap-5 self-start xl:sticky xl:top-6">
          <section className="motion-panel p-4 sm:p-5">
            <p className="editorial-kicker">( Add manually )</p>
            <h2 className="display-title mt-1 text-4xl uppercase text-ink">
              Tell the agent
            </h2>
            <div className="mt-4 grid gap-3">
              <label className="space-y-2">
                <span className="label">Place name</span>
                <input
                  className="field"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Tamarine"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="label">Category</span>
                  <select
                    className="field"
                    value={form.category}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        category: event.target.value as UserPlaceCategory
                      })
                    }
                  >
                    {USER_PLACE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {toTitle(category)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="label">Status</span>
                  <select
                    className="field"
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value as UserPlaceStatus })
                    }
                  >
                    {USER_PLACE_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="space-y-2">
                <span className="label">Neighborhood</span>
                <input
                  className="field"
                  value={form.neighborhood}
                  onChange={(event) =>
                    setForm({ ...form, neighborhood: event.target.value })
                  }
                  placeholder="Downtown Palo Alto"
                />
              </label>
              <label className="space-y-2">
                <span className="label">Tags</span>
                <input
                  className="field"
                  value={form.tags}
                  onChange={(event) => setForm({ ...form, tags: event.target.value })}
                  placeholder="date, quiet, vegan"
                />
              </label>
              <label className="space-y-2">
                <span className="label">Notes</span>
                <textarea
                  className="field min-h-24 resize-none"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="What should the agent remember?"
                />
              </label>
              <button
                type="button"
                className="action-primary group"
                onClick={() => void addPlace()}
                disabled={saving || !form.name.trim()}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add place
              </button>
            </div>
          </section>

          <section className="motion-panel p-4 sm:p-5">
            <p className="editorial-kicker">( Maps bookmarks )</p>
            <h2 className="display-title mt-1 text-4xl uppercase text-ink">
              Paste saved places
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              For now, paste one place per line from Maps. Use{" "}
              <span className="font-bold">Name - Neighborhood</span> when you know the
              area. Imported places become bookmarked.
            </p>
            <textarea
              className="field mt-4 min-h-36 resize-none"
              value={mapsText}
              onChange={(event) => setMapsText(event.target.value)}
              placeholder={"Coupa Cafe - Downtown Palo Alto\nCantor Arts Center - Stanford"}
            />
            <button
              type="button"
              className="action-secondary mt-3 w-full"
              onClick={() => void importMapsBookmarks()}
              disabled={saving}
            >
              <Import className="h-4 w-4" aria-hidden="true" />
              Import as bookmarked
            </button>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
