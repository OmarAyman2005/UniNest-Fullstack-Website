import dotenv from "dotenv"; dotenv.config();
import mongoose from "mongoose";
import Court from "../models/Court.js";

const uri = process.env.MONGO_URI;

// Demo courts with weekly availability
const courts = [
  {
    name: "Court 1",
    sport: "basketball",
    weeklyAvailability: [
      { dayOfWeek: 1, startTime: "10:00", endTime: "12:00" },
      { dayOfWeek: 3, startTime: "14:00", endTime: "16:00" },
    ],
  },
  {
    name: "Court 2",
    sport: "tennis",
    weeklyAvailability: [
      { dayOfWeek: 2, startTime: "09:00", endTime: "11:00" },
      { dayOfWeek: 4, startTime: "15:00", endTime: "17:00" },
    ],
  },
];

(async () => {
  try {
    await mongoose.connect(uri);
    await Court.deleteMany();
    await Court.insertMany(courts);
    console.log("✅ Courts seeded");
    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ Error seeding:", err);
    process.exit(1);
  }
})();
