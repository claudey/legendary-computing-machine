#!/usr/bin/env node
/**
 * update.mjs  —  WC 2026 dataset updater (run locally, no AI agent needed)
 *
 * Usage:
 *   node scripts/update.mjs             # full run: fetch, capture, build, commit, push
 *   node scripts/update.mjs --dry-run   # stop before commit/push
 *   node scripts/update.mjs --no-push   # commit but don't push
 *
 * Requirements:
 *   - Node.js 18+ (built-in fetch)
 *   - Internet access (openfootball, FotMob)
 *   - Optional: playwright for momentum data
 *       npm install playwright && npx playwright install chromium
 *
 * Logs to: logs/update-<ISO-timestamp>.log
 */

import {
  readFileSync, writeFileSync, readdirSync, mkdirSync, appendFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = join(ROOT, 'data', 'raw');

const DRY_RUN = process.argv.includes('--dry-run');
const NO_PUSH  = process.argv.includes('--no-push');

// ─── Logging ─────────────────────────────────────────────────────────────────

const LOGS_DIR = join(ROOT, 'logs');
mkdirSync(LOGS_DIR, { recursive: true });
const RUN_TS  = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const LOG_FILE = join(LOGS_DIR, `update-${RUN_TS}.log`);

function log(msg, level = 'INFO') {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + '\n');
}
const warn  = (m) => log(m, 'WARN');
const error = (m) => log(m, 'ERROR');

log(`Log: ${LOG_FILE}`);
if (DRY_RUN) log('DRY RUN — will not commit or push');
if (NO_PUSH)  log('NO PUSH — will commit but not push');

// ─── Team name map (openfootball → FotMob) ───────────────────────────────────

const OF_TO_FOTMOB = {
  'Bosnia and Herzegovina': 'Bosnia-Herzegovina',
  'Bosnia & Herzegovina':   'Bosnia-Herzegovina',
  "Côte d'Ivoire":          'Ivory Coast',
  "Cote d'Ivoire":          'Ivory Coast',
  'United States':          'USA',
  'Czech Republic':         'Czechia',
  'Congo DR':               'DR Congo',
  'Democratic Republic of Congo': 'DR Congo',
  'Republic of Korea':      'South Korea',
  'Korea Republic':         'South Korea',
  'IR Iran':                'Iran',
};

function normalizeTeam(name) {
  return OF_TO_FOTMOB[name] ?? name;
}

// ─── Fallback team colors ─────────────────────────────────────────────────────
// sourced from existing data/raw files; FotMob API colors take precedence

const TEAM_COLORS = {
  'Mexico':             '#00634b',
  'South Africa':       '#d89f28',
  'South Korea':        '#c60c30',
  'Czechia':            '#d7141a',
  'Qatar':              '#8d1b3d',
  'Switzerland':        '#ff0000',
  'Brazil':             '#FFEA00',
  'Morocco':            '#E6251E',
  'Germany':            '#000000',
  'Curacao':            '#003087',
  'Ivory Coast':        '#f77f00',
  'Ecuador':            '#ffda00',
  'Sweden':             '#006AA7',
  'Tunisia':            '#e70013',
  'Netherlands':        '#ff4500',
  'Japan':              '#bc002d',
  'Australia':          '#005630',
  'Turkey':             '#e30a17',
  'Spain':              '#c60b1e',
  'Cape Verde':         '#009e60',
  'Saudi Arabia':       '#006c35',
  'Uruguay':            '#5EB6E4',
  'Belgium':            '#ED2939',
  'Egypt':              '#C09300',
  'Canada':             '#FF0000',
  'Bosnia-Herzegovina': '#002395',
  'Haiti':              '#00209f',
  'Scotland':           '#005eb8',
  'USA':                '#b22234',
  'Paraguay':           '#d52b1e',
  'Norway':             '#EF2B2D',
  'Iraq':               '#007a3d',
  'Austria':            '#ED2939',
  'Jordan':             '#007A3D',
  'France':             '#003189',
  'Senegal':            '#00853f',
  'Argentina':          '#74acdf',
  'Algeria':            '#006233',
  'Iran':               '#239f40',
  'New Zealand':        '#ffffff',
  'Uzbekistan':         '#1eb53a',
  'Colombia':           '#FCD116',
  'Portugal':           '#006600',
  'DR Congo':           '#007fff',
  'England':            '#6FA3E6',
  'Croatia':            '#CC3737',
  'Ghana':              '#100f10',
  'Panama':             '#BF1F27',
};

