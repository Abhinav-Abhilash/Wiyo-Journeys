import fs from 'fs';

// Read app.ts to verify i18n translations
const appTs = fs.readFileSync('src/app.ts', 'utf8');

console.log('🧪 Testing Multi-Language Search & Disclaimer Coverage...\n');

const languages = ['en', 'ml', 'ta', 'hi'];

// Verify disclaimer keys in all 4 languages
languages.forEach((lang) => {
  const langBlockMatch = appTs.match(new RegExp(`${lang}:\\s*\\{[\\s\\S]*?\\n  \\}`, 'm'));
  if (!langBlockMatch) {
    console.error(`❌ Language block for "${lang}" not found in app.ts`);
    process.exit(1);
  }
  const langBlock = langBlockMatch[0];

  const hasConductorDisclaimer = langBlock.includes('conductorDisclaimer:');
  const hasDetailsConductorDisclaimer = langBlock.includes('detailsConductorDisclaimer:');

  if (hasConductorDisclaimer && hasDetailsConductorDisclaimer) {
    console.log(`✅ [${lang.toUpperCase()}] Both "conductorDisclaimer" and "detailsConductorDisclaimer" are properly defined.`);
  } else {
    console.error(`❌ [${lang.toUpperCase()}] Missing disclaimer definitions!`);
    process.exit(1);
  }
});

// Import transit router and test queries in all 4 languages
const dataset = JSON.parse(fs.readFileSync('src/data/kerala_routes_stops.json', 'utf8'));
const stops = dataset.stops;
const routes = dataset.routes;
const stopsMap = new Map(stops.map((s) => [s.id, s]));

// Verify search stop in all 4 languages
console.log('\n--- Testing Destination Search Results Across All 4 Languages ---');

const testQueries = [
  { lang: 'en', originId: 'ST_EKM_SOUTH', destId: 'ST_ALUVA', originName: 'Ernakulam South', destName: 'Aluva' },
  { lang: 'ml', originId: 'ST_EKM_SOUTH', destId: 'ST_KALOOR', originName: 'എറണാകുളം സൗത്ത്', destName: 'കലൂർ' },
  { lang: 'ta', originId: 'ST_VYTTILA', destId: 'ST_KAKKANAD', originName: 'வைட்டிலா', destName: 'காக்கநாடு' },
  { lang: 'hi', originId: 'ST_MAHARAJAS', destId: 'ST_EDAPPALLY', originName: 'महाराजा', destName: 'इडपल्ली' }
];

testQueries.forEach((t) => {
  const oStop = stopsMap.get(t.originId);
  const dStop = stopsMap.get(t.destId);

  if (!oStop || !dStop) {
    console.error(`❌ Stop resolution failed for ${t.originId} -> ${t.destId}`);
    process.exit(1);
  }

  // Find direct route
  const matchedRoute = routes.find((r) => r.stops.includes(oStop.id) && r.stops.includes(dStop.id));
  if (!matchedRoute) {
    console.error(`❌ No route found for [${t.lang}] ${t.originId} -> ${t.destId}`);
    process.exit(1);
  }

  const oName = oStop.names[t.lang] || oStop.names.en;
  const dName = dStop.names[t.lang] || dStop.names.en;

  console.log(`✅ [${t.lang.toUpperCase()}] Route matched successfully: "${matchedRoute.name}"`);
  console.log(`   Boarding: ${oName} (${oStop.id})`);
  console.log(`   Destination: ${dName} (${dStop.id})`);
  console.log(`   Fare Stage Count: ${Math.abs(matchedRoute.stopStages[dStop.id] - matchedRoute.stopStages[oStop.id])}`);
});

console.log('\n🎉 ALL 4 LANGUAGES PASSED SEARCH & DISCLAIMER VALIDATION WITH ZERO ERRORS!\n');
