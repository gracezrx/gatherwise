"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  RefreshCcw,
  Sparkles,
  Users
} from "lucide-react";
import {
  DIETARY_TAGS,
  CUISINE_PREFERENCES,
  EXPERIENCE_CATEGORIES,
  GENERAL_ACTIVITY_PREFERENCE_SET,
  GENERAL_ACTIVITY_PREFERENCES,
  GROUP_TYPES,
  LOCATION_STRATEGIES,
  VIBES,
  type DietaryTag,
  type CuisinePreference,
  type GroupType,
  type LocationChoice,
  type LocationStrategy,
  type PlanningRequestInput,
  type Vibe
} from "@/lib/types";
import { LanguageToggle, useLanguage } from "./LanguageProvider";
import { saveClientSession } from "@/lib/clientSessionStore";
import { toTitle } from "@/lib/utils";

type Draft = PlanningRequestInput;

const defaultCategoryId = "food_drink";

function toDatetimeLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultDraft(): Draft {
  return {
    groupProfile: {
      numberOfPeople: 0,
      typeOfPeople: "friends"
    },
    occasion: "dinner",
    location: {
      strategy: "target_neighborhood",
      maxDistanceMiles: 0,
      hostNeighborhood: "",
      targetNeighborhood: "",
      attendeeSpreadMiles: 0,
      attendeeNeighborhoods: []
    },
    timeWindow: {
      start: "",
      end: ""
    },
    budgetPerPerson: 0,
    dietaryRestrictions: [],
    cuisinePreferences: [],
    activityPreferences: [],
    vibe: []
  };
}

function categoryById(categoryId: string) {
  return (
    EXPERIENCE_CATEGORIES.find((category) => category.id === categoryId) ??
    EXPERIENCE_CATEGORIES[0]
  );
}

function inferCategoryId(draft: Draft) {
  let bestCategory = categoryById(defaultCategoryId);
  let bestScore = -1;

  for (const category of EXPERIENCE_CATEGORIES) {
    const occasionScore = category.occasions.includes(draft.occasion) ? 3 : 0;
    const preferenceScore = category.preferences.filter((preference) =>
      draft.activityPreferences.includes(preference)
    ).length;
    const score = occasionScore + preferenceScore;

    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  return bestCategory.id;
}

function categoryUsesFoodDetails(categoryId: string) {
  return categoryId === "food_drink";
}

function chipLabel(value: string) {
  return value === "between_attendees"
    ? "Between attendees"
    : value === "from_host"
      ? "From host"
      : value === "target_neighborhood"
        ? "Target neighborhood"
        : toTitle(value);
}

function toggle<T extends string>(items: T[], value: T) {
  return items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];
}

function resizeNeighborhoods(values: string[] | undefined, count: number) {
  const current = values?.length ? values : [];
  return Array.from({ length: Math.max(0, count) }, (_, index) => current[index] ?? "");
}

function locationPreviewQuery(draft: Draft) {
  if (draft.location.strategy === "from_host") {
    return draft.location.hostNeighborhood?.trim() || undefined;
  }

  if (draft.location.strategy === "between_attendees") {
    const neighborhoods = resizeNeighborhoods(
      draft.location.attendeeNeighborhoods,
      draft.groupProfile.numberOfPeople
    )
      .map((neighborhood) => neighborhood.trim())
      .filter(Boolean);

    return neighborhoods.length ? neighborhoods.join(", ") : undefined;
  }

  return draft.location.targetNeighborhood?.trim() || undefined;
}

function googleMapEmbedUrl(query: string) {
  const params = new URLSearchParams({
    q: query,
    output: "embed"
  });

  return `https://www.google.com/maps?${params.toString()}`;
}

function ChoiceChips<T extends string>({
  values,
  selected,
  onToggle,
  getLabel = chipLabel,
  multi = true
}: {
  values: readonly T[];
  selected: T[] | T | "";
  onToggle: (value: T) => void;
  getLabel?: (value: string) => string;
  multi?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => {
        const active = Array.isArray(selected)
          ? selected.includes(value)
          : selected === value;
        return (
          <button
            type="button"
            key={value}
            className="chip"
            data-active={active}
            aria-pressed={active}
            onClick={() => onToggle(value)}
          >
            {multi && active ? "✓ " : ""}
            {getLabel(value)}
          </button>
        );
      })}
    </div>
  );
}

