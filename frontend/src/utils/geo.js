// src/utils/geo.js
// Coastal gazetteer and reverse geocoding utilities for Indian maritime waters

export const INDIAN_COASTAL_HUBS = [
  // West Coast - Kerala
  { name: 'Kochi Fisheries Harbor', shortName: 'Kochi', state: 'Kerala', lat: 9.9312, lon: 76.2673 },
  { name: 'Munambam Fishing Harbor', shortName: 'Munambam', state: 'Kerala', lat: 10.1833, lon: 76.1750 },
  { name: 'Neendakara / Kollam', shortName: 'Kollam', state: 'Kerala', lat: 8.9400, lon: 76.5400 },
  { name: 'Beypore / Kozhikode', shortName: 'Kozhikode', state: 'Kerala', lat: 11.1600, lon: 75.8000 },
  { name: 'Kannur Coast', shortName: 'Kannur', state: 'Kerala', lat: 11.8700, lon: 75.3500 },
  { name: 'Vizhinjam Port', shortName: 'Vizhinjam', state: 'Kerala', lat: 8.3800, lon: 76.9900 },

  // West Coast - Karnataka & Goa
  { name: 'Mangalore Old Port', shortName: 'Mangalore', state: 'Karnataka', lat: 12.8600, lon: 74.8300 },
  { name: 'Malpe Harbor', shortName: 'Malpe', state: 'Karnataka', lat: 13.3500, lon: 74.7000 },
  { name: 'Karwar Port', shortName: 'Karwar', state: 'Karnataka', lat: 14.8000, lon: 74.1200 },
  { name: 'Marmagao / Panaji', shortName: 'Goa', state: 'Goa', lat: 15.4100, lon: 73.8000 },

  // West Coast - Maharashtra
  { name: 'Ratnagiri Mirkarwada Harbor', shortName: 'Ratnagiri', state: 'Maharashtra', lat: 16.9800, lon: 73.2800 },
  { name: 'Malvan Coast', shortName: 'Malvan', state: 'Maharashtra', lat: 16.0500, lon: 73.4600 },
  { name: 'Sassoon Dock, Mumbai', shortName: 'Mumbai', state: 'Maharashtra', lat: 18.9100, lon: 72.8200 },
  { name: 'Versova, Mumbai', shortName: 'Versova', state: 'Maharashtra', lat: 19.1300, lon: 72.8000 },
  { name: 'Dahanu Coast', shortName: 'Dahanu', state: 'Maharashtra', lat: 19.9700, lon: 72.7300 },

  // West Coast - Gujarat
  { name: 'Veraval Fishing Harbor', shortName: 'Veraval', state: 'Gujarat', lat: 20.9000, lon: 70.3600 },
  { name: 'Porbandar Port', shortName: 'Porbandar', state: 'Gujarat', lat: 21.6400, lon: 69.6000 },
  { name: 'Okha / Dwarka', shortName: 'Okha', state: 'Gujarat', lat: 22.4600, lon: 69.0700 },
  { name: 'Kandla / Gulf of Kutch', shortName: 'Kandla', state: 'Gujarat', lat: 23.0000, lon: 70.2100 },
  { name: 'Jakhau Port', shortName: 'Jakhau', state: 'Gujarat', lat: 23.2300, lon: 68.6100 },

  // East Coast - Tamil Nadu & Puducherry
  { name: 'Kanyakumari Coast', shortName: 'Kanyakumari', state: 'Tamil Nadu', lat: 8.0800, lon: 77.5500 },
  { name: 'Tuticorin V.O.C. Port', shortName: 'Tuticorin', state: 'Tamil Nadu', lat: 8.7600, lon: 78.1600 },
  { name: 'Rameswaram / Palk Bay', shortName: 'Rameswaram', state: 'Tamil Nadu', lat: 9.2880, lon: 79.3130 },
  { name: 'Dhanushkodi Point', shortName: 'Dhanushkodi', state: 'Tamil Nadu', lat: 9.1700, lon: 79.4200 },
  { name: 'Nagapattinam Harbor', shortName: 'Nagapattinam', state: 'Tamil Nadu', lat: 10.7600, lon: 79.8400 },
  { name: 'Puducherry Harbor', shortName: 'Puducherry', state: 'Puducherry', lat: 11.9100, lon: 79.8300 },
  { name: 'Kasimedu Fisheries Harbor, Chennai', shortName: 'Chennai', state: 'Tamil Nadu', lat: 13.1200, lon: 80.3000 },
  { name: 'Ennore Port', shortName: 'Ennore', state: 'Tamil Nadu', lat: 13.2500, lon: 80.3400 },

  // East Coast - Andhra Pradesh
  { name: 'Krishnapatnam Port', shortName: 'Krishnapatnam', state: 'Andhra Pradesh', lat: 14.2500, lon: 80.1200 },
  { name: 'Machilipatnam Coast', shortName: 'Machilipatnam', state: 'Andhra Pradesh', lat: 16.1800, lon: 81.1600 },
  { name: 'Kakinada Deepwater Port', shortName: 'Kakinada', state: 'Andhra Pradesh', lat: 16.9600, lon: 82.2600 },
  { name: 'Visakhapatnam Harbor', shortName: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6800, lon: 83.2800 },

  // East Coast - Odisha & West Bengal
  { name: 'Gopalpur Port', shortName: 'Gopalpur', state: 'Odisha', lat: 19.2600, lon: 84.9100 },
  { name: 'Puri Coast', shortName: 'Puri', state: 'Odisha', lat: 19.8000, lon: 85.8300 },
  { name: 'Paradip Port', shortName: 'Paradip', state: 'Odisha', lat: 20.3100, lon: 86.6100 },
  { name: 'Dhamra Port', shortName: 'Dhamra', state: 'Odisha', lat: 20.8000, lon: 86.9700 },
  { name: 'Digha Coastal Beach', shortName: 'Digha', state: 'West Bengal', lat: 21.6200, lon: 87.5100 },
  { name: 'Sagar Island / Sundarbans', shortName: 'Sagar Island', state: 'West Bengal', lat: 21.6500, lon: 88.0800 },

  // Islands
  { name: 'Port Blair Harbor', shortName: 'Port Blair', state: 'Andaman & Nicobar', lat: 11.6600, lon: 92.7300 },
  { name: 'Kavaratti Island', shortName: 'Kavaratti', state: 'Lakshadweep', lat: 10.5600, lon: 72.6400 },
];

