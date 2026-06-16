# WC 2026 · Hydration & Momentum

A small SvelteKit visualization exploring how **hydration / cooling breaks** relate to the
**momentum** and outcome of 2026 World Cup matches.

- **Left ¼** — searchable match list.
- **Right ¾** — attack-momentum chart for the selected match, with fixed reference marks at
  the **22'**, **45' (HT)** and **67'** minutes, plus goal markers and a momentum-share / peak-pressure summary.
- Type: IBM Plex Sans (self-hosted via `@fontsource`), tiny custom CSS design system (no Tailwind).

## Data

Momentum is **static**, captured once into `data/raw/*.json` and transformed into the app
dataset. See [`data/CAPTURE.md`](data/CAPTURE.md) for the full source investigation and recipe.

| Source | Momentum | Status |
|--------|----------|--------|
| **FotMob** | per-minute series | The working source — embedded in page `__NEXT_DATA__`. |
| **Sofascore** | human-only | Momentum endpoint is Cloudflare-blocked for automation; not embedded; graph doesn't render. |
| **LiveScore** | none | No momentum/pressure feature exists. |

Goal **times** come from [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json/blob/master/2026/worldcup.json)
and are cross-checked against the captured data.

The seed set is the **first three matches chronologically**: Mexico–South Africa,
South Korea–Czechia, Canada–Bosnia & Herzegovina.

### Regenerate the dataset

After adding or editing a capture in `data/raw/`:

```sh
node scripts/build-data.mjs   # → src/lib/data/matches.json
```

Momentum convention: `[minute, value]`, value in `[-100, 100]`, **positive = home**, negative = away.

## Develop

```sh
npm install
npm run dev      # http://localhost:5173
npm run check    # type / svelte-check
npm run build
```
