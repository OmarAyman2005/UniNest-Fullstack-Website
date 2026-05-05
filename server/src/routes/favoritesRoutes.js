const express = require("express");
const router = express.Router();
const {
  ensureListForUser,
  getListByUser,
  addFavorite,
  removeFavorite,
  clearFavorites,
} = require("../models/favorites");

// GET /api/users/:userId/favorites
router.get("/users/:userId/favorites", (req, res) => {
  const userId = req.params.userId;
  if (!userId) return res.status(400).json({ message: "Missing userId" });
  const list = getListByUser(userId) || ensureListForUser(userId);
  return res.json({ data: list.items, listId: list.listId });
});

// POST /api/users/:userId/favorites
// body: { id, name?, href? }
router.post("/users/:userId/favorites", (req, res) => {
  const userId = req.params.userId;
  const item = req.body || {};
  if (!userId || !item.id) return res.status(400).json({ message: "Missing userId or item.id" });
  const list = addFavorite(userId, item);
  return res.status(201).json({ data: list.items, listId: list.listId });
});

// DELETE /api/users/:userId/favorites/:eventId
router.delete("/users/:userId/favorites/:eventId", (req, res) => {
  const { userId, eventId } = req.params;
  if (!userId || !eventId) return res.status(400).json({ message: "Missing userId or eventId" });
  const list = removeFavorite(userId, eventId);
  if (!list) return res.status(404).json({ message: "List not found" });
  return res.json({ data: list.items, listId: list.listId });
});

// DELETE /api/users/:userId/favorites  -> clear
router.delete("/users/:userId/favorites", (req, res) => {
  const userId = req.params.userId;
  if (!userId) return res.status(400).json({ message: "Missing userId" });
  const list = clearFavorites(userId);
  if (!list) return res.status(404).json({ message: "List not found" });
  return res.json({ data: list.items, listId: list.listId });
});

// optional: GET by listId
router.get("/favorites/list/:listId", (req, res) => {
  const db = require("../models/favorites"); // reuse functions
  // brute-force search
  const fs = require("fs");
  const path = require("path");
  const DB_PATH = path.join(__dirname, "..", "db.json");
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = raw ? JSON.parse(raw) : {};
    const entries = Object.values(parsed || {});
    const found = entries.find((e) => e.listId === req.params.listId);
    if (!found) return res.status(404).json({ message: "Not found" });
    return res.json({ data: found.items, listId: found.listId, userId: found.userId });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;