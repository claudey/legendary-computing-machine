// Transforms raw FotMob captures (data/raw/*.json) into the app dataset
// (src/lib/data/matches.json). Re-run after adding new captures.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = join(root, 'data', 'raw');
const outDir = join(root, 'src', 'lib', 'data');

// Fixed hydration/cooling-break reference marks (minutes), per project spec.
const BREAK_MARKS = [22, 45, 67];

const files = readdirSync(rawDir).filter((f) => f.endsWith('.json'));

const matches = files.map((file) => {
  const r = JSON.parse(readFileSync(join(rawDir, file), 'utf8'));
  const date = r.kickoffUTC.slice(0, 10);
  const score = r.goals.reduce(
    (acc, g) => {
      if (g.team === 'home') acc[0]++;
      else acc[1]++;
      return acc;
    },
    [0, 0]
  );
  return {
    id: r.matchId,
    source: r.source,
    league: r.league,
    group: r.group ?? (() => { const m = r.league.match(/Grp\.?\s*([A-Z])/); return m ? `Group ${m[1]}` : null; })(),
    date,
    kickoffUTC: r.kickoffUTC,
    home: { name: r.home.name, color: r.home.color },
    away: { name: r.away.name, color: r.away.color },
    score,
    weather: {
      temperature: r.weather?.temperature ?? null,
      humidity: r.weather?.humidity ?? r.weather?.relativeHumidity ?? null,
      description: r.weather?.description ?? null
    },
    breakMarks: BREAK_MARKS,
    goals: r.goals.map((g) => ({ minute: g.minute ?? g.min, team: g.team, player: g.player })),
    // momentum: [minute, value] where value in [-100,100]; + = home, - = away
    momentum: r.momentum
  };
});

// Order chronologically by kickoff.
matches.sort((a, b) => a.kickoffUTC.localeCompare(b.kickoffUTC));

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'matches.json'), JSON.stringify(matches, null, '\t') + '\n');
console.log(`Wrote ${matches.length} matches to src/lib/data/matches.json`);
for (const m of matches)
  console.log(
    `  ${m.date}  ${m.home.name} ${m.score[0]}-${m.score[1]} ${m.away.name}  (${m.momentum.length} pts, ${m.weather.temperature}°C)`
  );