function StepHeader({ step, labels }: { step: number; labels: string[] }) {
  return (
    <div className="deck-progress" aria-label="Planning progress">
      {labels.map((label, index) => {
        const state = index === step ? "active" : index < step ? "complete" : "upcoming";

        return (
          <div
            key={label}
            className="step-pill"
            data-state={state}
            aria-current={index === step ? "step" : undefined}
          >
            <span className="step-number">No. {String(index + 1).padStart(3, "0")}</span>
            <span className="truncate">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function CategoryPicker({
  selectedCategoryId,
  onSelect
}: {
  selectedCategoryId: string;
  onSelect: (categoryId: string) => void;
}) {
  const { t, categoryLabel, categoryDescription } = useLanguage();

  return (
    <div className="animate-reveal space-y-4">
      <div>
        <span className="label">{t("whatKind")}</span>
        <p className="hint mt-1">
          {t("categoryHint")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {EXPERIENCE_CATEGORIES.map((category) => {
          const selected = selectedCategoryId === category.id;

          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={selected}
              data-active={selected}
              className={`group interactive-card min-h-32 p-4 text-left ${
                selected
                  ? "border-coral bg-gradient-to-br from-coral to-moss text-white shadow-lift"
                  : "border-ink/10 bg-cloud"
              }`}
              onClick={() => onSelect(category.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={selected ? "display-title text-2xl text-white" : "display-title text-2xl text-ink"}>
                    {categoryLabel(category)}
                  </p>
                  <p className={selected ? "mt-2 text-sm leading-5 text-white/85" : "mt-2 text-sm leading-5 text-stone-500"}>
                    {categoryDescription(category)}
                  </p>
                </div>
                {selected ? (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/90 text-coral shadow-sm">
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </span>
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ink/10 bg-white text-coral">
                    <ArrowRight className="motion-arrow h-4 w-4" aria-hidden="true" />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SpecificsPicker({
  categoryId,
  draft,
  updateDraft
}: {
  categoryId: string;
  draft: Draft;
  updateDraft: (updater: (current: Draft) => Draft) => void;
}) {
  const category = categoryById(categoryId);
  const { t, label, categoryLabel, categoryDescription } = useLanguage();
  const generalPreference = GENERAL_ACTIVITY_PREFERENCES[category.id];
  const specificPreferences = category.preferences.filter(
    (preference) => !GENERAL_ACTIVITY_PREFERENCE_SET.has(preference)
  );

  return (
    <div className="animate-reveal space-y-6">
      <div className="interactive-card border-flax/50 bg-flax/20 p-4">
        <p className="text-sm font-black text-ink">{categoryLabel(category)}</p>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          {categoryDescription(category)}
        </p>
      </div>

      <div className="space-y-2">
        <span className="label">{t("occasionQuestion")}</span>
        <ChoiceChips
          values={category.occasions}
          selected={draft.occasion}
          multi={false}
          getLabel={label}
          onToggle={(occasion) =>
            updateDraft((current) => ({
              ...current,
              occasion
            }))
          }
        />
      </div>

      <div className="space-y-2">
        <span className="label">{t("addons")}</span>
        <p className="hint">{t("addonsHint")}</p>
        <ChoiceChips
          values={specificPreferences}
          selected={draft.activityPreferences}
          getLabel={label}
          onToggle={(preference) =>
            updateDraft((current) => ({
              ...current,
              activityPreferences: toggle(
                current.activityPreferences.filter((item) => item !== generalPreference),
                preference
              )
            }))
          }
        />
      </div>

      <div className="space-y-2 rounded-lg border border-ink/10 bg-white/65 p-3">
        <span className="label">{t("otherGeneral")}</span>
        <p className="hint">{t("otherGeneralHint")}</p>
        <ChoiceChips
          values={[generalPreference]}
          selected={draft.activityPreferences}
          getLabel={() => t("otherGeneralChoice")}
          onToggle={(preference) =>
            updateDraft((current) => ({
              ...current,
              activityPreferences: current.activityPreferences.includes(preference)
                ? current.activityPreferences.filter((item) => item !== preference)
                : [preference]
            }))
          }
        />
      </div>
    </div>
  );
}

function SlideFrame({
  active,
  children,
  description,
  index,
  title
}: {
  active: boolean;
  children: ReactNode;
  description: string;
  index: number;
  title: string;
}) {
  return (
    <section
      className="planner-slide"
      data-active={active}
      aria-hidden={!active}
    >
      <div className="slide-frame">
        <div className="slide-orbit" aria-hidden="true" />
        <div className="slide-frame-copy">
          <span className="slide-count">N°{String(index + 1).padStart(3, "0")}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="slide-frame-workspace">{children}</div>
      </div>
    </section>
  );
}

function LocationChoicePanel({
  choices,
  onSelect
}: {
  choices: LocationChoice[];
  onSelect: (choice: LocationChoice) => void;
}) {
  if (choices.length === 0) {
    return null;
  }

  return (
    <div className="interactive-card border-flax bg-flax/20 p-4">
      <p className="text-sm font-black text-ink">Choose the location</p>
      <p className="mt-1 text-sm text-stone-600">
        This place name matches multiple locations. Pick the one you mean.
      </p>
      <div className="mt-3 grid gap-2">
        {choices.map((choice) => (
          <button
            key={`${choice.placeId ?? choice.formattedAddress}:${choice.latitude}:${choice.longitude}`}
            type="button"
            className="rounded-lg border border-ink/10 bg-white/75 p-3 text-left transition duration-200 ease-smooth hover:-translate-y-0.5 hover:border-moss/40"
            onClick={() => onSelect(choice)}
          >
            <span className="block text-sm font-black text-ink">{choice.label}</span>
            <span className="mt-1 block text-xs font-semibold text-stone-600">
              {choice.formattedAddress}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function stripRequestForDraft(request: Draft): Draft {
  return {
    groupProfile: request.groupProfile,
    occasion: request.occasion,
    location: request.location,
    timeWindow: {
      start: request.timeWindow.localStart ?? toDatetimeLocal(new Date(request.timeWindow.start)),
      end: request.timeWindow.localEnd ?? toDatetimeLocal(new Date(request.timeWindow.end))
    },
    budgetPerPerson: request.budgetPerPerson,
    dietaryRestrictions: request.dietaryRestrictions,
    cuisinePreferences: request.cuisinePreferences ?? [],
    activityPreferences: request.activityPreferences,
    vibe: request.vibe
  };
}

export default function PlannerWizard() {
  const router = useRouter();
  const { t, label, categoryLabel } = useLanguage();
  const plannerPanelRef = useRef<HTMLDivElement | null>(null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => defaultDraft());
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [groupTypeTouched, setGroupTypeTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationChoices, setLocationChoices] = useState<LocationChoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const previewQuery = locationPreviewQuery(draft);
  const selectedCategory = selectedCategoryId ? categoryById(selectedCategoryId) : null;
  const hasBrief =
    Boolean(selectedCategory) ||
    draft.groupProfile.numberOfPeople > 0 ||
    draft.budgetPerPerson > 0 ||
    Boolean(previewQuery) ||
    Boolean(draft.timeWindow.start || draft.timeWindow.end);
  const stepLabels = [t("category"), t("specifics"), t("placeTime"), t("details")];
  const slideDetails = [
    {
      title: t("slideCategoryTitle"),
      description: t("slideCategoryBody")
    },
    {
      title: t("slideSpecificsTitle"),
      description: t("slideSpecificsBody")
    },
    {
      title: t("slidePlaceTitle"),
      description: t("slidePlaceBody")
    },
    {
      title: t("slideDetailsTitle"),
      description: t("slideDetailsBody")
    }
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (!editId) {
      return;
    }

    let cancelled = false;
    setEditing(true);
    fetch(`/api/plans?id=${editId}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data.request) {
          const loadedDraft = stripRequestForDraft(data.request);
          setDraft(loadedDraft);
          setSelectedCategoryId(inferCategoryId(loadedDraft));
          setGroupTypeTouched(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t("loadError"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setEditing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const stepError = useMemo(() => {
    if (step === 0) {
      if (!draft.groupProfile.numberOfPeople || draft.groupProfile.numberOfPeople < 1) {
        return t("peopleError");
      }
      if (!groupTypeTouched) {
        return t("groupTypeError");
      }
      if (!selectedCategoryId) {
        return t("categoryError");
      }
      return null;
    }

    if (step === 1) {
      const category = categoryById(selectedCategoryId);
      if (!category.occasions.includes(draft.occasion)) {
        return t("occasionError");
      }
      return null;
    }

    if (step === 2) {
      if (!draft.location.maxDistanceMiles || draft.location.maxDistanceMiles < 0.5) {
        return t("distanceError");
      }
      if (draft.location.strategy === "between_attendees") {
        const neighborhoods = draft.location.attendeeNeighborhoods ?? [];
        const enoughNeighborhoods =
          neighborhoods
            .slice(0, draft.groupProfile.numberOfPeople)
            .filter((neighborhood) => neighborhood.trim()).length >=
          draft.groupProfile.numberOfPeople;

        if (!enoughNeighborhoods) {
          return t("attendeeError");
        }
      }
      if (!draft.timeWindow.start || !draft.timeWindow.end) {
        return t("timeError");
      }
      if (new Date(draft.timeWindow.start) >= new Date(draft.timeWindow.end)) {
        return t("timeOrderError");
      }
      if (
        draft.location.strategy === "from_host" &&
        !draft.location.hostNeighborhood
      ) {
        return t("hostError");
      }
      if (
        draft.location.strategy === "target_neighborhood" &&
        !draft.location.targetNeighborhood
      ) {
        return t("targetError");
      }
      return null;
    }

    if (categoryUsesFoodDetails(selectedCategoryId) && draft.vibe.length === 0) {
      return t("vibeError");
    }
    if (draft.budgetPerPerson < 15) {
      return t("budgetError");
    }
    return null;
  }, [draft, groupTypeTouched, selectedCategoryId, step, t]);

  function updateDraft(updater: (current: Draft) => Draft) {
    setDraft((current) => updater(current));
    setError(null);
    setLocationChoices([]);
  }

  function keepPlannerPanelInView() {
    window.requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1279px)").matches) {
        plannerPanelRef.current?.scrollIntoView({
          block: "start",
          behavior: "auto"
        });
      }
    });
  }

  function nextStep() {
    if (stepError) {
      setError(stepError);
      keepPlannerPanelInView();
      return;
    }
    setStep((current) => Math.min(current + 1, stepLabels.length - 1));
    keepPlannerPanelInView();
  }

  function selectCategory(categoryId: string) {
    const category = categoryById(categoryId);
    const usesFoodDetails = categoryUsesFoodDetails(category.id);
    setSelectedCategoryId(category.id);
    updateDraft((current) => ({
      ...current,
      occasion: category.occasions[0] ?? current.occasion,
      activityPreferences: [],
      dietaryRestrictions: usesFoodDetails ? current.dietaryRestrictions : [],
      cuisinePreferences: usesFoodDetails ? current.cuisinePreferences ?? [] : [],
      vibe: usesFoodDetails ? current.vibe : []
    }));
  }

  function selectResolvedLocation(choice: LocationChoice) {
    setError(null);
    setLocationChoices([]);
    setDraft((current) => ({
      ...current,
      location: {
        ...current.location,
        resolvedLocation: choice,
        targetNeighborhood:
          current.location.strategy === "target_neighborhood"
            ? choice.label
            : current.location.targetNeighborhood,
        hostNeighborhood:
          current.location.strategy === "from_host"
            ? choice.label
            : current.location.hostNeighborhood
      }
    }));
  }

  async function submit() {
    if (stepError) {
      setError(stepError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: Draft = {
        ...draft,
        groupProfile: {
          ...draft.groupProfile,
          numberOfPeople: Number(draft.groupProfile.numberOfPeople)
        },
        location: {
          ...draft.location,
          maxDistanceMiles: Number(draft.location.maxDistanceMiles),
          attendeeSpreadMiles: Number(draft.location.attendeeSpreadMiles ?? 0),
          targetNeighborhood:
            draft.location.strategy === "from_host"
              ? draft.location.hostNeighborhood
              : draft.location.targetNeighborhood,
          attendeeNeighborhoods: resizeNeighborhoods(
            draft.location.attendeeNeighborhoods,
            draft.groupProfile.numberOfPeople
          )
        },
        budgetPerPerson: Number(draft.budgetPerPerson),
        dietaryRestrictions: categoryUsesFoodDetails(selectedCategoryId)
          ? draft.dietaryRestrictions
          : [],
        cuisinePreferences: categoryUsesFoodDetails(selectedCategoryId)
          ? draft.cuisinePreferences ?? []
          : [],
        vibe: categoryUsesFoodDetails(selectedCategoryId)
          ? draft.vibe.length > 0
            ? draft.vibe
            : ["casual"]
          : ["casual"],
        timeWindow: {
          start: new Date(draft.timeWindow.start).toISOString(),
          end: new Date(draft.timeWindow.end).toISOString(),
          localStart: draft.timeWindow.start,
          localEnd: draft.timeWindow.end
        }
      };

      const response = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (response.status === 409 && Array.isArray(data.locationChoices)) {
        setLocationChoices(data.locationChoices);
        setError(data.error ?? "Choose the location you mean.");
        setStep(2);
        return;
      }

      if (!response.ok) {
        const message =
          data.issues?.map((issue: { message: string }) => issue.message).join(" ") ??
          data.error ??
          "Unable to generate plans.";
        throw new Error(message);
      }

      saveClientSession(data);
      router.push(`/plans/${data.request.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to generate plans.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="home-stage">
      <section className="brand-hero" aria-label="Gatherwise opening">
        <div className="hero-noise" aria-hidden="true" />
        <div className="hero-ring hero-ring-one" aria-hidden="true" />
        <div className="hero-ring hero-ring-two" aria-hidden="true" />
        <div className="hero-glide hero-glide-one" aria-hidden="true">dinner</div>
        <div className="hero-glide hero-glide-two" aria-hidden="true">walk</div>
        <div className="hero-glide hero-glide-three" aria-hidden="true">memory</div>

        <div className="hero-nav">
          <Link href="/dashboard" className="hero-logo" aria-label="Open dashboard from Gatherwise hero">
            Gatherwise
          </Link>
          <LanguageToggle />
        </div>

        <div className="hero-copy">
          <p className="hero-kicker">N°000 / {t("heroKicker")}</p>
          <h1 className="hero-title">Gatherwise</h1>
          <p className="hero-subline">{t("heroSubline")}</p>
        </div>

        <div className="hero-meta">
          <span>Food</span>
          <span>Distance</span>
          <span>Vibe</span>
          <span>Memory</span>
        </div>

        <a href="#booking-mode" className="hero-scroll">
          {t("scrollForBooking")}
          <ArrowRight className="h-4 w-4 rotate-90" aria-hidden="true" />
        </a>
      </section>

      <section id="booking-mode" className="booking-stage">
        <div className="booking-topbar">
          <Link href="/dashboard" className="booking-logo" aria-label="Open dashboard from booking mode">
            Gatherwise
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageToggle />
          </div>
        </div>

        <section className="grid min-h-screen w-full grid-cols-1 gap-4 px-3 py-4 sm:gap-5 sm:px-4 lg:px-6 xl:grid-cols-[minmax(0,1fr)_clamp(300px,24vw,430px)] 2xl:gap-6 2xl:px-8">
          <div ref={plannerPanelRef} className="motion-panel min-w-0 self-start p-4 sm:p-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="editorial-kicker mb-2">
                {t("bookingMode")}
              </p>
              <h1 className="display-title max-w-3xl text-4xl leading-none text-ink sm:text-6xl">
                {t("bookingModeHeadline")}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
                {t("bookingModeIntro")}
              </p>
            </div>
            <StepHeader step={step} labels={stepLabels} />
          </div>

          {editing ? (
            <div className="mb-4 rounded-lg border border-ink/10 bg-mist px-3 py-2 text-sm font-semibold text-stone-700">
              {t("loadingPrevious")}
            </div>
          ) : null}

          <form
            className="planner-deck-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (step < stepLabels.length - 1) {
                nextStep();
              } else {
                void submit();
              }
            }}
          >
            <div className="planner-deck" aria-live="polite">
              <div
                className="planner-track"
                style={{ transform: `translate3d(-${step * 100}%, 0, 0)` }}
              >
                <SlideFrame
                  active={step === 0}
                  index={0}
                  title={slideDetails[0].title}
                  description={slideDetails[0].description}
                >
                  <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
                      <label className="space-y-2">
                        <span className="label flex items-center gap-2">
                          <Users className="h-4 w-4 text-coral" aria-hidden="true" />
                          {t("numberOfPeople")}
                        </span>
                        <input
                          className="field"
                          type="number"
                          min={0}
                          max={40}
                          placeholder="0"
                          value={draft.groupProfile.numberOfPeople}
                          onChange={(event) => {
                            const numberOfPeople = Number(event.target.value || 0);
                            updateDraft((current) => ({
                              ...current,
                              groupProfile: {
                                ...current.groupProfile,
                                numberOfPeople
                              },
                              location: {
                                ...current.location,
                                attendeeNeighborhoods: resizeNeighborhoods(
                                  current.location.attendeeNeighborhoods,
                                  numberOfPeople
                                )
                              }
                            }));
                          }}
                        />
                      </label>

                      <div className="space-y-2">
                        <span className="label">{t("typeOfPeople")}</span>
                        <ChoiceChips<GroupType>
                          values={GROUP_TYPES}
                          selected={groupTypeTouched ? draft.groupProfile.typeOfPeople : ""}
                          multi={false}
                          getLabel={label}
                          onToggle={(value) => {
                            setGroupTypeTouched(true);
                            updateDraft((current) => ({
                              ...current,
                              groupProfile: {
                                ...current.groupProfile,
                                typeOfPeople: value
                              }
                            }));
                          }}
                        />
                      </div>
                    </div>

                    <CategoryPicker
                      selectedCategoryId={selectedCategoryId}
                      onSelect={selectCategory}
                    />
                  </div>
                </SlideFrame>

                <SlideFrame
                  active={step === 1}
                  index={1}
                  title={slideDetails[1].title}
                  description={slideDetails[1].description}
                >
                  <SpecificsPicker
                    categoryId={selectedCategoryId}
                    draft={draft}
                    updateDraft={updateDraft}
                  />
                </SlideFrame>

                <SlideFrame
                  active={step === 2}
                  index={2}
                  title={slideDetails[2].title}
                  description={slideDetails[2].description}
                >
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <span className="label flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-coral" aria-hidden="true" />
                        {t("locationStrategy")}
                      </span>
                      <ChoiceChips<LocationStrategy>
                        values={LOCATION_STRATEGIES}
                        selected={draft.location.strategy}
                        multi={false}
                        getLabel={label}
                        onToggle={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            location: {
                              ...current.location,
                              strategy: value,
                              resolvedLocation: undefined,
                              targetNeighborhood:
                                value === "from_host"
                                  ? current.location.hostNeighborhood
                                  : current.location.targetNeighborhood,
                              attendeeNeighborhoods: resizeNeighborhoods(
                                current.location.attendeeNeighborhoods,
                                current.groupProfile.numberOfPeople
                              )
                            }
                          }))
                        }
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2">
                        <span className="label">{t("maxDistance")}</span>
                        <input
                          className="field"
                          type="number"
                          min={0}
                          max={50}
                          step={0.5}
                          placeholder="0"
                          value={draft.location.maxDistanceMiles}
                          onChange={(event) =>
                            updateDraft((current) => ({
                              ...current,
                              location: {
                                ...current.location,
                                maxDistanceMiles: Number(event.target.value || 0)
                              }
                            }))
                          }
                        />
                        <span className="hint">{t("distanceHint")}</span>
                      </label>

                      {draft.location.strategy === "from_host" ? (
                        <label className="space-y-2">
                          <span className="label">{t("hostNeighborhood")}</span>
                          <input
                            className="field"
                            value={draft.location.hostNeighborhood ?? ""}
                            placeholder="Downtown Palo Alto"
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                location: {
                                  ...current.location,
                                  hostNeighborhood: event.target.value,
                                  targetNeighborhood: event.target.value,
                                  resolvedLocation: undefined
                                }
                              }))
                            }
                          />
                          <span className="hint">{t("targetAuto")}</span>
                        </label>
                      ) : null}

                      {draft.location.strategy === "target_neighborhood" ? (
                        <label className="space-y-2">
                          <span className="label">{t("targetNeighborhood")}</span>
                          <input
                            className="field"
                            value={draft.location.targetNeighborhood ?? ""}
                            placeholder="Downtown Palo Alto"
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                location: {
                                  ...current.location,
                                  targetNeighborhood: event.target.value,
                                  resolvedLocation: undefined
                                }
                              }))
                            }
                          />
                      </label>
                    ) : null}

                    <LocationChoicePanel
                      choices={locationChoices}
                      onSelect={selectResolvedLocation}
                    />
                    </div>

                    {draft.location.strategy === "between_attendees" ? (
                      <div className="interactive-card space-y-3 bg-mist p-4">
                        <div>
                          <span className="label">{t("attendeeNeighborhoods")}</span>
                          <p className="hint mt-1">{t("attendeeHint")}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {resizeNeighborhoods(
                            draft.location.attendeeNeighborhoods,
                            draft.groupProfile.numberOfPeople
                          ).map((neighborhood, index) => (
                            <label key={index} className="space-y-2">
                              <span className="text-xs font-black uppercase text-stone-500">
                                {t("attendeeLabel")} {index + 1}
                              </span>
                              <input
                                className="field"
                                value={neighborhood}
                                placeholder="Downtown Palo Alto"
                                onChange={(event) =>
                                  updateDraft((current) => {
                                    const attendeeNeighborhoods = resizeNeighborhoods(
                                      current.location.attendeeNeighborhoods,
                                      current.groupProfile.numberOfPeople
                                    );
                                    attendeeNeighborhoods[index] = event.target.value;
                                    return {
                                      ...current,
                                      location: {
                                        ...current.location,
                                        attendeeNeighborhoods,
                                        resolvedLocation: undefined
                                      }
                                    };
                                  })
                                }
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2">
                        <span className="label flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-coral" aria-hidden="true" />
                          {t("start")}
                        </span>
                        <input
                          className="field"
                          type="datetime-local"
                          value={draft.timeWindow.start}
                          onChange={(event) =>
                            updateDraft((current) => ({
                              ...current,
                              timeWindow: {
                                ...current.timeWindow,
                                start: event.target.value
                              }
                            }))
                          }
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="label">{t("end")}</span>
                        <input
                          className="field"
                          type="datetime-local"
                          value={draft.timeWindow.end}
                          onChange={(event) =>
                            updateDraft((current) => ({
                              ...current,
                              timeWindow: {
                                ...current.timeWindow,
                                end: event.target.value
                              }
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                </SlideFrame>

                <SlideFrame
                  active={step === 3}
                  index={3}
                  title={slideDetails[3].title}
                  description={slideDetails[3].description}
                >
                  <div className="space-y-6">
                    <label className="space-y-2">
                      <span className="label">{t("budget")}</span>
                      <div className="flex items-center gap-3">
                        <input
                          className="field max-w-40"
                          type="number"
                          min={0}
                          max={500}
                          placeholder="0"
                          value={draft.budgetPerPerson}
                          onChange={(event) =>
                            updateDraft((current) => ({
                              ...current,
                              budgetPerPerson: Number(event.target.value || 0)
                            }))
                          }
                        />
                        <input
                          className="h-2 w-full accent-coral"
                          type="range"
                          min={0}
                          max={200}
                          value={Math.min(Math.max(draft.budgetPerPerson, 0), 200)}
                          onChange={(event) =>
                            updateDraft((current) => ({
                              ...current,
                              budgetPerPerson: Number(event.target.value)
                            }))
                          }
                        />
                      </div>
                    </label>

                    {categoryUsesFoodDetails(selectedCategoryId) ? (
                      <>
                        <div className="space-y-2">
                          <span className="label">{t("cuisine")}</span>
                          <ChoiceChips<CuisinePreference>
                            values={CUISINE_PREFERENCES}
                            selected={draft.cuisinePreferences ?? []}
                            getLabel={label}
                            onToggle={(value) =>
                              updateDraft((current) => ({
                                ...current,
                                cuisinePreferences: toggle(
                                  current.cuisinePreferences ?? [],
                                  value
                                )
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <span className="label">{t("dietary")}</span>
                          <ChoiceChips<DietaryTag>
                            values={DIETARY_TAGS}
                            selected={draft.dietaryRestrictions}
                            getLabel={label}
                            onToggle={(value) =>
                              updateDraft((current) => ({
                                ...current,
                                dietaryRestrictions: toggle(current.dietaryRestrictions, value)
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <span className="label">{t("vibe")}</span>
                          <ChoiceChips<Vibe>
                            values={VIBES}
                            selected={draft.vibe}
                            getLabel={label}
                            onToggle={(value) =>
                              updateDraft((current) => ({
                                ...current,
                                vibe: toggle(current.vibe, value)
                              }))
                            }
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                </SlideFrame>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-sm font-semibold text-coral">
                {error}
              </div>
            ) : null}

            <div className="deck-footer">
              <button
                type="button"
                className="action-secondary"
                disabled={step === 0 || loading}
                onClick={() => {
                  setStep((current) => Math.max(current - 1, 0));
                  keepPlannerPanelInView();
                }}
                title="Back"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {t("back")}
              </button>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  className="action-secondary"
                  onClick={() => {
                    setDraft(defaultDraft());
                    setSelectedCategoryId("");
                    setGroupTypeTouched(false);
                    setStep(0);
                    setError(null);
                    keepPlannerPanelInView();
                  }}
                  title="Reset"
                >
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                  {t("reset")}
                </button>

                <button
                  type="submit"
                  className="action-primary group px-5 disabled:cursor-wait"
                  disabled={loading}
                  title={step < stepLabels.length - 1 ? "Next" : "Generate plans"}
                >
                  {step < stepLabels.length - 1 ? (
                    <>
                      {t("next")}
                      <ChevronRight className="motion-arrow h-4 w-4" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      {loading ? t("generating") : t("generate")}
                      <Sparkles className="motion-arrow h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

          <aside
            className={`motion-panel min-w-0 self-start p-4 xl:sticky xl:top-6 ${
              previewQuery ? "" : "hidden xl:block"
            }`}
          >
          <div className="relative overflow-hidden rounded-lg border border-white/75 bg-mist shadow-sm">
            {previewQuery ? (
              <iframe
                key={previewQuery}
                src={googleMapEmbedUrl(previewQuery)}
                title={`${t("locationMap")}: ${previewQuery}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="aspect-[3/2] w-full border-0"
                tabIndex={-1}
              />
            ) : (
              <div className="grid aspect-[3/2] place-items-center bg-cloud px-6 text-center">
                <div>
                  <p className="display-title text-2xl text-ink">{t("mapWaiting")}</p>
                  <p className="mt-2 text-sm leading-6 text-stone-500">{t("mapWaitingHint")}</p>
                </div>
              </div>
            )}
            <div className="absolute left-3 top-3 rounded-lg border border-white/80 bg-white/75 px-3 py-2 text-xs font-black uppercase text-ink shadow-sm backdrop-blur">
              {t("locationMap")}
            </div>
            {previewQuery ? (
              <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-white/80 bg-white/80 px-3 py-2 text-xs font-bold text-stone-600 shadow-sm backdrop-blur">
                {previewQuery}
              </div>
            ) : null}
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <p className="editorial-kicker">{t("currentBrief")}</p>
              <p className="mt-1 text-sm leading-6 text-stone-600">
                {hasBrief ? (
                  <>
                    {selectedCategory ? categoryLabel(selectedCategory) : t("notSet")}{" "}
                    {t("planFor")} {draft.groupProfile.numberOfPeople}{" "}
                    {groupTypeTouched ? label(draft.groupProfile.typeOfPeople) : t("notSet")},{" "}
                    {t("around")}{" "}
                    {selectedCategory ? label(draft.occasion) : t("notSet")}
                    {categoryUsesFoodDetails(selectedCategoryId)
                      ? `, ${
                          (draft.cuisinePreferences ?? []).length > 0
                            ? `${t("cuisine")} ${draft.cuisinePreferences?.map(label).join(", ")}, `
                            : ""
                        }${t("optimizeFor")} ${
                          draft.vibe.length > 0 ? draft.vibe.map(label).join(", ") : t("notSet")
                        }`
                      : ""}{" "}
                    {t("within")} ${draft.budgetPerPerson}/person.
                  </>
                ) : (
                  t("briefPlaceholder")
                )}
              </p>
            </div>
            <div className="grid gap-2 text-sm text-stone-600">
              <div className="interactive-card flex items-center gap-3 p-3">
                <span className="arrival-mark min-h-8 text-[10px]">N°001</span>
                <span>{t("ranksFirst")}</span>
              </div>
              <div className="interactive-card flex items-center gap-3 p-3">
                <span className="arrival-mark min-h-8 text-[10px]">N°002</span>
                <span>{t("approvalFirst")}</span>
              </div>
              <div className="interactive-card flex items-center gap-3 p-3">
                <span className="arrival-mark min-h-8 text-[10px]">N°003</span>
                <span>{t("fallback")}</span>
              </div>
            </div>
          </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
