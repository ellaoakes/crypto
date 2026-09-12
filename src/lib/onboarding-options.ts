export const GROUP_SIZE_OPTIONS = [
  {
    key: "duo",
    emoji: "🧳",
    label: "Just me and one other",
    sublabel: "A trip for two",
  },
  {
    key: "small",
    emoji: "🎒",
    label: "A small crew",
    sublabel: "3 to 6 friends",
  },
  {
    key: "large",
    emoji: "🎉",
    label: "The whole gang",
    sublabel: "7 or more friends",
  },
] as const;

export type GroupSizeKey = (typeof GROUP_SIZE_OPTIONS)[number]["key"];

export const TRIP_LENGTH_OPTIONS = [
  {
    key: "weekend",
    emoji: "🌅",
    label: "Weekend",
    sublabel: "2–3 nights",
    minDays: 2,
    maxDays: 3,
  },
  {
    key: "long_weekend",
    emoji: "🧭",
    label: "Long weekend",
    sublabel: "4 nights",
    minDays: 4,
    maxDays: 4,
  },
  {
    key: "week",
    emoji: "🏖️",
    label: "A week",
    sublabel: "6–8 nights",
    minDays: 6,
    maxDays: 8,
  },
  {
    key: "ten_days",
    emoji: "🗺️",
    label: "10 days",
    sublabel: "9–11 nights",
    minDays: 9,
    maxDays: 11,
  },
  {
    key: "two_weeks",
    emoji: "🌍",
    label: "Two weeks",
    sublabel: "12–16 nights",
    minDays: 12,
    maxDays: 16,
  },
  {
    key: "flexible",
    emoji: "✨",
    label: "I'm flexible",
    sublabel: "Anything works",
    minDays: 2,
    maxDays: 21,
  },
] as const;

export type TripLengthKey = (typeof TRIP_LENGTH_OPTIONS)[number]["key"];

export const BUDGET_BANDS = [
  {
    key: "budget",
    emoji: "💷",
    label: "£300–500",
    sublabel: "Keeping it low-key",
    value: 400,
  },
  {
    key: "mid",
    emoji: "💷💷",
    label: "£500–800",
    sublabel: "Comfortable, not extravagant",
    value: 650,
  },
  {
    key: "comfort",
    emoji: "💷💷💷",
    label: "£800–1,200",
    sublabel: "A bit of a treat",
    value: 1000,
  },
  {
    key: "luxury",
    emoji: "💎",
    label: "£1,200+",
    sublabel: "Go all out",
    value: 1500,
  },
] as const;

export type BudgetBandKey = (typeof BUDGET_BANDS)[number]["key"];

export const TRAVEL_PREFERENCES = [
  { key: "beach", emoji: "🏖️", label: "Beach" },
  { key: "nightlife", emoji: "🍸", label: "Nightlife" },
  { key: "food", emoji: "🍜", label: "Food & drink" },
  { key: "culture", emoji: "🏛️", label: "Culture" },
  { key: "adventure", emoji: "🥾", label: "Adventure" },
  { key: "relaxation", emoji: "🧘", label: "Relaxation" },
  { key: "nature", emoji: "🌲", label: "Nature" },
  { key: "shopping", emoji: "🛍️", label: "Shopping" },
] as const;

export type TravelPreferenceKey = (typeof TRAVEL_PREFERENCES)[number]["key"];

export const TRIP_NAME_SUGGESTIONS = [
  "Sarah's Hen Do",
  "Reunion 2026",
  "Someone's 30th",
  "The Annual Lads Trip",
] as const;
