import dotenv from "dotenv";
import mongoose from "mongoose";
import { GymSession } from "../models/GymSession.js";
import { connectDB } from "../config/db.js";

dotenv.config();

const sessions = [
  {
    title: "Morning Yoga",
    date: new Date("2025-10-08"),
    startTime: "08:00",
    endTime: "09:00",
    location: "Gym A",
    capacity: 25,
  },
  {
    title: "Evening Weight Training",
    date: new Date("2025-10-09"),
    startTime: "18:00",
    endTime: "19:30",
    location: "Gym B",
    capacity: 30,
  },
];

const seedGym = async () => {
  try {
    await connectDB();
    await GymSession.deleteMany({});
    await GymSession.insertMany(sessions);
    console.log("✅ Gym sessions seeded successfully!");
    process.exit();
  } catch (err) {
    console.error("❌ Error seeding gym sessions:", err);
    process.exit(1);
  }
};

seedGym();
