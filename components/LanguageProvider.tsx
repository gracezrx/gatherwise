"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { EXPERIENCE_CATEGORIES } from "@/lib/types";
import { toTitle } from "@/lib/utils";

type Language = "en" | "zh";

const translations = {
  en: {
    brandSubtitle: "Transparent agentic planning",
    plan: "Plan",
    dashboard: "Dashboard",
    mockMode: "Mock booking mode. No third-party websites are scraped or automated.",
    category: "Category",
    specifics: "Specifics",
    placeTime: "Place & time",
    details: "Details",
    agenticPlanning: "Agentic social planning",
    introOpening: "Social planning, opening",
    introLine: "Enter details and review ranked plans.",
    introPeople: "people",
    introPlace: "place",
    introMood: "mood",
    skip: "Skip",
    heroKicker: "Social planning",
    heroSubline: "Enter the people, location, time, budget, and preferences.",
    scrollForBooking: "Scroll for booking mode",
    homeHeadline: "Plan a group outing.",
    bookingMode: "Planning form",
    bookingModeHeadline: "Create a plan.",
    bookingModeIntro: "Enter the details. The app ranks plans, waits for approval, and then attempts booking.",
    slideCategoryTitle: "People and plan type",
    slideCategoryBody: "Enter how many people are going, who they are, and the main activity category.",
    slideSpecificsTitle: "Occasion and activities",
    slideSpecificsBody: "Choose the occasion and any activities the group wants to do.",
    slidePlaceTitle: "Location and time",
    slidePlaceBody: "Choose the location strategy, neighborhood, distance, and date/time window.",
    slideDetailsTitle: "Budget and preferences",
    slideDetailsBody: "Set the budget, dietary restrictions, and vibe.",
    intro: "Answer a few quick questions, then review ranked restaurant and activity plans.",
    loadingPrevious: "Loading your previous constraints...",
    numberOfPeople: "Number of people",
    typeOfPeople: "Type of people",
    whatKind: "Choose a category",
    categoryHint: "Choose the main type of plan. You will pick the specific occasion next.",
    occasionQuestion: "What is the occasion?",
    addons: "Activity preferences",
    addonsHint: "Optional. Pick what the group wants to do.",
    otherGeneral: "Other",
    otherGeneralHint: "Use this if none of the specific choices fit. It searches broadly within this category.",
    otherGeneralChoice: "Other / General",
    locationStrategy: "Location strategy",
    maxDistance: "Max distance",
    distanceHint: "Miles from selected anchor.",
    hostNeighborhood: "Host neighborhood",
    targetNeighborhood: "Target neighborhood",
    targetAuto: "Target neighborhood is automatically matched to the host.",
    attendeeNeighborhoods: "Attendee neighborhoods",
    attendeeHint: "Add one neighborhood for each person going.",
    attendeeLabel: "Person",
    start: "Start",
    end: "End",
    budget: "Budget per person",
    cuisine: "Cuisine",
    dietary: "Dietary restrictions",
    vibe: "Vibe",
    back: "Back",
    reset: "Reset",
    next: "Next",
    generate: "Generate plans",
    generating: "Generating...",
    saving: "Saving...",
    close: "Close",
    currentBrief: "Current request",
    paloAltoCanvas: "Palo Alto map",
    locationMap: "Location map",
    ranksFirst: "Ranks options before asking for approval.",
    approvalFirst: "Attempts booking only after explicit approval.",
    fallback: "Falls back through approved plans in ranked order.",
    peopleError: "Add at least one person.",
    categoryError: "Choose a plan category.",
    occasionError: "Choose the occasion.",
    attendeeError: "Add a neighborhood for each attendee.",
    timeError: "Choose a date/time window.",
    timeOrderError: "End time must be after start time.",
    targetError: "Add a target neighborhood.",
    hostError: "Add a host neighborhood.",
    vibeError: "Choose at least one vibe.",
    budgetError: "Budget should be at least $15/person.",
    loadError: "Could not load that prior request. You can still start fresh.",
    planFor: "plan for",
    around: "around",
    optimizeFor: "optimize for",
    within: "within"
  },
  zh: {
    brandSubtitle: "透明的智能社交规划",
    plan: "规划",
    dashboard: "面板",
    mockMode: "模拟预订模式。不抓取或自动操作第三方网站。",
    category: "类别",
    specifics: "细节",
    placeTime: "地点和时间",
    details: "偏好",
    agenticPlanning: "智能社交规划",
    introOpening: "社交规划，正在打开",
    introLine: "填写信息，然后查看排序后的方案。",
    introPeople: "人",
    introPlace: "地点",
    introMood: "氛围",
    skip: "跳过",
    heroKicker: "社交规划",
    heroSubline: "填写人数、地点、时间、预算和偏好。",
    scrollForBooking: "向下进入预订模式",
    homeHeadline: "规划一次多人出行。",
    bookingMode: "规划表单",
    bookingModeHeadline: "创建计划。",
    bookingModeIntro: "填写具体信息。应用会排序方案、等待确认，然后尝试预订。",
    slideCategoryTitle: "人数和计划类型",
    slideCategoryBody: "填写人数、同行关系，以及主要活动类别。",
    slideSpecificsTitle: "场合和活动",
    slideSpecificsBody: "选择具体场合，以及想做的活动。",
    slidePlaceTitle: "地点和时间",
    slidePlaceBody: "选择地点策略、街区、距离和日期时间范围。",
    slideDetailsTitle: "预算和偏好",
    slideDetailsBody: "设置预算、饮食限制和氛围。",
    intro: "回答几个简单问题，然后查看餐厅和活动的排序方案。",
    loadingPrevious: "正在加载之前的条件...",
    numberOfPeople: "人数",
    typeOfPeople: "同行关系",
    whatKind: "选择类别",
    categoryHint: "选择主要计划类型。下一步再选具体场合。",
    occasionQuestion: "具体是什么场合？",
    addons: "活动偏好",
    addonsHint: "可选。选择这群人想做的活动。",
    otherGeneral: "其他",
    otherGeneralHint: "如果上面的具体选项不合适，选择这里。它会在这个类别内更广泛地搜索。",
    otherGeneralChoice: "其他 / 通用",
    locationStrategy: "地点策略",
    maxDistance: "最大距离",
    distanceHint: "距离所选中心点的英里数。",
    hostNeighborhood: "主人所在街区",
    targetNeighborhood: "目标街区",
    targetAuto: "目标街区会自动使用主人所在街区。",
    attendeeNeighborhoods: "每位参加者所在街区",
    attendeeHint: "每个人填写一个街区。",
    attendeeLabel: "第",
    start: "开始时间",
    end: "结束时间",
    budget: "每人预算",
    cuisine: "菜系",
    dietary: "饮食限制",
    vibe: "氛围",
    back: "返回",
    reset: "重置",
    next: "下一步",
    generate: "生成方案",
    generating: "生成中...",
    saving: "正在保存...",
    close: "关闭",
    currentBrief: "当前请求",
    paloAltoCanvas: "Palo Alto 地图",
    locationMap: "地点地图",
    ranksFirst: "先排序方案，再让你确认。",
    approvalFirst: "只有明确同意后才尝试预订。",
    fallback: "会按排名顺序尝试备用方案。",
    peopleError: "请至少添加 1 人。",
    categoryError: "请选择活动类别。",
    occasionError: "请选择具体场合。",
    attendeeError: "请为每位参加者填写一个街区。",
    timeError: "请选择日期和时间范围。",
    timeOrderError: "结束时间必须晚于开始时间。",
    targetError: "请填写目标街区。",
    hostError: "请填写主人所在街区。",
    vibeError: "请至少选择一种氛围。",
    budgetError: "预算至少需要每人 $15。",
    loadError: "无法加载之前的条件。你仍然可以重新开始。",
    planFor: "计划，人数",
    around: "场合",
    optimizeFor: "偏好氛围",
    within: "预算"
  }
} as const;

