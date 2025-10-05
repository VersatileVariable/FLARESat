// server.js
import express from "express";
import fetch from "node-fetch";
import Papa from "papaparse";

const app = express();
const PORT = 3000;

// Serve frontend files from "public" folder
app.use(express.static("public"));

// FIRMS API URL
const FIRMS_URL =
  "https://firms.modaps.eosdis.nasa.gov/api/area/csv/10b58364191b0990ac92ee362509091c/VIIRS_SNPP_NRT/world/1/2025-10-04";

app.get("/fires", async (req, res) => {
  try {
    const resp = await fetch(FIRMS_URL);
    if (!resp.ok) throw new Error(`FIRMS error: ${resp.statusText}`);

    const csvText = await resp.text();

    // Parse CSV -> JSON
    const parsed = Papa.parse(csvText, { header: true, dynamicTyping: true });

    // Filter out low confidence fires ("l")
    const filtered = parsed.data.filter(
      (f) =>
        f.confidence &&
        (f.confidence.toLowerCase() === "n" ||
          f.confidence.toLowerCase() === "h")
    );

    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