/**
 * Great-circle distance between two GPS coordinates in kilometers (Haversine formula).
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Returns compass direction (N, NE, E, SE, S, SW, W, NW) from origin point to target point.
 */
export function getCompassBearing(originLat, originLon, targetLat, targetLon) {
  const y = Math.sin(((targetLon - originLon) * Math.PI) / 180) * Math.cos((targetLat * Math.PI) / 180);
  const x =
    Math.cos((originLat * Math.PI) / 180) * Math.sin((targetLat * Math.PI) / 180) -
    Math.sin((originLat * Math.PI) / 180) *
      Math.cos((targetLat * Math.PI) / 180) *
      Math.cos(((targetLon - originLon) * Math.PI) / 180);
  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  brng = (brng + 360) % 360;

  const sectors = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(brng / 45) % 8;
  return sectors[index];
}

/**
 * Fast, deterministic local lookup for the nearest Indian coastal place.
 * Returns human-readable maritime designation (e.g. "12 km W of Kochi, Kerala" or "Offshore Rameswaram, Tamil Nadu").
 */
export function getNearestCoastalPlace(lat, lon) {
  if (lat === undefined || lat === null || lon === undefined || lon === null) {
    return 'Coastal Sector';
  }
  const nLat = Number(lat);
  const nLon = Number(lon);
  if (isNaN(nLat) || isNaN(nLon)) return 'Coastal Sector';

  let closest = null;
  let minDistance = Infinity;

  for (const hub of INDIAN_COASTAL_HUBS) {
    const d = haversineDistanceKm(hub.lat, hub.lon, nLat, nLon);
    if (d < minDistance) {
      minDistance = d;
      closest = hub;
    }
  }

  if (!closest) return `Sector (${nLat.toFixed(2)}°N, ${nLon.toFixed(2)}°E)`;

  const roundedDist = Math.round(minDistance * 10) / 10;
  const bearing = getCompassBearing(closest.lat, closest.lon, nLat, nLon);

  if (roundedDist < 3.0) {
    return `Offshore ${closest.shortName}, ${closest.state}`;
  } else if (roundedDist <= 40.0) {
    return `${Math.round(roundedDist)} km ${bearing} of ${closest.shortName}, ${closest.state}`;
  } else {
    return `Deep Sea (${Math.round(roundedDist)} km ${bearing} of ${closest.shortName})`;
  }
}

/**
 * Resolves coordinate to human-friendly place name.
 * Uses instantaneous local coastal gazetteer first, then optionally enriches with Nominatim if reachable.
 */
export async function resolvePlaceFromCoordinates(lat, lon) {
  const fallback = getNearestCoastalPlace(lat, lon);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1600);

    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=11`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const water = addr.bay || addr.water || addr.sea || addr.strait;
        const local = addr.city || addr.town || addr.village || addr.suburb || addr.county;
        const state = addr.state;

        if (water && local) {
          return `${water}, near ${local}`;
        }
        if (local && state) {
          return `Offshore ${local}, ${state}`;
        }
        if (data.name && state) {
          return `${data.name}, ${state}`;
        }
      }
    }
  } catch {
    // Network timeout or blocked CORS - fallback is already computed
  }

  return fallback;
}
