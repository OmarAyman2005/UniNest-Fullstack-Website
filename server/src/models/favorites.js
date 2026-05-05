const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");

const DB_PATH = path.join(__dirname, "..", "db.json");

function loadDb() {
  try {
    if (!fs.existsSync(DB_PATH)) return {};
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Failed to read db:", err);
    return {};
  }
}

function saveDb(db) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write db:", err);
  }
}

function ensureListForUser(userId) {
  const db = loadDb();
  if (!db[userId]) {
    db[userId] = {
      listId: nanoid(),
      userId: String(userId),
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
  }
  return db[userId];
}

function getListByUser(userId) {
  const db = loadDb();
  return db[userId] || null;
}

function addFavorite(userId, item) {
  const db = loadDb();
  const list = db[userId] || ensureListForUser(userId);
  // item should at least have id,name,href
  if (!item || !item.id) return list;
  const exists = list.items.some((i) => String(i.id) === String(item.id));
  if (!exists) {
    list.items.unshift({
      id: String(item.id),
      name: item.name || "Event",
      href: item.href || `/events/${item.id}`,
      addedAt: new Date().toISOString(),
    });
    list.updatedAt = new Date().toISOString();
    db[userId] = list;
    saveDb(db);
  }
  return list;
}

function removeFavorite(userId, eventId) {
  const db = loadDb();
  const list = db[userId];
  if (!list) return null;
  const next = list.items.filter((i) => String(i.id) !== String(eventId));
  list.items = next;
  list.updatedAt = new Date().toISOString();
  db[userId] = list;
  saveDb(db);
  return list;
}

function clearFavorites(userId) {
  const db = loadDb();
  if (!db[userId]) return null;
  db[userId].items = [];
  db[userId].updatedAt = new Date().toISOString();
  saveDb(db);
  return db[userId];
}

module.exports = {
  ensureListForUser,
  getListByUser,
  addFavorite,
  removeFavorite,
  clearFavorites,
};