function teamColor(name) {
  return TEAM_COLORS[name] ?? '#888888';
}

function slugify(name) {
  return name.toLowerCase()
    .replace(/['']/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function parseMinute(str) {
  if (typeof str === 'number') return str;
  return parseInt(String(str).replace(/\D/g, ''), 10) || 0;
}

// ─── Fetch with retries ───────────────────────────────────────────────────────

async function fetchJSON(url, opts = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'application/json, */*',
    ...opts.headers,
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { ...opts, headers });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      return await r.json();
    } catch (e) {
      if (attempt === 3) throw e;
      const delay = attempt * 2000;
      warn(`  fetch attempt ${attempt} failed (${e.message}), retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

// ─── Step 1: Fetch openfootball data ─────────────────────────────────────────

log('Fetching openfootball worldcup.json...');
let ofData;
try {
  ofData = await fetchJSON(
    'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json',
  );
  const roundCount = (ofData.rounds ?? ofData.groups ?? []).length;
  log(`Fetched openfootball: ${roundCount} rounds/groups`);
} catch (e) {
  error(`Failed to fetch openfootball data: ${e.message}`);
  process.exit(1);
}

// ─── Step 2: Index existing raw files ────────────────────────────────────────

const existingFiles = readdirSync(RAW_DIR).filter(f => f.endsWith('.json'));
// key: "HomeName|AwayName|YYYY-MM-DD"
const existingKeys = new Set();

for (const file of existingFiles) {
  try {
    const raw = JSON.parse(readFileSync(join(RAW_DIR, file), 'utf8'));
    const date = raw.kickoffUTC.slice(0, 10);
    existingKeys.add(`${raw.home.name}|${raw.away.name}|${date}`);
  } catch (e) {
    warn(`Could not parse ${file}: ${e.message}`);
  }
}

log(`Existing raw files: ${existingFiles.length}`);

// ─── Step 3: Find completed matches not yet captured ─────────────────────────

const rounds = ofData.rounds ?? ofData.groups ?? [];
const toCapture = [];

for (const round of rounds) {
  // Normalise the group/stage label
  let group = round.name ?? '';
  if (/group/i.test(group)) {
    const m = group.match(/Group\s+([A-Z])/i);
    group = m ? `Group ${m[1].toUpperCase()}` : group;
  }

  for (const match of (round.matches ?? [])) {
    if (!match.score?.ft) continue; // not finished

    const home = normalizeTeam(match.team1?.name ?? match.home?.name ?? '');
    const away = normalizeTeam(match.team2?.name ?? match.away?.name ?? '');
    const date = match.date; // YYYY-MM-DD from openfootball

    if (!home || !away || !date) { warn(`Skipping malformed match: ${JSON.stringify(match)}`); continue; }
    if (existingKeys.has(`${home}|${away}|${date}`)) { log(`Already captured: ${home} v ${away} ${date}`); continue; }

    const goals = [
      ...(match.goals1 ?? []).map(g => ({
        minute: parseMinute(g.minute ?? g.min),
        team:   'home',
        player: g.name ?? g.player ?? '',
      })),
      ...(match.goals2 ?? []).map(g => ({
        minute: parseMinute(g.minute ?? g.min),
        team:   'away',
        player: g.name ?? g.player ?? '',
      })),
    ].sort((a, b) => a.minute - b.minute);

    toCapture.push({
      home, away, date, group,
      score:     match.score.ft,          // [homeGoals, awayGoals]
      ofGoals:   goals,                   // openfootball goals (abbreviated names)
      time:      match.time ?? null,      // local/UTC time string e.g. "19:00"
    });
  }
}

log(`New completed matches to capture: ${toCapture.length}`);
if (toCapture.length === 0) {
  log('Dataset is already up to date. Nothing to do.');
  process.exit(0);
}

// ─── Step 4: For each new match, pull FotMob data ────────────────────────────

const addedFiles = [];

for (const match of toCapture) {
  log(`\n── ${match.home} v ${match.away}  (${match.date}) ──`);

  let matchId      = null;
  let kickoffUTC   = buildKickoffUTC(match.date, match.time);
  let fotmobGoals  = null;
  let weather      = null;
  let momentum     = [];
  let momentumNote = null;

  // 4a. FotMob matches-by-date API
  const dateStr = match.date.replace(/-/g, '');
  try {
    log(`  FotMob /api/matches?date=${dateStr}`);
    const data = await fetchJSON(`https://www.fotmob.com/api/matches?date=${dateStr}`);

    outer:
    for (const league of (data.leagues ?? [])) {
      const lname = (league.name ?? '').toLowerCase();
      if (!lname.includes('world cup') && !(league.ccode ?? '').toUpperCase().includes('WLD')) continue;

      for (const m of (league.matches ?? [])) {
        const h = normalizeTeam(m.home?.name ?? m.homeTeam?.name ?? '');
        const a = normalizeTeam(m.away?.name ?? m.awayTeam?.name ?? '');
        if (h !== match.home || a !== match.away) continue;

        // Extract alphanumeric slug from pageUrl if present, else use numeric id
        const pageUrl  = m.pageUrl ?? '';
        const slugHit  = pageUrl.match(/\/([^/]+)$/);
        matchId        = slugHit ? slugHit[1] : String(m.id ?? '');
        kickoffUTC     = m.status?.utcTime ?? m.kickoffTime ?? kickoffUTC;
        log(`  Found: matchId=${matchId}  kickoff=${kickoffUTC}`);
        break outer;
      }
    }

    if (!matchId) warn('  Match not found in FotMob API response (may not be listed yet)');
  } catch (e) {
    warn(`  FotMob matches API failed: ${e.message}`);
  }

  // 4b. FotMob matchDetails API (weather, goals with full names, momentum)
  if (matchId) {
    try {
      log(`  FotMob /api/matchDetails?matchId=${matchId}`);
      const detail = await fetchJSON(`https://www.fotmob.com/api/matchDetails?matchId=${matchId}`);
      const gen     = detail.general    ?? {};
      const content = detail.content    ?? {};

      // Colors (update fallback table in case we need them later)
      const colors = gen.teamColors ?? {};
      if (colors.home) TEAM_COLORS[match.home] = colors.home.toLowerCase();
      if (colors.away) TEAM_COLORS[match.away] = colors.away.toLowerCase();

      // Kickoff
      kickoffUTC = gen.kickoff ?? gen.kickoffTime ?? kickoffUTC;

      // Weather
      const w = content.weather ?? {};
      if (w.temperature != null) {
        weather = {
          temperature:      w.temperature,
          relativeHumidity: w.relativeHumidity ?? w.humidity ?? null,
          description:      w.description ?? null,
        };
        log(`  Weather: ${weather.temperature}°C, ${weather.description}`);
      }

      // Goals (full player names from FotMob)
      const homeId = gen.homeTeam?.id;
      const events = content.matchFacts?.events?.events
                  ?? content.matchFacts?.events
                  ?? [];
      const fGoals = events.filter(e =>
        e.type === 'Goal' || e.type === 'OwnGoal' ||
        (typeof e.type === 'string' && e.type.toLowerCase().includes('goal'))
      );
      if (fGoals.length > 0) {
        fotmobGoals = fGoals.map(e => ({
          minute: e.time ?? e.minute ?? e.min ?? 0,
          team:   e.isHome !== undefined
                    ? (e.isHome ? 'home' : 'away')
                    : (e.teamId === homeId ? 'home' : 'away'),
          player: e.isOwnGoal
                    ? `${e.playerName ?? e.player ?? ''} (OG)`.trim()
                    : (e.playerName ?? e.player ?? ''),
        }));
        log(`  Goals from FotMob: ${fotmobGoals.length}`);
      }

      // Momentum
      const pts = content.momentum?.main?.data ?? [];
      if (pts.length > 0) {
        momentum     = pts.map(pt => [pt.minute ?? pt.min, pt.value ?? pt.val]);
        momentumNote = `value > 0 = home (${match.home}) pressure, value < 0 = away (${match.away}) pressure`;
        log(`  Momentum: ${pts.length} points`);
      }
    } catch (e) {
      warn(`  FotMob matchDetails failed: ${e.message}`);
    }
  }

  // 4c. Playwright fallback — only if momentum still empty
  if (momentum.length === 0 && matchId) {
    log('  Attempting playwright for momentum...');
    const fotmobUrl = `https://www.fotmob.com/matches/${slugify(match.away)}-vs-${slugify(match.home)}/${matchId}`;
    const pw = await tryPlaywright(fotmobUrl);
    if (pw) {
      if (pw.momentum?.length > 0) {
        momentum     = pw.momentum;
        momentumNote = `value > 0 = home (${match.home}) pressure, value < 0 = away (${match.away}) pressure`;
        log(`  Playwright momentum: ${pw.momentum.length} points`);
      }
      if (!weather && pw.weather?.temperature != null) weather = pw.weather;
      if (!fotmobGoals && pw.goals?.length > 0) fotmobGoals = pw.goals;
      if (pw.home?.color) TEAM_COLORS[match.home] = pw.home.color;
      if (pw.away?.color) TEAM_COLORS[match.away] = pw.away.color;
      if (!matchId || matchId === pw.matchId) matchId = pw.matchId;
      kickoffUTC = pw.kickoffUTC ?? kickoffUTC;
    }
  }

  // 4d. Momentum not available — leave empty with a note
  if (momentum.length === 0) {
    const fotmobUrl = matchId
      ? `https://www.fotmob.com/matches/${slugify(match.away)}-vs-${slugify(match.home)}/${matchId}`
      : 'https://www.fotmob.com';
    momentumNote = `FotMob momentum not captured (FotMob blocked or playwright unavailable). Capture manually at ${fotmobUrl}`;
    warn(`  No momentum data captured`);
  }

  // 4e. Fall back to openfootball goals if FotMob goals unavailable
  const goals = fotmobGoals ?? match.ofGoals;
  if (!fotmobGoals) warn('  Using openfootball goal data (player names may be abbreviated)');

  // 4f. Ensure a usable matchId
  if (!matchId) {
    matchId = `unknown-${slugify(match.home)}-${slugify(match.away)}-${match.date}`;
    warn(`  No FotMob matchId — using placeholder: ${matchId}`);
  }

  // 4g. Build and write raw file
  const raw = {
    source:     'FotMob',
    matchId,
    league:     'FIFA World Cup',
    group:      match.group,
    kickoffUTC,
    home:       { name: match.home, color: teamColor(match.home) },
    away:       { name: match.away, color: teamColor(match.away) },
    weather:    weather ?? { temperature: null, relativeHumidity: null, description: null },
    goals,
    momentumNote,
    momentum,
  };

  const outFile = `fotmob-${matchId}-${slugify(match.home)}-${slugify(match.away)}.json`;
  if (!DRY_RUN) {
    writeFileSync(join(RAW_DIR, outFile), JSON.stringify(raw, null, '\t') + '\n');
    log(`  Wrote data/raw/${outFile}`);
  } else {
    log(`  [DRY RUN] Would write data/raw/${outFile}`);
  }

  addedFiles.push({ outFile, match });
}

// ─── Playwright helper ────────────────────────────────────────────────────────

async function tryPlaywright(url) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    warn('  playwright not installed — skipping momentum capture');
    warn('  Install with: npm install playwright && npx playwright install chromium');
    return null;
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    log(`  [playwright] ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(4000);

    return await page.evaluate(() => {
      const nd = window.__NEXT_DATA__?.props?.pageProps;
      if (!nd) return null;
      const gen     = nd.general ?? {};
      const content = nd.content  ?? {};
      const colors  = gen.teamColors ?? {};
      const w       = content.weather ?? {};
      const homeId  = gen.homeTeam?.id;
      const events  = content.matchFacts?.events?.events ?? [];
      const goals   = events
        .filter(e => e.type === 'Goal' || e.type === 'OwnGoal')
        .map(e => ({
          minute: e.time ?? e.minute ?? 0,
          team:   e.isHome !== undefined ? (e.isHome ? 'home' : 'away')
                                        : (e.teamId === homeId ? 'home' : 'away'),
          player: e.isOwnGoal ? `${e.playerName ?? ''} (OG)`.trim() : (e.playerName ?? ''),
        }));
      const pts = content.momentum?.main?.data ?? [];
      return {
        matchId:    String(gen.matchId ?? ''),
        kickoffUTC: gen.kickoff ?? gen.kickoffTime ?? null,
        home:       { name: gen.homeTeam?.name ?? '', color: (colors.home ?? '').toLowerCase() },
        away:       { name: gen.awayTeam?.name ?? '', color: (colors.away ?? '').toLowerCase() },
        weather:    {
          temperature:      w.temperature ?? null,
          relativeHumidity: w.relativeHumidity ?? w.humidity ?? null,
          description:      w.description ?? null,
        },
        goals,
        momentum: pts.map(pt => [pt.minute ?? pt.min, pt.value ?? pt.val]),
      };
    });
  } catch (e) {
    warn(`  [playwright] Error: ${e.message}`);
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}

// ─── KickoffUTC construction (fallback only) ──────────────────────────────────
// openfootball time is in UTC; we convert "HH:MM" → ISO string
function buildKickoffUTC(date, timeStr) {
  if (!timeStr) return `${date}T00:00:00.000Z`;
  const clean = timeStr.trim();
  // Handle "3:00 pm" style
  let [h, rest] = clean.split(':');
  let m = parseInt((rest ?? '0').replace(/\D/g, ''), 10) || 0;
  h = parseInt(h, 10);
  if (/pm/i.test(clean) && h < 12) h += 12;
  if (/am/i.test(clean) && h === 12) h = 0;
  return `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
}

// ─── Step 5: Rebuild matches.json ────────────────────────────────────────────

if (!DRY_RUN) {
  log('\nRunning build-data.mjs...');
  try {
    const out = execSync('node scripts/build-data.mjs', { cwd: ROOT, encoding: 'utf8' });
    out.trim().split('\n').forEach(l => log(`  ${l}`));
  } catch (e) {
    error(`build-data.mjs failed:\n${e.stderr ?? e.message}`);
    process.exit(1);
  }
}

// ─── Step 6: Git commit and push ─────────────────────────────────────────────

if (!DRY_RUN) {
  const matchLines = addedFiles.map(({ match }) =>
    `- ${match.date}: ${match.home} ${match.score[0]}-${match.score[1]} ${match.away}`
  ).join('\n');

  const commitMsg =
    `feat: add ${addedFiles.length} new WC 2026 match${addedFiles.length !== 1 ? 'es' : ''}\n\n${matchLines}`;

  log('\nCommitting...');
  try {
    execSync('git add data/raw/ src/lib/data/matches.json', { cwd: ROOT });
    execSync(`git commit -m ${JSON.stringify(commitMsg)}`, { cwd: ROOT, stdio: 'pipe' });
    log('Committed');
  } catch (e) {
    error(`git commit failed: ${e.message}`);
    process.exit(1);
  }

  if (!NO_PUSH) {
    log('Pushing to main...');
    let pushed = false;
    for (let attempt = 1; attempt <= 4 && !pushed; attempt++) {
      try {
        execSync('git push -u origin main', { cwd: ROOT, stdio: 'pipe' });
        pushed = true;
        log('Pushed to main');
      } catch (e) {
        if (attempt === 4) {
          error(`git push failed after 4 attempts: ${e.message}`);
          warn('Changes are committed locally. Re-run: git push -u origin main');
          process.exit(1);
        }
        const delay = attempt * 2000;
        warn(`Push attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  } else {
    log('--no-push: skipping git push');
  }
}

log(`\nDone. Added ${addedFiles.length} match${addedFiles.length !== 1 ? 'es' : ''}.`);
log(`Full log: ${LOG_FILE}`);
