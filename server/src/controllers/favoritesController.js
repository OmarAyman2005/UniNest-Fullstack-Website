const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const favoritesRouter = require("./routes/favorites");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());

app.use("/api", favoritesRouter);

// simple health
app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Favorites API listening on http://localhost:${PORT}`);
});