export const DIARY_ART = {
  journal: "/diary/diary-journal.png",
  calendar: "/diary/diary-calendar.png",
  goals: "/diary/diary-goals.png",
  tasks: "/diary/diary-tasks.png",
  budget: "/diary/diary-budget.png",
  motivation: "/diary/diary-motivation.png",
  growth: "/diary/diary-growth.png",
  business: "/diary/diary-business.png",
  empty: "/diary/diary-empty.png",
  success: "/diary/diary-success.png",
  stebo: "/diary/diary-stebo.png",
  today: "/diary/diary-today.png",
} as const;

export const DIARY_MOODS = [
  { value: "great", label: "Great", emoji: "😊" },
  { value: "good", label: "Good", emoji: "🙂" },
  { value: "okay", label: "Okay", emoji: "😐" },
  { value: "low", label: "Low", emoji: "😔" },
  { value: "rough", label: "Difficult", emoji: "😫" },
] as const;

export type DiaryMoodValue = (typeof DIARY_MOODS)[number]["value"];

export const GOAL_CATEGORIES = [
  { value: "education", label: "Education", emoji: "🎓" },
  { value: "business", label: "Business", emoji: "💼" },
  { value: "financial", label: "Financial", emoji: "💰" },
  { value: "personal", label: "Personal", emoji: "🏃" },
  { value: "life", label: "Life", emoji: "❤️" },
  { value: "other", label: "Other", emoji: "✨" },
] as const;

export const TASK_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
] as const;

export function moodMeta(value?: string | null) {
  return DIARY_MOODS.find((item) => item.value === value) || DIARY_MOODS[1];
}

export function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function firstName(name?: string | null) {
  const value = String(name || "").trim();
  if (!value) return "there";
  return value.split(/\s+/)[0];
}

export const MOTIVATION_QUOTES = [
  { text: "Small steps taken today become the path you walk tomorrow.", art: DIARY_ART.growth },
  { text: "Discipline is how dreams learn to stand on their own.", art: DIARY_ART.motivation },
  { text: "A quiet hour of honest work will outlast a loud week of delay.", art: DIARY_ART.business },
  { text: "Grow where you are planted, then plant further.", art: DIARY_ART.growth },
  { text: "Your future self is built from the pages you write now.", art: DIARY_ART.journal },
  { text: "Finish the next true thing. That is enough for today.", art: DIARY_ART.tasks },
  { text: "Wealth begins when spending tells the truth.", art: DIARY_ART.budget },
  { text: "Hold the vision gently, and move toward it daily.", art: DIARY_ART.goals },
] as const;

export function quoteForDay(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return MOTIVATION_QUOTES[day % MOTIVATION_QUOTES.length];
}

export function isSameDay(value: string | Date | null | undefined, compare = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  return date.getFullYear() === compare.getFullYear() && date.getMonth() === compare.getMonth() && date.getDate() === compare.getDate();
}

export function toDateKey(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
