// server/src/utils/seedCourts.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Court from "../models/Court.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/acl";
const RESET = process.env.RESET === "1";

// ---------- Helpers ----------
function pad(n) {
  return String(n).padStart(2, "0");
}

// Build weeklyAvailability:
// Sun..Wed: 08:00–16:00
// Thu:     08:00–22:00  (dayOfWeek = 4)
// Fri:     14:00–16:00  (dayOfWeek = 5)
// Sat:     closed
function buildWeeklyAvailability() {
  const weekly = [];
  const standardDays = [0, 1, 2, 3]; // Sun..Wed
  for (const d of standardDays) {
    weekly.push({ dayOfWeek: d, startTime: "08:00", endTime: "16:00" });
  }
  weekly.push({ dayOfWeek: 4, startTime: "08:00", endTime: "22:00" }); // Thu
  weekly.push({ dayOfWeek: 5, startTime: "14:00", endTime: "16:00" }); // Fri
  // Sat closed → no entry
  return weekly;
}

// sprinkle some “reserved” demo slots for the next 14 days
function buildSampleReservations() {
  const today = new Date();
  const out = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const day = d.getDay();
    if (day === 6) continue; // skip Saturday

    const iso = d.toISOString().slice(0, 10);
    if (Math.random() < 0.35) {
      if (day === 5) {
        // Fri 14–16 as two 1-hr slots
        out.push({ date: iso, start: "14:00", end: "15:00" });
        out.push({ date: iso, start: "15:00", end: "16:00" });
      } else {
        const end = day === 4 ? 22 : 16; // Thu until 22
        const startHour = 8 + Math.floor(Math.random() * (end - 8));
        out.push({
          date: iso,
          start: `${pad(startHour)}:00`,
          end: `${pad(startHour + 1)}:00`,
        });
      }
    }
  }
  return out;
}

// Target set of 9 courts (emoji names)
const TARGET = [
  // Football
  { name: "⚽ Nile Pitch", sport: "football" },
  { name: "⚽ Oasis Pitch", sport: "football" },
  { name: "⚽ Pyramids Pitch", sport: "football" },

  // Basketball
  { name: "🏀 Lotus Arena", sport: "basketball" },
  { name: "🏀 Papyrus Arena", sport: "basketball" },
  { name: "🏀 Sphinx Arena", sport: "basketball" },

  // Tennis
  { name: "🎾 Palm Court", sport: "tennis" },
  { name: "🎾 Desert Rose Court", sport: "tennis" },
  { name: "🎾 Acacia Court", sport: "tennis" },
];

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected");

  const weekly = buildWeeklyAvailability();

  if (RESET) {
    console.log("🔄 RESET=1 → clearing courts collection…");
    await Court.deleteMany({});
    const docs = TARGET.map((c) => ({
      ...c,
      weeklyAvailability: weekly,
      reserved: buildSampleReservations(),
    }));
    await Court.insertMany(docs);
    const count = await Court.countDocuments();
    console.log(`✅ Seed complete (reset). Courts in DB: ${count}`);
    await mongoose.disconnect();
    return;
  }

  const existing = await Court.find().sort({ sport: 1, name: 1 }).lean();
  if (existing.length === 0) {
    const docs = TARGET.map((c) => ({
      ...c,
      weeklyAvailability: weekly,
      reserved: buildSampleReservations(),
    }));
    await Court.insertMany(docs);
    console.log("✅ Seed complete (insert fresh 9 courts).");
  } else if (existing.length === TARGET.length) {
    console.log("ℹ️ Renaming/updating existing 9 courts to new emoji names…");
    for (let i = 0; i < TARGET.length; i++) {
      const id = existing[i]._id;
      const { name, sport } = TARGET[i];
      await Court.findByIdAndUpdate(
        id,
        {
          $set: {
            name,
            sport,
            weeklyAvailability: weekly,
            reserved: buildSampleReservations(),
          },
        },
        { new: true }
      );
    }
    console.log("✅ Rename/update complete.");
  } else {
    console.log(
      `⚠️ Found ${existing.length} courts. Performing best-effort upsert by (sport,name).`
    );
    for (const t of TARGET) {
      await Court.findOneAndUpdate(
        { sport: t.sport, name: t.name },
        {
          $set: {
            weeklyAvailability: weekly,
            reserved: buildSampleReservations(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log("✅ Upsert complete.");
  }

  const after = await Court.find().sort({ name: 1 }).lean();
  console.log("Current courts:");
  after.forEach((c) => console.log(` - ${c.name} (${c.sport})`));

  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
