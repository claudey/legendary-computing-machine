Update the WC 2026 match dataset with any newly completed matches, then push to main.

Steps:
1. Fetch https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json and identify every match that now has a completed score but whose FotMob matchId is NOT yet present in src/lib/data/matches.json.
2. For each missing completed match:
   a. Search the web for the FotMob match URL (pattern: fotmob.com/matches/{away}-vs-{home}/{slug}) to find the slug (e.g. "1ar30l"). Use the slug as the matchId.
   b. Create data/raw/fotmob-{slug}-{home}-{away}.json following the exact schema of existing files in data/raw/. Goals come from openfootball (source of truth). Weather is estimated from venue city and time of day. momentum must be [] with a momentumNote explaining FotMob is blocked by egress policy and linking to the match URL for manual capture.
3. Run: node scripts/build-data.mjs
4. Commit all new raw files + updated src/lib/data/matches.json to main with a clear message listing each new match.
5. Push to main: git push -u origin main

Do not add matches that have not yet been played (no score in openfootball). Do not modify existing raw files. Do not create a pull request — push directly to main.
