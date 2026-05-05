// ===== Categories & Types with Emojis =====
export const CATEGORY_EMOJI = {
  "Mind–Body": "🧘",
  "Dance": "💃",
  "Cardio": "🏃",
  "Strength": "🏋️",
  "Combat": "🥊",
  "Mobility": "🧎",
};

export const TYPE_EMOJI = {
  // Mind–Body
  "Yoga": "🧘",
  "Pilates": "🧘‍♂️",
  "Body Balance": "⚖️",
  "Stretch & Flow": "🌊",
  "Meditation": "🧠",
  // Dance
  "Zumba": "🎉",
  "Dance Fitness": "💃",
  "Hip-Hop Dance": "🕺",
  "Step": "🪜",
  "Cardio Dance": "🎶",
  // Cardio
  "Aerobics": "🤸",
  "HIIT": "🔥",
  "Tabata": "⏱️",
  "Spin": "🚴",
  "Bootcamp": "🎖️",
  "Cardio Circuit": "🔁",
  // Strength
  "Cross Circuit": "➕",
  "BodyPump": "🏋️",
  "Functional Training": "🧰",
  "Strength Basics": "📚",
  "Core & Abs": "🧱",
  "TRX": "🪢",
  "Kettlebell": "🏋️‍♂️",
  // Combat
  "Kickboxing": "🥊",
  "BoxFit": "🥊",
  "MMA Fitness": "🥋",
  "Self-Defense": "🛡️",
  // Mobility
  "Stretch & Recovery": "🧎",
  "Foam Rolling": "🧽",
  "Post-Workout Mobility": "♻️",
  "Active Recovery": "🌿",
};

export const GYM_CATEGORIES = [
  "Mind–Body",
  "Dance",
  "Cardio",
  "Strength",
  "Combat",
  "Mobility",
];

export const GYM_TYPES = {
  "Mind–Body": ["Yoga", "Pilates", "Body Balance", "Stretch & Flow", "Meditation"],
  "Dance": ["Zumba", "Dance Fitness", "Hip-Hop Dance", "Step", "Cardio Dance"],
  "Cardio": ["Aerobics", "HIIT", "Tabata", "Spin", "Bootcamp", "Cardio Circuit"],
  "Strength": ["Cross Circuit", "BodyPump", "Functional Training", "Strength Basics", "Core & Abs", "TRX", "Kettlebell"],
  "Combat": ["Kickboxing", "BoxFit", "MMA Fitness", "Self-Defense"],
  "Mobility": ["Stretch & Recovery", "Foam Rolling", "Post-Workout Mobility", "Active Recovery"],
};

// ===== Slot policy (same as server) =====
export function slotsForDateISO(iso) {
  const d = new Date(iso);
  const dow = d.getDay(); // 0=Sun .. 6=Sat
  if (dow === 5 || dow === 6) return []; // Fri/Sat off
  const to = dow === 4 ? 22 : 16; // Thu until 22:00
  const out = [];
  for (let h = 8; h < to; h++) out.push([fmt(h, 0), fmt(h + 1, 0)]);
  return out;
}
function fmt(h, m) { return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`; }

// ===== Rolling 30-day window (today .. today+29) =====
export function rolling30DaysBounds() {
  const today = new Date(); today.setHours(0,0,0,0);
  const min = today.toISOString().slice(0,10);
  const maxD = new Date(today); maxD.setDate(today.getDate() + 29); // inclusive
  const max = maxD.toISOString().slice(0,10);
  return { min, max };
}
