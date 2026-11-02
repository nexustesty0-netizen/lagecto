import { BRAND, CONTACT } from "@/lib/brand";

export type SteboKnowledge = { title: string; body: string; section: string };
export type SteboExample = { prompt: string; response: string };

export const STEBO_PERSONAL_PROMPT = `You are Stebo Personal — LaGecto's friendly AI companion for everyday life.
Named after founders Stenford and Bonguthando. Be warm, thoughtful, and culturally aware.
Default to natural conversation. Only give plans or advice when the user asks or agrees.`;

export const STEBO_BUSINESS_PROMPT = `You are Stebo Business — LaGecto's expert AI consultant for African entrepreneurs.
Help with strategy, marketing, sales, operations, inventory, finance and growth.
Stay conversational unless the user asks for analysis or a plan. Use the shop context when provided.`;

export const STEBO_ADMIN_PROMPT = `You are Stebo Admin Intelligence for the LaGecto internal team.
Be data-driven, concise, and aligned with platform operations, shops, security and support.`;

export const STEBO_DIARY_PROMPT = `You are Stebo inside Smart Diary. Help with journaling, goals, habits and reflection.
Do not mix this user's diary with anyone else's.`;

export const STEBO_BUILTIN_KNOWLEDGE: SteboKnowledge[] = [
  {
    section: "base",
    title: "What is LaGecto",
    body: `${BRAND.name} is a digital marketplace in ${BRAND.location}. ${BRAND.description} Customers browse shops, add to cart, and check out on WhatsApp. Shop owners run products, orders, POS and finances from their dashboard.`,
  },
  {
    section: "base",
    title: "Who is Stebo",
    body: "Stebo is LaGecto’s in-app helper, named after founders Stenford and Bonguthando. Customers can ask about shopping. Shop owners can ask about running the shop. Diary and admin have their own Stebo views.",
  },
  {
    section: "ordering",
    title: "How to order",
    body: "Browse the marketplace or a shop, add products to your cart, then check out via WhatsApp. You can order without an account if you add your name. Signed-in customers also get order history. Payment is arranged directly with the shop.",
  },
  {
    section: "payments",
    title: "Payments",
    body: "LaGecto does not collect customer checkout payments. Marketplace orders check out on WhatsApp. You and the shop agree how to pay. POS is for walk-in sales the shop records in person.",
  },
  {
    section: "delivery",
    title: "Collection and pickup",
    body: "Arrange collection or delivery with the shop on WhatsApp after you place the order. Check the shop page before you order.",
  },
  {
    section: "account",
    title: "Sign in",
    body: "Customers and admins sign in with email and password. Shop owners sign in with Shop ID and password.",
  },
  {
    section: "account",
    title: "Locked account",
    body: `After several failed logins an account can be locked. Contact LaGecto Support on ${CONTACT.phoneDisplay} or ${CONTACT.email} so an administrator can restore access.`,
  },
  {
    section: "general",
    title: "Support",
    body: `LaGecto Support: ${CONTACT.phoneDisplay}, ${CONTACT.email}, or WhatsApp from the Support page.`,
  },
  {
    section: "shops",
    title: "Register a shop",
    body: "Open Register a shop, create the shop, then add products. You can start on Free. Thabi, Kristen and Sandra add verified listing and extra tools while the subscription is current.",
  },
  {
    section: "lagecto",
    title: "Packages",
    body: "Free shops stay usable. Thabi is the essential storefront package. Kristen adds branding, blogs, staff tools and Smart Diary Pro. Sandra includes everything in Kristen plus analytics and advanced POS and inventory.",
  },
  {
    section: "pos",
    title: "Point of sale",
    body: "Shop POS records walk-in sales, stock and receipts. Marketplace customer orders still go through WhatsApp checkout.",
  },
];

const TOPIC_HINTS: Array<{ keys: string[]; extra: string }> = [
  { keys: ["pay", "paid", "payment", "cash", "money", "price"], extra: "payment checkout whatsapp pos" },
  { keys: ["order", "cart", "buy", "checkout", "whatsapp"], extra: "order cart checkout whatsapp" },
  { keys: ["shop", "store", "seller", "register", "open"], extra: "shop register packages" },
  { keys: ["login", "signin", "password", "account", "locked"], extra: "sign login account locked" },
  { keys: ["help", "support", "contact", "phone", "email"], extra: "support contact" },
  { keys: ["collect", "pickup", "delivery", "deliver"], extra: "collection pickup delivery" },
  { keys: ["pos", "till", "walk-in", "walkin"], extra: "pos sale" },
  { keys: ["package", "thabi", "kristen", "sandra", "subscribe"], extra: "packages thabi kristen sandra" },
  { keys: ["stebo", "who", "you"], extra: "stebo helper" },
  { keys: ["lagecto", "marketplace"], extra: "lagecto marketplace" },
];

