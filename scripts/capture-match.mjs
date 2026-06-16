// One-off script to capture a FotMob match page and save raw JSON.
// Usage: node scripts/capture-match.mjs <fotmob-match-url> <output-filename>
// Example: node scripts/capture-match.mjs 'https://www.fotmob.com/matches/new-zealand-vs-iran/1ar30l' iran-new-zealand
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = join(root, 'data', 'raw');

const url = process.argv[2];
const slug = process.argv[3];
if (!url || !slug) {
  console.error('Usage: node scripts/capture-match.mjs <url> <slug>');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors', '--disable-web-security'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true });

console.log(`Navigating to ${url} …`);
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

// Give the Next.js app time to hydrate
await page.waitForTimeout(4000);

const data = await page.evaluate(() => {
  const nd = window.__NEXT_DATA__?.props?.pageProps;
  if (!nd) return null;

  const gen = nd.general ?? {};
  const content = nd.content ?? {};

  // --- match identity ---
  const matchId = String(gen.matchId ?? '');
  const league = gen.leagueName ?? gen.tournamentName ?? 'FIFA World Cup';
  const kickoff = gen.kickoff ?? gen.kickoffTime ?? null;

  // --- teams ---
  const colors = gen.teamColors ?? {};
  const home = {
    id: gen.homeTeam?.id ?? null,
    name: gen.homeTeam?.name ?? '',
    color: (colors.home ?? '').toLowerCase()
  };
  const away = {
    id: gen.awayTeam?.id ?? null,
    name: gen.awayTeam?.name ?? '',
    color: (colors.away ?? '').toLowerCase()
  };

  // --- weather ---
  const w = content.weather ?? {};
  const weather = {
    temperature: w.temperature ?? null,
    relativeHumidity: w.relativeHumidity ?? w.humidity ?? null,
    windSpeed: w.windSpeed ?? null,
    windDirectionCardinal: w.windDirectionCardinal ?? null,
    precipitation: w.precipitation ?? null,
    cloudCover: w.cloudCover ?? null,
    description: w.description ?? null
  };

  // --- goals ---
  const events = content.matchFacts?.events?.events ?? content.matchFacts?.events ?? [];
  const goals = events
    .filter((e) => e.type === 'Goal' || e.type === 'OwnGoal' || (e.type && e.type.toLowerCase().includes('goal')))
    .map((e) => ({
      minute: e.time ?? e.minute ?? e.min ?? null,
      team: e.isHome !== undefined ? (e.isHome ? 'home' : 'away') : (e.teamId === gen.homeTeam?.id ? 'home' : 'away'),
      player: e.isOwnGoal ? `${e.playerName ?? e.player} (OG)` : (e.playerName ?? e.player ?? ''),
      score: e.score ?? null
    }));

  // --- momentum ---
  const momentumData = content.momentum?.main?.data ?? [];
  const momentum = momentumData.map((pt) => [pt.minute ?? pt.min, pt.value ?? pt.val]);

  return {
    matchId,
    league,
    kickoffUTC: kickoff,
    home,
    away,
    weather,
    goals,
    momentumCount: momentum.length,
    momentum
  };
});

await browser.close();

if (!data) {
  console.error('Could not extract __NEXT_DATA__ from page.');
  process.exit(1);
}

console.log(`Match: ${data.home.name} vs ${data.away.name}  id=${data.matchId}`);
console.log(`Kickoff: ${data.kickoffUTC}`);
console.log(`Goals: ${data.goals.length}`);
console.log(`Momentum points: ${data.momentumCount}`);

const out = {
  source: 'FotMob',
  matchId: data.matchId,
  league: data.league,
  kickoffUTC: data.kickoffUTC,
  home: data.home,
  away: data.away,
  weather: data.weather,
  goals: data.goals,
  momentumNote: `FotMob per-minute, ${data.momentumCount} points`,
  momentum: data.momentum
};

const outFile = join(rawDir, `fotmob-${data.matchId}-${slug}.json`);
writeFileSync(outFile, JSON.stringify(out, null, '\t') + '\n');
console.log(`Wrote ${outFile}`);
