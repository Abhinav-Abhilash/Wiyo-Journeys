import fs from 'fs';

console.log('🔍 Comprehensive Read-Only Audit of All Dataset Sources...');

// 1. Ingest KochiTransport GTFS
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = [];
    let inQuote = false;
    let curr = '';
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        values.push(curr.trim().replace(/^"|"$/g, ''));
        curr = '';
      } else {
        curr += char;
      }
    }
    values.push(curr.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || '';
    });
    rows.push(obj);
  }
  return rows;
}

const gtfsStops = parseCSV(fs.readFileSync('KochiTransport/stops.txt', 'utf8'));
const gtfsRoutes = parseCSV(fs.readFileSync('KochiTransport/routes.txt', 'utf8'));
const gtfsTrips = parseCSV(fs.readFileSync('KochiTransport/trips.txt', 'utf8'));
const gtfsFrequencies = parseCSV(fs.readFileSync('KochiTransport/frequencies.txt', 'utf8'));

// 2. Ingest Tvmtransport CSVs
const tvmOffices = parseCSV(fs.readFileSync('Tvmtransport/Kerala_MVD_KSRTC_Offices.csv', 'utf8'));
const tvmInfra = parseCSV(fs.readFileSync('Tvmtransport/TVM_Bus_Infrastructure.csv', 'utf8'));

// 3. Ingest RTI Private Bus Schedules (via network or cache)
async function fetchDistrict(file) {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/amith-vp/Kerala-Private-Bus-Timing/main/${file}`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.busSchedules || (Array.isArray(json) ? json : []);
  } catch {
    return [];
  }
}

const [ekm, att, alp, ktm] = await Promise.all([
  fetchDistrict('ernakulam.json'),
  fetchDistrict('attingal.json'),
  fetchDistrict('alappuzha.json'),
  fetchDistrict('kottayam.json')
]);

console.log('\n=== 1. SOURCE ENTRY COUNTS ===');
console.log(`- Source A (KochiTransport GTFS): ${gtfsStops.length} stops, ${gtfsRoutes.length} routes, ${gtfsTrips.length} trips, ${gtfsFrequencies.length} frequency records`);
console.log(`- Source B (Tvmtransport MVD/KSRTC): ${tvmOffices.length} offices/depots, ${tvmInfra.length} infrastructure records`);
console.log(`- Source C (RTI Private Bus Timings):`);
console.log(`    * Ernakulam: ${ekm.length} schedules`);
console.log(`    * Attingal/TVM: ${att.length} schedules`);
console.log(`    * Alappuzha: ${alp.length} schedules`);
console.log(`    * Kottayam: ${ktm.length} schedules`);
console.log(`    * Total RTI Schedules: ${ekm.length + att.length + alp.length + ktm.length}`);

// Let's analyze overlaps, naming differences, and coordinate differences across major Kerala hubs
const targetHubs = [
  { key: 'Aluva', pattern: /aluva|alwaye/i },
  { key: 'Ernakulam South', pattern: /south.*railway|ernakulam.*south|jos.*junction/i },
  { key: 'Menaka / Marine Drive', pattern: /menaka|marine.*drive|shanmugham/i },
  { key: 'Maharajas / MG Road', pattern: /maharaja|mg.*road/i },
  { key: 'Kaloor', pattern: /kaloor|jln/i },
  { key: 'Edappally / Lulu', pattern: /edappally|lulu/i },
  { key: 'Palarivattom', pattern: /palarivattom/i },
  { key: 'Kalamassery', pattern: /kalamassery/i },
  { key: 'Vyttila', pattern: /vyttila|vytilla/i },
  { key: 'Kakkanad / Infopark', pattern: /kakkanad|infopark/i },
  { key: 'Fort Kochi', pattern: /fort.*kochi/i },
  { key: 'Thoppumpady', pattern: /thoppumpady/i },
  { key: 'North Paravur', pattern: /paravur|parur/i },
  { key: 'Angamaly', pattern: /angamaly|angamali/i },
  { key: 'Thrissur / Sakthan', pattern: /thrissur|trichur|sakthan/i },
  { key: 'Thampanoor / TVM', pattern: /thampanoor|trivandrum|thiruvananthapuram/i },
  { key: 'Attingal', pattern: /attingal/i },
  { key: 'Alappuzha', pattern: /alappuzha|alleppey/i },
  { key: 'Cherthala', pattern: /cherthala|shertallai/i },
  { key: 'Kottayam', pattern: /kottayam/i },
];

console.log('\n=== 2. CROSS-SOURCE STOP NAME VARIATIONS & SPELLING ALIASES ===');
targetHubs.forEach(hub => {
  const matchedGTFS = gtfsStops.filter(s => hub.pattern.test(s.stop_name));
  const uniqueGtfsNames = [...new Set(matchedGTFS.map(s => s.stop_name))].slice(0, 4);
  
  const matchedTvm = tvmOffices.filter(o => hub.pattern.test(o.Office_Name || '') || hub.pattern.test(o.Station || ''));
  const uniqueTvmNames = [...new Set(matchedTvm.map(o => o.Office_Name || o.Station))];

  console.log(`📍 Hub: ${hub.key}`);
  console.log(`   - GTFS Stop Name Variants (${matchedGTFS.length} stops found): ${uniqueGtfsNames.join(' | ') || 'None'}`);
  console.log(`   - MVD/Depot Variants: ${uniqueTvmNames.join(' | ') || 'None'}`);
});

// Check coordinate variations for key hubs
console.log('\n=== 3. COORDINATE VARIATIONS & DISCREPANCIES ===');
targetHubs.slice(0, 8).forEach(hub => {
  const matchedGTFS = gtfsStops.filter(s => hub.pattern.test(s.stop_name));
  if (matchedGTFS.length > 0) {
    const lats = matchedGTFS.map(s => parseFloat(s.stop_lat)).filter(n => !isNaN(n));
    const lngs = matchedGTFS.map(s => parseFloat(s.stop_lon)).filter(n => !isNaN(n));
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latDiffMeters = Math.round((maxLat - minLat) * 111000);
    const lngDiffMeters = Math.round((maxLng - minLng) * 111000);
    console.log(`📍 ${hub.key}:`);
    console.log(`   - GTFS Sub-stop count: ${matchedGTFS.length}`);
    console.log(`   - Lat span: ${minLat.toFixed(4)} to ${maxLat.toFixed(4)} (~${latDiffMeters}m variance)`);
    console.log(`   - Lng span: ${minLng.toFixed(4)} to ${maxLng.toFixed(4)} (~${lngDiffMeters}m variance)`);
  }
});
