export function capSupportPriority(category, priority) {
  const cat = String(category || "").toLowerCase();
  const pri = String(priority || "normal").toLowerCase();
  if (pri === "urgent" && ["payment", "payments", "security", "account"].includes(cat)) return "urgent";
  if (pri === "high" || pri === "urgent") return "high";
  return "normal";
}