const valueLabels: Record<Language, Record<string, string>> = {
  en: {
    food_drink_general: "Other / General",
    bbq: "BBQ",
    arts_culture_general: "Other / General",
    entertainment_general: "Other / General",
    active_general: "Other / General",
    games_general: "Other / General",
    exploration_general: "Other / General",
    home_general: "Other / General"
  },
  zh: {
    friends: "朋友",
    coworkers: "同事",
    family: "家人",
    date: "约会",
    clients: "客户",
    "mixed group": "混合人群",
    dinner: "晚餐",
    brunch: "早午餐",
    coffee_catchup: "咖啡见面",
    dessert_run: "甜点小聚",
    birthday: "生日",
    celebration: "庆祝",
    anniversary: "纪念日",
    date_night: "约会夜",
    team_dinner: "团队晚餐",
    client_meal: "客户餐叙",
    museum_day: "博物馆日",
    gallery_day: "画廊日",
    campus_visit: "校园参观",
    sightseeing: "观光",
    date_day: "白天约会",
    family_day: "家庭日",
    learning_day: "学习体验日",
    parents_visiting: "父母来访",
    night_out: "夜间外出",
    casual_hangout: "轻松聚会",
    team_outing: "团队活动",
    after_work_hangout: "下班小聚",
    double_date: "双人约会",
    outdoor_day: "户外日",
    casual_workout: "轻运动",
    wellness_day: "身心放松日",
    weekend_plan: "周末计划",
    group_night: "小组夜晚",
    local_discovery: "本地探索",
    tourist_day: "游客日",
    low_key_meetup: "低调见面",
    rainy_day_plan: "雨天计划",
    kids_outing: "儿童出行",
    between_attendees: "按参加者中间位置",
    from_host: "从主人出发",
    target_neighborhood: "指定目标街区",
    quiet: "安静",
    lively: "热闹",
    upscale: "精致",
    casual: "休闲",
    outdoors: "户外",
    "kid-friendly": "适合孩子",
    vegetarian: "素食",
    vegan: "纯素",
    "gluten-free": "无麸质",
    "dairy-free": "无乳制品",
    "nut-free": "无坚果",
    halal: "清真",
    kosher: "犹太洁食",
    pescatarian: "鱼素",
    food_drink_general: "其他 / 通用",
    bbq: "烧烤",
    coffee: "咖啡",
    dessert: "甜点",
    tasting_menu: "品尝菜单",
    casual_dining: "轻松用餐",
    fine_dining: "精致餐厅",
    food_hall: "美食广场",
    picnic: "野餐",
    bar: "酒吧",
    cocktails: "鸡尾酒",
    wine_bar: "葡萄酒吧",
    arts_culture_general: "其他 / 通用",
    art: "艺术",
    museum: "博物馆",
    gallery: "画廊",
    history: "历史",
    architecture: "建筑",
    cultural_site: "文化地点",
    public_art: "公共艺术",
    campus_walk: "校园散步",
    class: "课程",
    workshop: "工作坊",
    entertainment_general: "其他 / 通用",
    live_music: "现场音乐",
    concert: "音乐会",
    comedy: "喜剧",
    theater: "剧场",
    movie: "电影",
    karaoke: "卡拉 OK",
    nightclub: "夜店",
    dancing: "跳舞",
    lounge: "酒廊",
    late_night: "深夜活动",
    active_general: "其他 / 通用",
    walk: "散步",
    hiking: "徒步",
    biking: "骑行",
    yoga: "瑜伽",
    pickleball: "匹克球",
    sports: "运动",
    park: "公园",
    garden: "花园",
    beach: "海边",
    scenic_view: "风景点",
    games_general: "其他 / 通用",
    games: "游戏",
    board_games: "桌游",
    arcade: "电玩",
    bowling: "保龄球",
    trivia: "问答游戏",
    mini_golf: "迷你高尔夫",
    escape_room: "密室逃脱",
    pool: "台球",
    ping_pong: "乒乓",
    exploration_general: "其他 / 通用",
    landmarks: "地标",
    walking_tour: "步行导览",
    neighborhood_exploring: "街区探索",
    local_gems: "本地宝藏",
    shopping: "逛街",
    bookstore: "书店",
    farmers_market: "农贸市场",
    vintage: "复古小店",
    home_general: "其他 / 通用",
    low_key: "低调轻松",
    cozy: "温馨",
    private: "私密",
    home_dinner: "家中晚餐",
    takeout: "外卖",
    potluck: "百乐餐",
    movie_night: "电影夜",
    backyard: "后院",
    "Food & Drink": "美食与饮品",
    "Arts, Culture & Learning": "艺术、文化与学习",
    "Entertainment & Nightlife": "娱乐与夜生活",
    "Active & Outdoors": "运动与户外",
    "Games & Interactive": "游戏与互动",
    "Exploration & Shopping": "探索与购物",
    "Home & Low-Key": "居家与低调"
  }
};

