// ========== Map Setup ==========
const map = L.map("map", {
  worldCopyJump: false,
  maxBoundsViscosity: 1.0,
  maxBounds: [
    [24, -125], // Southwest corner of contiguous US
    [50, -66], // Northeast corner
  ],
}).setView([39.5, -98.35], 4); // approximate center of contiguous US, zoom level 4

const tileLayer = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  {
    attribution:
      '&copy; <a href="https://carto.com/">CARTO</a> | Fire data © NASA FIRMS',
    subdomains: "abcd",
    maxZoom: 19,
    noWrap: true,
  }
).addTo(map);

// ===== High confidence fires =====
fireData.forEach((fire) => {
  if (fire.confidence === "h") {
    L.circleMarker([fire.latitude, fire.longitude], {
      radius: Math.min(1, Math.max(0.375, fire.frp / 8)),
      color: "red",
      fillColor: "red",
      fillOpacity: 0.6,
    }).addTo(map).bindPopup(`<b>🔥 Fire Detection</b><br>
       Confidence: ${fire.confidence}<br>
       Brightness: ${fire.bright_ti4} K<br>
       FRP: ${fire.frp} MW<br>
       Day/Night: ${fire.daynight}`);
  }
});

// ===== Nominal confidence fires (start hidden) =====
const nominalFires = fireData
  .filter((f) => f.confidence === "n")
  .map((f) => {
    const circle = L.circleMarker([f.latitude, f.longitude], {
      radius: Math.min(1, Math.max(0.375, f.frp / 8)),
      color: "#090909",
      fillColor: "#090909",
      fillOpacity: 0.6,
    }).addTo(map);

    circle.bindPopup(`<b>🔥 Fire Detection</b><br>
       Confidence: ${f.confidence}<br>
       Brightness: ${f.bright_ti4} K<br>
       FRP: ${f.frp} MW<br>
       Day/Night: ${f.daynight}`);

    return { circle, activated: false };
  });

// ===== Walker Delta Satellite Constellation =====
const inclination = 56;
const totalSatellites = 500;
const planes = 100;
const satsPerPlane = totalSatellites / planes;
const phasing = 2;
const orbitalPeriod = 25 * 60 * 1000;
const angularSpeed = (2 * Math.PI) / orbitalPeriod;

let satellites = [];

function initSatellites() {
  for (let p = 0; p < planes; p++) {
    const raan = (p * 360) / planes;
    for (let s = 0; s < satsPerPlane; s++) {
      const meanAnomaly = (360 / satsPerPlane) * (s + (phasing * p) / planes);
      const marker = L.circleMarker([0, 0], {
        radius: 2,
        color: "#00ffff",
        fillColor: "#00ffff",
        fillOpacity: 0.8,
      }).addTo(map);
      satellites.push({ marker, raan, meanAnomaly });
    }
  }
}

// ===== Update satellite positions =====
function updateSatellites(time) {
  satellites.forEach((sat) => {
    const meanMotion = (time * angularSpeed * 180) / Math.PI;
    const trueAnomaly = (sat.meanAnomaly + meanMotion) % 360;
    const lat =
      (Math.asin(
        Math.sin((inclination * Math.PI) / 180) *
          Math.sin((trueAnomaly * Math.PI) / 180)
      ) *
        180) /
      Math.PI;
    const lon = ((sat.raan + trueAnomaly + 180) % 360) - 180;
    sat.marker.setLatLng([lat, lon]);
  });
}

// ===== Update nominal fire colors if satellites are near =====
function updateFireColors() {
  nominalFires.forEach((fire) => {
    if (fire.activated) return;

    for (let sat of satellites) {
      const fireLatLng = fire.circle.getLatLng();
      const satLatLng = sat.marker.getLatLng();
      const dist = map.distance(fireLatLng, satLatLng); // meters

      if (dist < 130000) {
        // 20 km
        fire.activated = true;
        fire.circle.setStyle({ color: "orange", fillColor: "orange" });
        break;
      }
    }
  });
}

// ===== Animate everything =====
function animate() {
  const now = Date.now() % orbitalPeriod;
  updateSatellites(now);
  updateFireColors();
  requestAnimationFrame(animate);
}
tileLayer.on("load", () => {
  console.log("Map tiles fully loaded, starting satellites...");
  initSatellites(); // initialize satellite markers
  animate(); // start the animation loop
});
// ===== Reset view button =====
document.getElementById("resetView").addEventListener("click", () => {
  map.setView([0, 0], 2);
});
