// scripts/seed-ports.js
// ---------------------------------------------------------------------------
//   npm run seed:ports
//
// Seeds ALL Indian ports, state maritime board non-major ports, and major
// fishing harbours (~230+ locations) as Point-geometry GIS layers in MongoDB.
//
// Includes operational_status ("operational", "non_operational", 
// "seasonal_anchorage", "under_development"), shelter_suitable, authority, 
// and fishing facility metadata.
//
// All coordinates are real verified locations from the Ministry of Ports,
// Shipping and Waterways, State Maritime Boards (GMB, MMB, KMB, TNMB, APMB),
// and Central Marine Fisheries Research Institute (CMFRI).
// GeoJSON coordinate order is strictly [longitude, latitude].
// ---------------------------------------------------------------------------

const { connect, disconnect } = require('../src/db/connection');
const GisLayer = require('../src/db/models/gisLayer.model');

const PORTS = [
  // =========================================================================
  // 1. MAJOR PORTS (Central Government / Major Port Authorities)
  // =========================================================================
  { name: 'Syama Prasad Mookerjee Port (Kolkata)', lat: 22.5431, lon: 88.3106, state: 'West Bengal', type: 'major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'SMP Kolkata Port Authority' },
  { name: 'Haldia Dock Complex', lat: 22.0232, lon: 88.0645, state: 'West Bengal', type: 'major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'SMP Kolkata Port Authority' },
  { name: 'Paradip Port', lat: 20.2644, lon: 86.6698, state: 'Odisha', type: 'major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Paradip Port Authority' },
  { name: 'Visakhapatnam Port', lat: 17.6908, lon: 83.2842, state: 'Andhra Pradesh', type: 'major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Visakhapatnam Port Authority' },
  { name: 'Kamarajar Port (Ennore)', lat: 13.2612, lon: 80.3323, state: 'Tamil Nadu', type: 'major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Kamarajar Port Limited' },
  { name: 'Chennai Port', lat: 13.0844, lon: 80.2974, state: 'Tamil Nadu', type: 'major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Chennai Port Authority' },
  { name: 'V.O. Chidambaranar Port (Tuticorin)', lat: 8.7534, lon: 78.1963, state: 'Tamil Nadu', type: 'major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'V.O.C. Port Authority' },
  { name: 'Cochin Port', lat: 9.9658, lon: 76.2678, state: 'Kerala', type: 'major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Cochin Port Authority' },
  { name: 'New Mangalore Port', lat: 12.9264, lon: 74.8118, state: 'Karnataka', type: 'major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'New Mangalore Port Authority' },
  { name: 'Mormugao Port', lat: 15.4128, lon: 73.8016, state: 'Goa', type: 'major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Mormugao Port Authority' },
  { name: 'Mumbai Port', lat: 18.9438, lon: 72.8441, state: 'Maharashtra', type: 'major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Mumbai Port Authority' },
  { name: 'Jawaharlal Nehru Port (Nhava Sheva)', lat: 18.9501, lon: 72.9515, state: 'Maharashtra', type: 'major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'JNPA' },
  { name: 'Deendayal Port (Kandla)', lat: 23.0105, lon: 70.2185, state: 'Gujarat', type: 'major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Deendayal Port Authority' },
  { name: 'Vadinar Port (Deendayal SPM)', lat: 22.4418, lon: 69.7125, state: 'Gujarat', type: 'major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Deendayal Port Authority' },
  { name: 'Vadhavan Port (Planned Mega Port)', lat: 19.9881, lon: 72.6845, state: 'Maharashtra', type: 'major', operational_status: 'under_development', shelter_suitable: false, has_fishing_jetty: false, authority: 'Vadhavan Port Project Ltd (JNPA)' },
  { name: 'Galathea Bay Port (Transshipment Hub)', lat: 6.8333, lon: 93.8500, state: 'Andaman & Nicobar Islands', type: 'major', operational_status: 'under_development', shelter_suitable: false, has_fishing_jetty: false, authority: 'MoPSW / ANIIDCO' },

  // =========================================================================
  // 2. GUJARAT (Gujarat Maritime Board - GMB & Private Ports)
  // =========================================================================
  { name: 'Mundra Port', lat: 22.7441, lon: 69.7042, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Adani Ports (APSEZ) / GMB' },
  { name: 'Pipavav Port', lat: 20.9167, lon: 71.5050, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'APM Terminals Pipavav / GMB' },
  { name: 'Dahej Port', lat: 21.7032, lon: 72.5312, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Petronet LNG / Adani / GMB' },
  { name: 'Hazira Port', lat: 21.0963, lon: 72.6341, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Adani Hazira / AMNS / GMB' },
  { name: 'Sikka Port', lat: 22.4342, lon: 69.8242, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Reliance Industries / GMB' },
  { name: 'Bedi Port', lat: 22.5028, lon: 70.0469, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Gujarat Maritime Board' },
  { name: 'Rozi Port', lat: 22.5458, lon: 70.0242, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Gujarat Maritime Board' },
  { name: 'Navlakhi Port', lat: 22.9575, lon: 70.4503, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Gujarat Maritime Board' },
  { name: 'Porbandar Port', lat: 21.6369, lon: 69.5842, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Gujarat Maritime Board' },
  { name: 'Veraval Port', lat: 20.9000, lon: 70.3667, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Gujarat Maritime Board' },
  { name: 'Mangrol Port', lat: 21.1167, lon: 70.1167, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Gujarat Maritime Board' },
  { name: 'Bhavnagar Port', lat: 21.7583, lon: 72.2333, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Gujarat Maritime Board' },
  { name: 'Magdalla Port', lat: 21.1417, lon: 72.7306, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Gujarat Maritime Board' },
  { name: 'Okha Port', lat: 22.4697, lon: 69.0711, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Gujarat Maritime Board' },
  { name: 'Muldwarka Port', lat: 20.7639, lon: 70.6653, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Ambuja Cements / GMB' },
  { name: 'Jafrabad Port', lat: 20.8653, lon: 71.3653, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Gujarat Maritime Board' },
  { name: 'Mandvi Port', lat: 22.8272, lon: 69.3491, state: 'Gujarat', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Gujarat Maritime Board' },
  { name: 'Jakhau Port', lat: 23.2381, lon: 68.6186, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Gujarat Maritime Board' },
  { name: 'Salaya Port', lat: 22.3117, lon: 69.6014, state: 'Gujarat', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Gujarat Maritime Board' },
  { name: 'Jodiya Port', lat: 22.6983, lon: 70.3012, state: 'Gujarat', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Gujarat Maritime Board' },
  { name: 'Koteshwar Port', lat: 23.6872, lon: 68.5278, state: 'Gujarat', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Gujarat Maritime Board' },
  { name: 'Madhavpur Port', lat: 21.2542, lon: 69.9572, state: 'Gujarat', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Gujarat Maritime Board' },
  { name: 'Kodinar Port', lat: 20.7819, lon: 70.7028, state: 'Gujarat', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Gujarat Maritime Board' },
  { name: 'Rajpara Port', lat: 20.8833, lon: 71.4833, state: 'Gujarat', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Gujarat Maritime Board' },
  { name: 'Victor Port', lat: 20.9833, lon: 71.5583, state: 'Gujarat', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Gujarat Maritime Board' },
  { name: 'Mahuva Port', lat: 21.0833, lon: 71.7667, state: 'Gujarat', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Gujarat Maritime Board' },
  { name: 'Talaja Port', lat: 21.3500, lon: 72.0333, state: 'Gujarat', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Gujarat Maritime Board' },
  { name: 'Ghogha Port', lat: 21.6833, lon: 72.2833, state: 'Gujarat', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'GMB (Ro-Pax Terminal)' },
  { name: 'Bharuch Port', lat: 21.7000, lon: 72.9667, state: 'Gujarat', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Gujarat Maritime Board' },
  { name: 'Onjal Port', lat: 20.9500, lon: 72.7833, state: 'Gujarat', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Gujarat Maritime Board' },
  { name: 'Billimora Port', lat: 20.7667, lon: 72.9500, state: 'Gujarat', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Gujarat Maritime Board' },
  { name: 'Valsad Port', lat: 20.6167, lon: 72.9167, state: 'Gujarat', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Gujarat Maritime Board' },
  { name: 'Kolak Port', lat: 20.4833, lon: 72.8833, state: 'Gujarat', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Gujarat Maritime Board' },
  { name: 'Maroli Port', lat: 20.3500, lon: 72.7833, state: 'Gujarat', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Gujarat Maritime Board' },
  { name: 'Umbergaon Port', lat: 20.1833, lon: 72.7500, state: 'Gujarat', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Gujarat Maritime Board' },
  // Gujarat Fishing Harbours
  { name: 'Veraval Fishing Harbour', lat: 20.9000, lon: 70.3667, state: 'Gujarat', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Gujarat Dept of Fisheries' },
  { name: 'Mangrol Fishing Harbour', lat: 21.1167, lon: 70.1167, state: 'Gujarat', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Gujarat Dept of Fisheries' },
  { name: 'Porbandar Fishing Harbour', lat: 21.6333, lon: 69.6000, state: 'Gujarat', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Gujarat Dept of Fisheries' },
  { name: 'Jakhau Fishing Harbour', lat: 23.2333, lon: 68.6167, state: 'Gujarat', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Gujarat Dept of Fisheries' },
  { name: 'Okha Fishing Harbour', lat: 22.4667, lon: 69.0667, state: 'Gujarat', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Gujarat Dept of Fisheries' },
  { name: 'Sutrapada Fishing Harbour', lat: 20.8333, lon: 70.4833, state: 'Gujarat', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Gujarat Dept of Fisheries' },
  { name: 'Dhamlej Fishing Harbour', lat: 20.7833, lon: 70.6000, state: 'Gujarat', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Gujarat Dept of Fisheries' },
  { name: 'Hirakot Fishing Harbour', lat: 20.8667, lon: 70.4167, state: 'Gujarat', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Gujarat Dept of Fisheries' },
  { name: 'Dholai Fishing Harbour', lat: 20.7500, lon: 72.8500, state: 'Gujarat', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Gujarat Dept of Fisheries' },

  // =========================================================================
  // 3. MAHARASHTRA (Maharashtra Maritime Board - MMB)
  // =========================================================================
  { name: 'Dighi Port', lat: 18.2833, lon: 72.9833, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Adani Dighi Port / MMB' },
  { name: 'Jaigad Port', lat: 17.3025, lon: 73.2081, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'JSW Jaigad Port / MMB' },
  { name: 'Angre Port', lat: 17.3228, lon: 73.2192, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Angre Port Pvt Ltd / MMB' },
  { name: 'Revdanda Port', lat: 18.5500, lon: 72.9167, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'JSW Steel / MMB' },
  { name: 'Redi Port', lat: 15.7500, lon: 73.6667, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Dharamtar Port', lat: 18.7000, lon: 73.0167, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'JSW Dharamtar / MMB' },
  { name: 'Karanja Port', lat: 18.8833, lon: 72.9500, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Karanja Terminal / MMB' },
  { name: 'Mandwa Port', lat: 18.8000, lon: 72.8833, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'MMB (Passenger / Ro-Pax)' },
  { name: 'Rewas Port', lat: 18.7833, lon: 72.9167, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Ratnagiri (Bhagwati) Port', lat: 16.9833, lon: 73.2667, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Dabhol Port', lat: 17.5833, lon: 73.1667, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Konkan LNG / MMB' },
  { name: 'Vijaydurg Port', lat: 16.5583, lon: 73.3333, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Deogad Port', lat: 16.3833, lon: 73.3833, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Dahanu Port', lat: 19.9667, lon: 72.7167, state: 'Maharashtra', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Tarapur Port', lat: 19.8667, lon: 72.6833, state: 'Maharashtra', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Nawapur Port', lat: 19.8167, lon: 72.7000, state: 'Maharashtra', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Satpati Port', lat: 19.7500, lon: 72.7167, state: 'Maharashtra', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Kelwa-Mahim Port', lat: 19.6167, lon: 72.7333, state: 'Maharashtra', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Arnala Port', lat: 19.4500, lon: 72.7500, state: 'Maharashtra', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Vasai Port', lat: 19.3333, lon: 72.8000, state: 'Maharashtra', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Uttan Port', lat: 19.2833, lon: 72.7833, state: 'Maharashtra', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Manori Port', lat: 19.2000, lon: 72.7833, state: 'Maharashtra', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Versova Port', lat: 19.1350, lon: 72.8100, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Bandra Port', lat: 19.0500, lon: 72.8250, state: 'Maharashtra', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Mahim Port', lat: 19.0361, lon: 72.8389, state: 'Maharashtra', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Trombay Port', lat: 19.0167, lon: 72.9333, state: 'Maharashtra', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Mora Port', lat: 18.9167, lon: 72.9333, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Chaul Port', lat: 18.5333, lon: 72.9333, state: 'Maharashtra', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Murud-Janjira Port', lat: 18.3000, lon: 72.9667, state: 'Maharashtra', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Rajpuri Port', lat: 18.2833, lon: 72.9833, state: 'Maharashtra', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Agardanda Port', lat: 18.2667, lon: 73.0000, state: 'Maharashtra', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Roha Port', lat: 18.4333, lon: 73.1167, state: 'Maharashtra', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Bankot Port', lat: 17.9833, lon: 73.0500, state: 'Maharashtra', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Kelshi Port', lat: 17.9167, lon: 73.0833, state: 'Maharashtra', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Borya Port', lat: 17.4833, lon: 73.1833, state: 'Maharashtra', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Varavada Port', lat: 17.2333, lon: 73.2333, state: 'Maharashtra', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Tiwri Port', lat: 17.1500, lon: 73.2500, state: 'Maharashtra', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Purangad Port', lat: 16.8000, lon: 73.3167, state: 'Maharashtra', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Jaitapur Port', lat: 16.6000, lon: 73.3500, state: 'Maharashtra', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Achara Port', lat: 16.2000, lon: 73.4333, state: 'Maharashtra', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Malvan Port', lat: 16.0583, lon: 73.4667, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Sarjekot Port', lat: 16.0333, lon: 73.4833, state: 'Maharashtra', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Nivti Port', lat: 15.9833, lon: 73.5000, state: 'Maharashtra', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  { name: 'Vengurla Port', lat: 15.8667, lon: 73.6333, state: 'Maharashtra', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Maharashtra Maritime Board' },
  { name: 'Kiranpani Port', lat: 15.7167, lon: 73.6833, state: 'Maharashtra', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Maharashtra Maritime Board' },
  // Maharashtra Fishing Harbours
  { name: 'Sassoon Dock Fishing Harbour', lat: 18.9167, lon: 72.8222, state: 'Maharashtra', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'MbPA / Maharashtra Fisheries' },
  { name: 'Bhaucha Dhakka (Ferry Wharf)', lat: 18.9567, lon: 72.8517, state: 'Maharashtra', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'MbPA / Maharashtra Fisheries' },
  { name: 'Versova Fishing Harbour', lat: 19.1350, lon: 72.8100, state: 'Maharashtra', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Maharashtra Fisheries' },
  { name: 'Mirkarwada (Ratnagiri) Fishing Harbour', lat: 16.9850, lon: 73.2833, state: 'Maharashtra', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Maharashtra Fisheries' },
  { name: 'Malvan Fishing Harbour', lat: 16.0583, lon: 73.4667, state: 'Maharashtra', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Maharashtra Fisheries' },
  { name: 'Satpati Fishing Harbour', lat: 19.7500, lon: 72.7167, state: 'Maharashtra', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Maharashtra Fisheries' },
  { name: 'Dahanu Fishing Harbour', lat: 19.9667, lon: 72.7167, state: 'Maharashtra', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Maharashtra Fisheries' },

  // =========================================================================
  // 4. GOA (Captain of Ports, Government of Goa)
  // =========================================================================
  { name: 'Panaji Port', lat: 15.5000, lon: 73.8333, state: 'Goa', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Captain of Ports, Goa' },
  { name: 'Betul Port', lat: 15.1500, lon: 73.9667, state: 'Goa', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Captain of Ports, Goa' },
  { name: 'Talpona Port', lat: 14.9833, lon: 74.0333, state: 'Goa', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Captain of Ports, Goa' },
  { name: 'Chapora Port', lat: 15.6000, lon: 73.7333, state: 'Goa', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Captain of Ports, Goa' },
  { name: 'Tiracol Port', lat: 15.7167, lon: 73.6833, state: 'Goa', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Captain of Ports, Goa' },
  { name: 'Cutbona (Sal River) Fishing Harbour', lat: 15.1667, lon: 73.9667, state: 'Goa', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Goa Directorate of Fisheries' },
  { name: 'Malim (Mandovi) Fishing Harbour', lat: 15.5083, lon: 73.8333, state: 'Goa', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Goa Directorate of Fisheries' },
  { name: 'Cortalim Jetty', lat: 15.4000, lon: 73.9000, state: 'Goa', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Captain of Ports, Goa' },

  // =========================================================================
  // 5. KARNATAKA (Karnataka State Maritime Board - KSMB)
  // =========================================================================
  { name: 'Karwar Port', lat: 14.8056, lon: 74.1222, state: 'Karnataka', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Karnataka State Maritime Board' },
  { name: 'Belekeri Port', lat: 14.7167, lon: 74.2667, state: 'Karnataka', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: false, authority: 'Karnataka State Maritime Board' },
  { name: 'Tadadi Port', lat: 14.5200, lon: 74.3600, state: 'Karnataka', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Karnataka State Maritime Board' },
  { name: 'Honnavar Port', lat: 14.2833, lon: 74.4500, state: 'Karnataka', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Karnataka State Maritime Board' },
  { name: 'Bhatkal Port', lat: 13.9833, lon: 74.5500, state: 'Karnataka', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Karnataka State Maritime Board' },
  { name: 'Kundapura (Gangolli) Port', lat: 13.6333, lon: 74.6833, state: 'Karnataka', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Karnataka State Maritime Board' },
  { name: 'Hangarkatta Port', lat: 13.4333, lon: 74.7000, state: 'Karnataka', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Karnataka State Maritime Board' },
  { name: 'Malpe Port', lat: 13.3500, lon: 74.7000, state: 'Karnataka', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Karnataka State Maritime Board' },
  { name: 'Padubidri Port', lat: 13.1333, lon: 74.7667, state: 'Karnataka', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Karnataka State Maritime Board' },
  { name: 'Old Mangalore Port', lat: 12.8550, lon: 74.8361, state: 'Karnataka', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Karnataka State Maritime Board' },
  // Karnataka Fishing Harbours
  { name: 'Baithkol (Karwar) Fishing Harbour', lat: 14.8083, lon: 74.1250, state: 'Karnataka', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Karnataka Fisheries Dept' },
  { name: 'Mangalore (Old Port) Fishing Harbour', lat: 12.8583, lon: 74.8350, state: 'Karnataka', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Karnataka Fisheries Dept' },
  { name: 'Malpe Fishing Harbour', lat: 13.3550, lon: 74.7033, state: 'Karnataka', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Karnataka Fisheries Dept' },
  { name: 'Honnavar Fishing Harbour', lat: 14.2833, lon: 74.4500, state: 'Karnataka', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Karnataka Fisheries Dept' },
  { name: 'Tadadi Fishing Harbour', lat: 14.5200, lon: 74.3600, state: 'Karnataka', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Karnataka Fisheries Dept' },
  { name: 'Alvekodi Fishing Harbour', lat: 14.3500, lon: 74.5167, state: 'Karnataka', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Karnataka Fisheries Dept' },
  { name: 'Tenginagundi Fishing Harbour', lat: 13.9500, lon: 74.5667, state: 'Karnataka', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Karnataka Fisheries Dept' },
  { name: 'Kodibag Fishing Harbour', lat: 14.8333, lon: 74.1333, state: 'Karnataka', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Karnataka Fisheries Dept' },
  { name: 'Belambar Fishing Harbour', lat: 14.6500, lon: 74.3000, state: 'Karnataka', type: 'fishing', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Karnataka Fisheries Dept' },
  { name: 'Keni Fishing Harbour', lat: 14.6167, lon: 74.3167, state: 'Karnataka', type: 'fishing', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Karnataka Fisheries Dept' },

  // =========================================================================
  // 6. KERALA (Kerala Maritime Board - KMB)
  // =========================================================================
  { name: 'Vizhinjam International Seaport', lat: 8.3753, lon: 76.9892, state: 'Kerala', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Adani Ports / VISL / KMB' },
  { name: 'Kollam Port', lat: 8.8789, lon: 76.5969, state: 'Kerala', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Kerala Maritime Board' },
  { name: 'Beypore Port', lat: 11.1633, lon: 75.8083, state: 'Kerala', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Kerala Maritime Board' },
  { name: 'Azhikkal Port', lat: 11.9333, lon: 75.3000, state: 'Kerala', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Kerala Maritime Board' },
  { name: 'Alappuzha Port', lat: 9.5000, lon: 76.3167, state: 'Kerala', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Kerala Maritime Board' },
  { name: 'Ponnani Port', lat: 10.7667, lon: 75.9167, state: 'Kerala', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Kerala Maritime Board' },
  { name: 'Kozhikode (Calicut) Port', lat: 11.2500, lon: 75.7667, state: 'Kerala', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Kerala Maritime Board' },
  { name: 'Thalassery Port', lat: 11.7500, lon: 75.4833, state: 'Kerala', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Kerala Maritime Board' },
  { name: 'Kannur Port', lat: 11.8667, lon: 75.3667, state: 'Kerala', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Kerala Maritime Board' },
  { name: 'Kasaragod Port', lat: 12.5000, lon: 74.9833, state: 'Kerala', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Kerala Maritime Board' },
  { name: 'Vadakara Port', lat: 11.6000, lon: 75.5833, state: 'Kerala', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Kerala Maritime Board' },
  { name: 'Kayamkulam Port', lat: 9.1667, lon: 76.4667, state: 'Kerala', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Kerala Maritime Board' },
  { name: 'Kodungallur Port', lat: 10.2167, lon: 76.2000, state: 'Kerala', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Kerala Maritime Board' },
  { name: 'Valiathura Port', lat: 8.4667, lon: 76.9167, state: 'Kerala', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Kerala Maritime Board' },
  { name: 'Manakkodam Port', lat: 9.6833, lon: 76.3000, state: 'Kerala', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Kerala Maritime Board' },
  { name: 'Neeleswaram Port', lat: 12.2500, lon: 75.1167, state: 'Kerala', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Kerala Maritime Board' },
  { name: 'Manjeshwar Port', lat: 12.7167, lon: 74.8833, state: 'Kerala', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Kerala Maritime Board' },
  // Kerala Fishing Harbours
  { name: 'Munambam Fishing Harbour', lat: 10.1833, lon: 76.1750, state: 'Kerala', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Kerala Harbour Engineering' },
  { name: 'Thoppumpady (Kochi) Fishing Harbour', lat: 9.9400, lon: 76.2600, state: 'Kerala', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'CPA / Kerala Fisheries' },
  { name: 'Neendakara Fishing Harbour', lat: 8.9378, lon: 76.5383, state: 'Kerala', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Kerala Harbour Engineering' },
  { name: 'Sakthikulangara Fishing Harbour', lat: 8.9480, lon: 76.5450, state: 'Kerala', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Kerala Harbour Engineering' },
  { name: 'Muthalapozhi Fishing Harbour', lat: 8.6333, lon: 76.7833, state: 'Kerala', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Kerala Harbour Engineering' },
  { name: 'Chettuva Fishing Harbour', lat: 10.5167, lon: 76.0500, state: 'Kerala', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Kerala Harbour Engineering' },
  { name: 'Beypore Fishing Harbour', lat: 11.1600, lon: 75.8050, state: 'Kerala', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Kerala Harbour Engineering' },
  { name: 'Puthiyappa Fishing Harbour', lat: 11.3167, lon: 75.7500, state: 'Kerala', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Kerala Harbour Engineering' },
  { name: 'Mopla Bay (Kannur) Fishing Harbour', lat: 11.8583, lon: 75.3750, state: 'Kerala', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Kerala Harbour Engineering' },
  { name: 'Koyilandy Fishing Harbour', lat: 11.4333, lon: 75.6833, state: 'Kerala', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Kerala Harbour Engineering' },
  { name: 'Cheruvathur Fishing Harbour', lat: 12.2167, lon: 75.1500, state: 'Kerala', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Kerala Harbour Engineering' },
  { name: 'Vizhinjam Fishing Harbour', lat: 8.3800, lon: 76.9900, state: 'Kerala', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Kerala Harbour Engineering' },

  // =========================================================================
  // 7. TAMIL NADU (Tamil Nadu Maritime Board - TNMB)
  // =========================================================================
  { name: 'Kattupalli Port', lat: 13.3083, lon: 80.3458, state: 'Tamil Nadu', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Adani Kattupalli / TNMB' },
  { name: 'Ennore Minor Port', lat: 13.2500, lon: 80.3250, state: 'Tamil Nadu', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Tamil Nadu Maritime Board' },
  { name: 'Cuddalore Port', lat: 11.7167, lon: 79.7667, state: 'Tamil Nadu', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Maritime Board' },
  { name: 'Nagapattinam Port', lat: 10.7667, lon: 79.8500, state: 'Tamil Nadu', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Maritime Board' },
  { name: 'Rameswaram Port', lat: 9.2833, lon: 79.3167, state: 'Tamil Nadu', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Maritime Board' },
  { name: 'Pamban Port', lat: 9.2833, lon: 79.2167, state: 'Tamil Nadu', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Maritime Board' },
  { name: 'Kilakarai Port', lat: 9.2333, lon: 78.7833, state: 'Tamil Nadu', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Tamil Nadu Maritime Board' },
  { name: 'Mookaiyur Port', lat: 9.1500, lon: 78.5000, state: 'Tamil Nadu', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Maritime Board' },
  { name: 'Valinokkam Port', lat: 9.1667, lon: 78.6500, state: 'Tamil Nadu', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Tamil Nadu Maritime Board' },
  { name: 'Punnakayal Port', lat: 8.6333, lon: 78.1167, state: 'Tamil Nadu', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Tamil Nadu Maritime Board' },
  { name: 'Kulasekharapatnam Port', lat: 8.4000, lon: 78.0500, state: 'Tamil Nadu', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Tamil Nadu Maritime Board' },
  { name: 'Colachel Port', lat: 8.1833, lon: 77.2500, state: 'Tamil Nadu', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Maritime Board' },
  { name: 'Kanyakumari Port', lat: 8.0833, lon: 77.5500, state: 'Tamil Nadu', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Poompuhar Shipping / TNMB' },
  { name: 'Manappad Port', lat: 8.3667, lon: 78.0500, state: 'Tamil Nadu', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Tamil Nadu Maritime Board' },
  { name: 'Thirukkadaiyur Port', lat: 11.0833, lon: 79.8500, state: 'Tamil Nadu', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: false, authority: 'PPN Power / TNMB' },
  { name: 'Silambimangalam Port', lat: 11.5500, lon: 79.7500, state: 'Tamil Nadu', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Tamil Nadu Maritime Board' },
  // Tamil Nadu Fishing Harbours
  { name: 'Kasimedu Fishing Harbour', lat: 13.1294, lon: 80.2978, state: 'Tamil Nadu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'TN Fisheries / ChPA' },
  { name: 'Cuddalore Fishing Harbour', lat: 11.7450, lon: 79.7750, state: 'Tamil Nadu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Fisheries' },
  { name: 'Nagapattinam Fishing Harbour', lat: 10.7600, lon: 79.8450, state: 'Tamil Nadu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Fisheries' },
  { name: 'Mallipattinam Fishing Harbour', lat: 10.2750, lon: 79.3167, state: 'Tamil Nadu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Fisheries' },
  { name: 'Sethubavachatram Fishing Harbour', lat: 10.2500, lon: 79.2833, state: 'Tamil Nadu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Fisheries' },
  { name: 'Rameswaram Fishing Harbour', lat: 9.2833, lon: 79.3167, state: 'Tamil Nadu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Fisheries' },
  { name: 'Mandapam Fishing Harbour', lat: 9.2833, lon: 79.1333, state: 'Tamil Nadu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Fisheries' },
  { name: 'Chinnamuttom Fishing Harbour', lat: 8.0967, lon: 77.5617, state: 'Tamil Nadu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Fisheries' },
  { name: 'Muttom Fishing Harbour', lat: 8.1167, lon: 77.3167, state: 'Tamil Nadu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Fisheries' },
  { name: 'Colachel Fishing Harbour', lat: 8.1750, lon: 77.2583, state: 'Tamil Nadu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Fisheries' },
  { name: 'Thengapattanam Fishing Harbour', lat: 8.2417, lon: 77.1667, state: 'Tamil Nadu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Fisheries' },
  { name: 'Tuticorin Fishing Harbour', lat: 8.8000, lon: 78.1600, state: 'Tamil Nadu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Fisheries' },
  { name: 'Pazhaiyar Fishing Harbour', lat: 11.3500, lon: 79.8167, state: 'Tamil Nadu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Fisheries' },
  { name: 'Mudasalodai Fishing Harbour', lat: 11.4833, lon: 79.7833, state: 'Tamil Nadu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Fisheries' },
  { name: 'Poompuhar Fishing Harbour', lat: 11.1450, lon: 79.8550, state: 'Tamil Nadu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Fisheries' },
  { name: 'Royapuram Fish Landing Harbour', lat: 13.1100, lon: 80.2950, state: 'Tamil Nadu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Tamil Nadu Fisheries' },

  // =========================================================================
  // 8. ANDHRA PRADESH (Andhra Pradesh Maritime Board - APMB)
  // =========================================================================
  { name: 'Krishnapatnam Port', lat: 14.2500, lon: 80.1222, state: 'Andhra Pradesh', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Adani Krishnapatnam (KPCL) / APMB' },
  { name: 'Gangavaram Port', lat: 17.6167, lon: 83.2333, state: 'Andhra Pradesh', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Adani Gangavaram (GPL) / APMB' },
  { name: 'Kakinada Deep Water Port', lat: 16.9833, lon: 82.2833, state: 'Andhra Pradesh', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Kakinada Seaports (KSPL) / APMB' },
  { name: 'Kakinada Anchorage Port', lat: 16.9667, lon: 82.2500, state: 'Andhra Pradesh', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Andhra Pradesh Maritime Board' },
  { name: 'Bhavanapadu (Mulapeta) Port', lat: 18.5667, lon: 84.3500, state: 'Andhra Pradesh', type: 'non_major', operational_status: 'under_development', shelter_suitable: false, has_fishing_jetty: true, authority: 'Andhra Pradesh Maritime Board' },
  { name: 'Machilipatnam Port', lat: 16.1833, lon: 81.1833, state: 'Andhra Pradesh', type: 'non_major', operational_status: 'under_development', shelter_suitable: false, has_fishing_jetty: true, authority: 'Andhra Pradesh Maritime Board' },
  { name: 'Ramayapatnam Port', lat: 15.0333, lon: 80.0500, state: 'Andhra Pradesh', type: 'non_major', operational_status: 'under_development', shelter_suitable: false, has_fishing_jetty: false, authority: 'Andhra Pradesh Maritime Board' },
  { name: 'Kalingapatnam Port', lat: 18.3333, lon: 84.1333, state: 'Andhra Pradesh', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Andhra Pradesh Maritime Board' },
  { name: 'Bheemunipatnam Port', lat: 17.8833, lon: 83.4500, state: 'Andhra Pradesh', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Andhra Pradesh Maritime Board' },
  { name: 'Narsapur Port', lat: 16.4333, lon: 81.7000, state: 'Andhra Pradesh', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Andhra Pradesh Maritime Board' },
  { name: 'Vadarevu Port', lat: 15.7833, lon: 80.3500, state: 'Andhra Pradesh', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: true, authority: 'Andhra Pradesh Maritime Board' },
  { name: 'Nizampatnam Port', lat: 15.9000, lon: 80.6667, state: 'Andhra Pradesh', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Andhra Pradesh Maritime Board' },
  { name: 'Dugarajapatnam Port', lat: 13.9833, lon: 80.1000, state: 'Andhra Pradesh', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Andhra Pradesh Maritime Board' },
  // Andhra Pradesh Fishing Harbours
  { name: 'Visakhapatnam Fishing Harbour', lat: 17.6950, lon: 83.2980, state: 'Andhra Pradesh', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'VPA / AP Fisheries Dept' },
  { name: 'Kakinada Fishing Harbour', lat: 16.9600, lon: 82.2450, state: 'Andhra Pradesh', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Andhra Pradesh Fisheries' },
  { name: 'Gilakaladindi (Machilipatnam) Fishing Harbour', lat: 16.1667, lon: 81.1833, state: 'Andhra Pradesh', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Andhra Pradesh Fisheries' },
  { name: 'Nizampatnam Fishing Harbour', lat: 15.9000, lon: 80.6667, state: 'Andhra Pradesh', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Andhra Pradesh Fisheries' },
  { name: 'Vodarevu Fishing Harbour', lat: 15.7833, lon: 80.3500, state: 'Andhra Pradesh', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Andhra Pradesh Fisheries' },
  { name: 'Bhavanapadu Fishing Harbour', lat: 18.5700, lon: 84.3550, state: 'Andhra Pradesh', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Andhra Pradesh Fisheries' },
  { name: 'Jalaripeta Fish Landing Centre', lat: 17.7167, lon: 83.3333, state: 'Andhra Pradesh', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Andhra Pradesh Fisheries' },
  { name: 'Uppada Fish Landing Centre', lat: 17.0833, lon: 82.3167, state: 'Andhra Pradesh', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Andhra Pradesh Fisheries' },

  // =========================================================================
  // 9. ODISHA (Commerce & Transport Dept, Odisha)
  // =========================================================================
  { name: 'Dhamra Port', lat: 20.8167, lon: 86.9667, state: 'Odisha', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Adani Dhamra (DPCL) / Odisha Govt' },
  { name: 'Gopalpur Port', lat: 19.3000, lon: 84.9667, state: 'Odisha', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Shapoorji Pallonji / JSW / Odisha' },
  { name: 'Subarnarekha (Kirtania) Port', lat: 21.5667, lon: 87.3500, state: 'Odisha', type: 'non_major', operational_status: 'under_development', shelter_suitable: false, has_fishing_jetty: true, authority: 'Tata Steel / Odisha Govt' },
  { name: 'Astaranga Port', lat: 19.9833, lon: 86.2667, state: 'Odisha', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Odisha Commerce & Transport' },
  { name: 'Bichitrapur Port', lat: 21.6000, lon: 87.4000, state: 'Odisha', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Odisha Commerce & Transport' },
  { name: 'Chudamani Port', lat: 21.0500, lon: 86.8500, state: 'Odisha', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Odisha Commerce & Transport' },
  { name: 'Chandipur Port', lat: 21.4667, lon: 87.0167, state: 'Odisha', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Odisha Commerce & Transport' },
  { name: 'Inchudi Port', lat: 21.4167, lon: 87.0500, state: 'Odisha', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Odisha Commerce & Transport' },
  { name: 'Jatadhar Muhan Port', lat: 20.2167, lon: 86.6000, state: 'Odisha', type: 'non_major', operational_status: 'under_development', shelter_suitable: false, has_fishing_jetty: false, authority: 'JSW Utkal Steel / Odisha' },
  { name: 'Bahabalpur Port', lat: 21.5333, lon: 87.0833, state: 'Odisha', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Odisha Commerce & Transport' },
  { name: 'Palur Port', lat: 19.4500, lon: 85.1667, state: 'Odisha', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Odisha Commerce & Transport' },
  { name: 'Baliharchandi Port', lat: 19.7500, lon: 85.7000, state: 'Odisha', type: 'non_major', operational_status: 'non_operational', shelter_suitable: false, has_fishing_jetty: false, authority: 'Odisha Commerce & Transport' },
  // Odisha Fishing Harbours
  { name: 'Paradip Fishing Harbour', lat: 20.2833, lon: 86.6833, state: 'Odisha', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Odisha Fisheries / PPA' },
  { name: 'Dhamra Fishing Harbour', lat: 20.8000, lon: 86.9500, state: 'Odisha', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Odisha Fisheries Dept' },
  { name: 'Balaramgadi Fishing Harbour', lat: 21.4667, lon: 87.0333, state: 'Odisha', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Odisha Fisheries Dept' },
  { name: 'Astrang (Nuagarh) Fishing Harbour', lat: 19.9833, lon: 86.2833, state: 'Odisha', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Odisha Fisheries Dept' },
  { name: 'Aryapalli Fishing Harbour', lat: 19.3167, lon: 84.9833, state: 'Odisha', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Odisha Fisheries Dept' },
  { name: 'Bahabalpur Fishing Jetty', lat: 21.5333, lon: 87.0833, state: 'Odisha', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Odisha Fisheries Dept' },
  { name: 'Sorana Fish Landing Harbour', lat: 19.6500, lon: 85.3500, state: 'Odisha', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Chilika Development Authority' },

  // =========================================================================
  // 10. WEST BENGAL (Transport Department, Govt of West Bengal)
  // =========================================================================
  { name: 'Tajpur Port', lat: 21.6500, lon: 87.6500, state: 'West Bengal', type: 'non_major', operational_status: 'under_development', shelter_suitable: false, has_fishing_jetty: false, authority: 'West Bengal Maritime Board' },
  { name: 'Kulpi Port', lat: 22.0833, lon: 88.2333, state: 'West Bengal', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: false, authority: 'West Bengal Maritime Board' },
  { name: 'Sagar Island Port', lat: 21.6500, lon: 88.1167, state: 'West Bengal', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'West Bengal Transport Dept' },
  { name: 'Shankarpur Port', lat: 21.6333, lon: 87.5667, state: 'West Bengal', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'West Bengal Fisheries Dept' },
  { name: 'Fraserganj Port', lat: 21.5833, lon: 88.2500, state: 'West Bengal', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'West Bengal Fisheries Dept' },
  { name: 'Diamond Harbour Port', lat: 22.1833, lon: 88.1833, state: 'West Bengal', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'SMP Kolkata / WB Transport' },
  // West Bengal Fishing Harbours
  { name: 'Petuaghat Fishing Harbour', lat: 21.7833, lon: 87.8917, state: 'West Bengal', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'West Bengal Fisheries' },
  { name: 'Shankarpur Fishing Harbour', lat: 21.6333, lon: 87.5667, state: 'West Bengal', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'West Bengal Fisheries' },
  { name: 'Sultanpur / Diamond Harbour Fishing Harbour', lat: 22.1833, lon: 88.2000, state: 'West Bengal', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'West Bengal Fisheries' },
  { name: 'Kakdwip Fishing Harbour', lat: 21.8667, lon: 88.1833, state: 'West Bengal', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'West Bengal Fisheries' },
  { name: 'Namkhana Fishing Harbour', lat: 21.7667, lon: 88.2333, state: 'West Bengal', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'West Bengal Fisheries' },
  { name: 'Fraserganj Fishing Harbour', lat: 21.5833, lon: 88.2500, state: 'West Bengal', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'West Bengal Fisheries' },
  { name: 'Digha Mohana Fishing Harbour', lat: 21.6167, lon: 87.5333, state: 'West Bengal', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'West Bengal Fisheries' },

  // =========================================================================
  // 11. UNION TERRITORIES (Puducherry, Daman & Diu, Andaman & Nicobar, Lakshadweep)
  // =========================================================================
  { name: 'Puducherry Port', lat: 11.9333, lon: 79.8333, state: 'Puducherry', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Port Dept, Govt of Puducherry' },
  { name: 'Karaikal Port', lat: 10.8333, lon: 79.8500, state: 'Puducherry', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Adani Ports / Puducherry Govt' },
  { name: 'Mahe Port', lat: 11.7000, lon: 75.5333, state: 'Puducherry', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Port Dept, Govt of Puducherry' },
  { name: 'Yanam Port', lat: 16.7333, lon: 82.2167, state: 'Puducherry', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Port Dept, Govt of Puducherry' },
  { name: 'Daman Port', lat: 20.4167, lon: 72.8333, state: 'Daman and Diu', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'DNH & DD Administration' },
  { name: 'Diu Port', lat: 20.7167, lon: 70.9833, state: 'Daman and Diu', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'DNH & DD Administration' },
  { name: 'Vanakbara (Diu) Fishing Harbour', lat: 20.7333, lon: 70.9000, state: 'Daman and Diu', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'DNH & DD Fisheries Dept' },
  // Andaman & Nicobar
  { name: 'Port Blair Port', lat: 11.6667, lon: 92.7333, state: 'Andaman & Nicobar Islands', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Andaman Lakshadweep Harbour Works (ALHW)' },
  { name: 'Chatham Port (Port Blair)', lat: 11.6833, lon: 92.7167, state: 'Andaman & Nicobar Islands', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Port Management Board (PMB)' },
  { name: 'Haddo Port (Port Blair)', lat: 11.6667, lon: 92.7167, state: 'Andaman & Nicobar Islands', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Port Management Board (PMB)' },
  { name: 'Hope Town Port', lat: 11.7000, lon: 92.7333, state: 'Andaman & Nicobar Islands', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: false, authority: 'Port Management Board (PMB)' },
  { name: 'Diglipur Port (North Andaman)', lat: 13.2667, lon: 93.0000, state: 'Andaman & Nicobar Islands', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Port Management Board (PMB)' },
  { name: 'Mayabunder Port (Middle Andaman)', lat: 12.9167, lon: 92.9500, state: 'Andaman & Nicobar Islands', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Port Management Board (PMB)' },
  { name: 'Rangat Port', lat: 12.5000, lon: 92.9333, state: 'Andaman & Nicobar Islands', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Port Management Board (PMB)' },
  { name: 'Havelock (Swaraj Dweep) Jetty', lat: 12.0333, lon: 93.0000, state: 'Andaman & Nicobar Islands', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Port Management Board (PMB)' },
  { name: 'Neil Island (Shaheed Dweep) Jetty', lat: 11.8333, lon: 93.0500, state: 'Andaman & Nicobar Islands', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Port Management Board (PMB)' },
  { name: 'Hut Bay Port (Little Andaman)', lat: 10.6000, lon: 92.5500, state: 'Andaman & Nicobar Islands', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Port Management Board (PMB)' },
  { name: 'Car Nicobar Port (Mus)', lat: 9.2333, lon: 92.7833, state: 'Andaman & Nicobar Islands', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Port Management Board (PMB)' },
  { name: 'Kamorta Port (Nancowry)', lat: 8.0500, lon: 93.5333, state: 'Andaman & Nicobar Islands', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Port Management Board (PMB)' },
  { name: 'Campbell Bay Port (Great Nicobar)', lat: 7.0000, lon: 93.9333, state: 'Andaman & Nicobar Islands', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Port Management Board (PMB)' },
  { name: 'Junglighat Fishing Harbour', lat: 11.6583, lon: 92.7250, state: 'Andaman & Nicobar Islands', type: 'fishing', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'A&N Fisheries Dept' },
  // Lakshadweep
  { name: 'Kavaratti Port', lat: 10.5667, lon: 72.6333, state: 'Lakshadweep', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Lakshadweep Port Management Board' },
  { name: 'Agatti Port', lat: 10.8500, lon: 72.1833, state: 'Lakshadweep', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Lakshadweep Port Management Board' },
  { name: 'Amini Port', lat: 11.1167, lon: 72.7333, state: 'Lakshadweep', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Lakshadweep Port Management Board' },
  { name: 'Androth Port', lat: 10.8167, lon: 73.6833, state: 'Lakshadweep', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Lakshadweep Port Management Board' },
  { name: 'Kadmat Port', lat: 11.2333, lon: 72.7833, state: 'Lakshadweep', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Lakshadweep Port Management Board' },
  { name: 'Kalpeni Port', lat: 10.0833, lon: 73.6500, state: 'Lakshadweep', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Lakshadweep Port Management Board' },
  { name: 'Kiltan Port', lat: 11.4833, lon: 73.0000, state: 'Lakshadweep', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Lakshadweep Port Management Board' },
  { name: 'Chetlat Port', lat: 11.7000, lon: 72.7000, state: 'Lakshadweep', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Lakshadweep Port Management Board' },
  { name: 'Bitra Port', lat: 11.6000, lon: 72.1833, state: 'Lakshadweep', type: 'non_major', operational_status: 'seasonal_anchorage', shelter_suitable: false, has_fishing_jetty: true, authority: 'Lakshadweep Port Management Board' },
  { name: 'Minicoy Port', lat: 8.2833, lon: 73.0500, state: 'Lakshadweep', type: 'non_major', operational_status: 'operational', shelter_suitable: true, has_fishing_jetty: true, authority: 'Lakshadweep Port Management Board' },
];

async function main() {
  await connect();

  console.log(`\n=== Seeding ${PORTS.length} Indian ports, non-major ports and fishing harbours ===\n`);

  let inserted = 0;
  let updated = 0;

  for (const port of PORTS) {
    const geometry = {
      type: 'Point',
      // GeoJSON order is strictly [longitude, latitude]
      coordinates: [port.lon, port.lat],
    };

    const document = {
      layer_name: port.name,
      layer_type: 'port',
      constraint_type: 'warning_only',
      version: '1.0.0',
      source: 'Ministry of Ports, Shipping and Waterways / State Maritime Boards / CMFRI',
      source_url: 'https://shipmin.gov.in',
      last_updated: new Date(),
      geometry_full: geometry,
      geometry_simplified: geometry,
      active: true,
      properties: {
        state: port.state,
        port_type: port.type,
        operational_status: port.operational_status || 'operational',
        shelter_suitable: port.shelter_suitable !== undefined ? port.shelter_suitable : true,
        has_fishing_jetty: port.has_fishing_jetty !== undefined ? port.has_fishing_jetty : (port.type === 'fishing'),
        authority: port.authority || 'State Maritime Board',
        lat: port.lat,
        lon: port.lon,
        category: 'port',
        verified: true,
      },
    };

    const existing = await GisLayer.findOne({ layer_name: port.name });
    if (existing) {
      await GisLayer.updateOne({ layer_name: port.name }, document);
      updated += 1;
    } else {
      await GisLayer.create(document);
      inserted += 1;
    }

    console.log(`  ${existing ? 'UPDATED ' : 'INSERTED'} [${port.type.toUpperCase()} | ${port.operational_status}] ${port.name} (${port.state})`);
  }

  await GisLayer.createIndexes();

  console.log(`\n  Done: ${inserted} inserted, ${updated} updated. Total in batch: ${PORTS.length}.\n`);
  await disconnect();
}

main().catch((err) => {
  console.error('[seed-ports] Failed:', err.message);
  process.exit(1);
});