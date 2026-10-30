export type DiaryMode = "life" | "business" | "admin";

export const DIARY_MODULES = [
  { slug: "hub", title: "Home", blurb: "Your day at a glance" },
  { slug: "journal", title: "Journal", blurb: "Write what matters" },
  { slug: "tasks", title: "Tasks", blurb: "What needs doing" },
  { slug: "calendar", title: "Calendar", blurb: "Events and dates" },
  { slug: "goals", title: "Goals", blurb: "Progress you care about" },
  { slug: "budget", title: "Budget", blurb: "Income, spending and balance" },
  { slug: "business", title: "Business", blurb: "Work notes, ideas and goals" },
  { slug: "motivation", title: "Motivation", blurb: "A spark for the day" },
  { slug: "briefing", title: "Briefing", blurb: "Start the day with a short note" },
  { slug: "chat", title: "Chat", blurb: "Talk with Stebo inside the diary" },
  { slug: "write", title: "Write", blurb: "Longer entries" },
  { slug: "habits", title: "Habits", blurb: "Daily streaks" },
  { slug: "mood", title: "Mood", blurb: "How you feel" },
  { slug: "vision", title: "Vision", blurb: "Where you want to go" },
  { slug: "timeline", title: "Timeline", blurb: "A mixed history" },
  { slug: "memory", title: "Memory", blurb: "Moments to keep" },
  { slug: "growth", title: "Growth", blurb: "Lessons and progress" },
  { slug: "insights", title: "Insights", blurb: "Patterns from your diary" },
  { slug: "reflections", title: "Reflections", blurb: "Prompts and answers" },
  { slug: "weekly", title: "Weekly review", blurb: "Look back on the week" },
] as const;

export const ADVANCED_DIARY = new Set([
  "briefing",
  "chat",
  "habits",
  "budget",
  "mood",
  "vision",
  "timeline",
  "memory",
  "growth",
  "insights",
  "reflections",
  "weekly",
  "write",
]);

export const DIARY_PRIMARY = ["hub", "journal", "tasks", "calendar", "goals", "budget", "business"] as const;

export function diaryBasePath(role: string) {
  if (role === "admin") return "/admin/diary";
  if (role === "shop_owner") return "/shop/diary";
  return "/customer/diary";
}

export function diaryModeForRole(role: string): DiaryMode {
  if (role === "admin") return "admin";
  if (role === "shop_owner") return "business";
  return "life";
}
