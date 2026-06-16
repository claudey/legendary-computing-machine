# Momentum data capture recipe

## Source findings (2026-06-15)

| Source | Momentum available? | Verdict |
|--------|--------------------|---------|
| **FotMob** | ✅ Yes — clean per-minute series | **USE THIS.** Embedded in page `__NEXT_DATA__`, no auth needed. All 3 matches captured. |
| **Sofascore** | ⚠️ Exists for humans, blocked for automation | `/api/v1/event/{id}/graph` → `403 {"reason":"challenge"}` (Cloudflare bot-detection on our automated session) via XHR, top-level nav, and even the app's own request. The series is **not** in `__NEXT_DATA__` (only i18n strings; `hasPerformanceGraphFeature:false`), and the Attack Momentum graph **does not render** when the data call is blocked — so there is no SVG to scrape in automation either. Only route: a human opens the graph in a normal (non-automated) browser session and we scrape the rendered SVG. |
| **LiveScore** | ❌ No such feature | Match page tabs are Summary / Stats / Line-ups / H2H / Commentary. No momentum/pressure chart exists at all (no momentum text, 0 chart canvas). Nothing to capture or scrape. |

**Net:** FotMob is the single viable automated source. LiveScore offers no momentum; Sofascore is human-only.

## FotMob recipe (the working one)

1. Open the World Cup match list: `https://www.fotmob.com/leagues/77/matches/world-cup`
2. Grab match links (the id is the number after `#`): e.g. `/matches/south-africa-vs-mexico/1einvt#4667751`
3. Navigate to the match page, wait ~4s for hydration.
4. Read from the page context:
   - `window.__NEXT_DATA__.props.pageProps.general` → `matchId`, `homeTeam`, `awayTeam`, `teamColors`, `kickoff`
   - `window.__NEXT_DATA__.props.pageProps.content.momentum.main.data` → `[{minute, value}]`
     - **value > 0 = home pressure, value < 0 = away pressure**
   - `window.__NEXT_DATA__.props.pageProps.content.weather` → temp / humidity (relevant to hydration breaks)
   - `window.__NEXT_DATA__.props.pageProps.content.matchFacts.events` → goal events (cross-check vs openfootball)

## FotMob match ids (first 3 chronologically)

| # | Match | FotMob id |
|---|-------|-----------|
| 1 | Mexico 2–0 South Africa (Jun 11) | 4667751 ✅ captured |
| 2 | South Korea 2–1 Czech Republic (Jun 11) | 4667752 |
| 3 | Canada 1–1 Bosnia & Herzegovina (Jun 12) | 4667757 |

## Goal times (from openfootball, the source of truth for goal minutes)
https://github.com/openfootball/worldcup.json/blob/master/2026/worldcup.json
