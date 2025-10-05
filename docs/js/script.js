// assuming you already have a Leaflet map defined as `map`

const inclination = 56; // degrees
const totalSatellites = 500;
const planes = 20;
const satsPerPlane = totalSatellites / planes;
const phasing = 1; // shift between planes
const orbitAltitude = 550; // km — just for realism
const earthRadius = 6371; // km
const orbitalPeriod = 95 * 60 * 1000; // ~95 min in ms
const angularSpeed = (2 * Math.PI) / orbitalPeriod; // radians per ms

// store all satellite markers
let satellites = [];

function initSatellites() {
  for (let p = 0; p < planes; p++) {
    const raan = (p * 360) / planes; // longitude of ascending node
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

function updateSatellites(time) {
  satellites.forEach((sat) => {
    const meanMotion = (time * angularSpeed * 180) / Math.PI; // convert rad→deg
    const trueAnomaly = (sat.meanAnomaly + meanMotion) % 360;

    const lat =
      Math.asin(
        Math.sin((inclination * Math.PI) / 180) *
          Math.sin((trueAnomaly * Math.PI) / 180)
      ) *
      (180 / Math.PI);
    const lon = ((sat.raan + trueAnomaly + 180) % 360) - 180;

    sat.marker.setLatLng([lat, lon]);
  });
}

initSatellites();

function updateFireColors() {
  nominalFires.forEach((fire) => {
    let nearSatellite = false;

    satellites.forEach((sat) => {
      const fireLatLng = fire.getLatLng();
      const satLatLng = sat.marker.getLatLng();
      const dist = map.distance(fireLatLng, satLatLng); // meters

      if (dist < 20000) {
        // within 20 km
        nearSatellite = true;
      }
    });

    fire.setStyle({
      color: nearSatellite ? "#ff9900" : "#1a1a1a",
      fillColor: nearSatellite ? "#ff9900" : "#1a1a1a",
      fillOpacity: nearSatellite ? 0.8 : 0.6,
    });
  });
}

// === 4. Make nominal fires turn orange permanently when a satellite passes within 20 km ===
function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Keep track of nominal fires and whether they’ve been activated

fireData.forEach((fire) => {
  const { latitude, longitude, confidence, frp, bright_ti4, daynight } = fire;
  const color =
    confidence === "h" ? "red" : confidence === "n" ? "#0a1929" : "yellow"; // start nominal as dark gray

  const circle = L.circleMarker([latitude, longitude], {
    radius: Math.min(1, Math.max(0.375, frp / 8)),
    color,
    fillOpacity: 0.6,
  }).addTo(map);

  if (confidence === "n") {
    nominalFires.push({ circle, latitude, longitude, activated: false });
  }

  circle.bindPopup(
    `<b>🔥 Fire Detection</b><br>
     Confidence: ${confidence}<br>
     Brightness: ${bright_ti4} K<br>
     FRP: ${frp} MW<br>
     Day/Night: ${daynight}`
  );
});

// Extend updateSatellites to also check for nearby fires
const detectionRadius = 20; // km

function updateSatellites(time) {
  satellites.forEach((sat) => {
    const meanMotion = (time * angularSpeed * 180) / Math.PI;
    const trueAnomaly = (sat.meanAnomaly + meanMotion) % 360;
    const lat =
      Math.asin(
        Math.sin((inclination * Math.PI) / 180) *
          Math.sin((trueAnomaly * Math.PI) / 180)
      ) *
      (180 / Math.PI);
    const lon = ((sat.raan + trueAnomaly + 180) % 360) - 180;

    sat.marker.setLatLng([lat, lon]);

    // Check proximity to nominal fires
    nominalFires.forEach((fire) => {
      if (!fire.activated) {
        const distance = haversine(lat, lon, fire.latitude, fire.longitude);
        if (distance < detectionRadius) {
          fire.activated = true;
          fire.circle.setStyle({ color: "orange", fillColor: "orange" });
        }
      }
    });
  });
}

function animate() {
  const now = Date.now() % orbitalPeriod;
  updateSatellites(now);
  updateFireColors(); // 🔥 make nominal fires react to nearby satellites
  requestAnimationFrame(animate);
}

animate();