const categoryDescriptions: Record<Language, Record<string, string>> = {
  en: {},
  zh: {
    food_drink: "餐厅、咖啡、甜点、早午餐、饮品、品尝、美食广场和野餐等以吃喝为中心的计划。",
    arts_culture_learning: "博物馆、画廊、展览、公共艺术、建筑、文化地点、课程和工作坊。",
    entertainment_nightlife: "现场音乐、喜剧、剧场、电影、酒吧、酒廊、跳舞、卡拉 OK 和高能量夜间活动。",
    active_outdoors: "轻运动、公园、徒步、海边、运动、花园、风景散步和身心放松型户外计划。",
    games_interactive: "围绕游戏、竞争、合作或互动参与展开的社交活动。",
    exploration_shopping: "观光、街区探索、校园散步、地标、市场、书店、精品店和复古购物。",
    home_low_key: "私密、休闲、灵活或慢节奏的计划，包括家中晚餐、外卖、电影夜、百乐餐、后院聚会和轻松亲子安排。"
  }
};

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: keyof typeof translations.en) => string;
  label: (value: string) => string;
  categoryLabel: (category: (typeof EXPERIENCE_CATEGORIES)[number]) => string;
  categoryDescription: (category: (typeof EXPERIENCE_CATEGORIES)[number]) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("gatherwise-language");
    if (stored === "zh" || stored === "en") {
      setLanguageState(stored);
    }
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    function setLanguage(nextLanguage: Language) {
      setLanguageState(nextLanguage);
      window.localStorage.setItem("gatherwise-language", nextLanguage);
    }

    return {
      language,
      setLanguage,
      t: (key) => translations[language][key] ?? translations.en[key],
      label: (rawValue) => valueLabels[language][rawValue] ?? toTitle(rawValue),
      categoryLabel: (category) =>
        valueLabels[language][category.label] ?? category.label,
      categoryDescription: (category) =>
        categoryDescriptions[language][category.id] ?? category.description
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="inline-flex rounded-lg border border-white/70 bg-white/70 p-1 text-xs font-black text-stone-600 shadow-sm backdrop-blur">
      <button
        type="button"
        className={`min-h-8 rounded-md px-3 transition duration-200 ease-smooth active:scale-[0.96] ${
          language === "en" ? "bg-coral text-ink shadow-sm" : "hover:bg-mist hover:text-ink"
        }`}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={`min-h-8 rounded-md px-3 transition duration-200 ease-smooth active:scale-[0.96] ${
          language === "zh" ? "bg-coral text-ink shadow-sm" : "hover:bg-mist hover:text-ink"
        }`}
        onClick={() => setLanguage("zh")}
      >
        中文
      </button>
    </div>
  );
}