export function promptForMode(mode: string) {
  if (mode === "admin") return STEBO_ADMIN_PROMPT;
  if (mode === "diary") return STEBO_DIARY_PROMPT;
  if (mode.startsWith("business") || ["marketing", "sales", "inventory", "customers", "general"].includes(mode)) {
    return STEBO_BUSINESS_PROMPT;
  }
  return STEBO_PERSONAL_PROMPT;
}

function words(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((word) => word.length > 1);
}

export function retrieve(question: string, knowledge: SteboKnowledge[], examples: SteboExample[]) {
  const q = question.toLowerCase();
  const hinted = TOPIC_HINTS.reduce((acc, topic) => (topic.keys.some((key) => q.includes(key)) ? `${acc} ${topic.extra}` : acc), q);
  const tokens = [...new Set(words(hinted))];
  const scored = knowledge
    .map((row) => {
      const hay = `${row.title} ${row.body} ${row.section}`.toLowerCase();
      const hits = tokens.filter((word) => hay.includes(word)).length;
      return { row, hits };
    })
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  const example = examples.find((item) => {
    const prompt = item.prompt.toLowerCase();
    return q.includes(prompt.slice(0, 24)) || words(prompt).filter((word) => q.includes(word)).length >= 2;
  });

  return { snippets: scored.slice(0, 3).map((item) => item.row), example };
}

function greetingReply(name: string, mode: string) {
  if (mode === "diary") return `Hi, I'm ${name}. What’s on your mind today? We can talk through a journal note, a goal, or how the week is going.`;
  if (mode === "admin") return `Hi, I'm ${name}. Ask about shops, users, support, packages, or how the platform is set up.`;
  if (mode.startsWith("business") || ["marketing", "sales", "inventory", "customers", "general"].includes(mode)) {
    return `Hi, I'm ${name}. I can help with this shop — sales, stock, marketing, customers, and day-to-day operations.`;
  }
  return `Hi, I'm ${name}. I can help you find shops, place an order, or answer questions about LaGecto.`;
}

function defaultReply(name: string, mode: string) {
  if (mode === "diary") {
    return `I'm here with you in Smart Diary. Tell me what you want to write about, a habit to keep, or a goal to set. I only see your diary, not anyone else's.`;
  }
  if (mode === "admin") {
    return `I can help with platform work: shops, users, support, packages, and how LaGecto is meant to run. Ask a specific question and I’ll answer from what I know.`;
  }
  if (mode.startsWith("business") || ["marketing", "sales", "inventory", "customers", "general"].includes(mode)) {
    return `I can help you run the shop: products, POS, stock, orders, and getting customers. Tell me what you want to work on.`;
  }
  return `I'm ${name}. Ask me about shops, orders, WhatsApp checkout, or your LaGecto account. For a person, call ${CONTACT.phoneDisplay} or email ${CONTACT.email}.`;
}

export function localReply(
  message: string,
  snippets: SteboKnowledge[],
  example: SteboExample | undefined,
  personalityName: string,
  mode: string,
) {
  if (example) return example.response;
  const q = message.toLowerCase().trim();
  if (/^(hi|hello|hey|howzit|sawubona|mhoro|hiya)[\s!?.]*$/.test(q) || /^(how are you)[\s!?.]*$/.test(q)) {
    return greetingReply(personalityName, mode);
  }
  if (/\b(who are you|what are you|your name)\b/.test(q)) {
    return `I'm ${personalityName}, LaGecto’s helper — named after Stenford and Bonguthando. ${defaultReply(personalityName, mode)}`;
  }
  if (snippets.length) {
    const first = snippets[0].body;
    const rest = snippets
      .slice(1)
      .map((row) => row.body)
      .filter((body) => body !== first);
    return rest.length ? `${first}\n\n${rest.join("\n\n")}` : first;
  }
  if (/\b(thank|thanks|ngiyabonga|tatenda)\b/.test(q)) {
    return "You’re welcome. Ask anytime.";
  }
  return defaultReply(personalityName, mode);
}

export const STEBO_MORNING_QUOTES = [
  "Sell one more today than yesterday. That is how a shop grows.",
  "A customer who feels seen comes back with a friend.",
  "Count the stock before you count the dream.",
  "Open the till with a clear head. Close it with honest numbers.",
  "WhatsApp is your shop window. Reply while they are still looking.",
  "A quiet morning of restocking beats a loud afternoon of guessing.",
  "Price fairly. Service warmly. That is the whole plan.",
  "The best promotion is a product that is actually in stock.",
  "Payroll and expenses wait. Sales do not. Start with the floor.",
  "Khula nathi. Serve one customer as if they own the street.",
  "Write down what sold. Memory is a weak bookkeeper.",
  "A clean counter and a fast greeting are free advertising.",
  "Do not wait for a busy day. Make a small offer and send it.",
  "Kura nesu. Look after today’s cash, and tomorrow has room to grow.",
] as const;

export function steboMorningQuote(date = new Date()) {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const day = Number(key.replaceAll("-", ""));
  const text = STEBO_MORNING_QUOTES[Math.abs(day) % STEBO_MORNING_QUOTES.length];
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Harare", hour: "numeric", hour12: false }).format(date),
  );
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return { text, greeting, dateKey: key };
}
