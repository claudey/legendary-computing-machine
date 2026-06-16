<script lang="ts">
	import { allMatches } from '$lib/data';
	import MatchList from '$lib/components/MatchList.svelte';
	import MomentumChart from '$lib/components/MomentumChart.svelte';

	let selectedId = $state(allMatches[0]?.id ?? '');
	const match = $derived(allMatches.find((m) => m.id === selectedId) ?? allMatches[0]);

	// momentum share: portion of total pressure belonging to each side
	const share = $derived.by(() => {
		let home = 0;
		let away = 0;
		for (const [, v] of match.momentum) {
			if (v >= 0) home += v;
			else away += -v;
		}
		const total = home + away || 1;
		return { home: Math.round((home / total) * 100), away: Math.round((away / total) * 100) };
	});

	const peakHome = $derived(Math.max(0, ...match.momentum.map(([, v]) => v)));
	const peakAway = $derived(-Math.min(0, ...match.momentum.map(([, v]) => v)));

	const fmtFull = (iso: string) =>
		new Date(iso).toLocaleDateString('en-GB', {
			weekday: 'short',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
</script>

<svelte:head>
	<title>WC 2026 · Hydration &amp; Momentum</title>
	<meta
		name="description"
		content="Do cooling breaks change the momentum of 2026 World Cup matches?"
	/>
</svelte:head>

<div class="app">
	<div class="col-list">
		<MatchList matches={allMatches} {selectedId} onselect={(id) => (selectedId = id)} />
	</div>

	<main class="col-detail" style="--home:{match.home.color}; --away:{match.away.color};">
		<header class="match-head">
			<div class="title">
				<div class="side">
					<i class="dot home"></i>
					<span class="name">{match.home.name}</span>
				</div>
				<div class="score mono">{match.score[0]}<span>:</span>{match.score[1]}</div>
				<div class="side away">
					<span class="name">{match.away.name}</span>
					<i class="dot away"></i>
				</div>
			</div>
			<div class="sub">
				<span class="chip">{match.league}</span>
				<span class="chip">{fmtFull(match.kickoffUTC)}</span>
				<span class="chip" class:warm={(match.weather.temperature ?? 0) >= 28}>
					🌡 {match.weather.temperature}°C · {match.weather.humidity}% RH · {match.weather
						.description}
				</span>
			</div>
		</header>

		<section class="stats">
			<div class="stat">
				<span class="label">Momentum share</span>
				<div class="bar2" role="img" aria-label="Momentum share">
					<span class="seg home" style="width:{share.home}%"></span>
					<span class="seg away" style="width:{share.away}%"></span>
				</div>
				<div class="ends mono">
					<span>{share.home}%</span><span>{share.away}%</span>
				</div>
			</div>
			<div class="stat narrow">
				<span class="label">Peak pressure</span>
				<div class="peaks mono">
					<span class="home">{peakHome}</span>
					<span class="vs">vs</span>
					<span class="away">{peakAway}</span>
				</div>
			</div>
			<div class="stat narrow">
				<span class="label">Goals</span>
				<div class="goalmins mono">
					{#each match.goals as g, i (i)}
						<span class="gm {g.team}">{g.minute}'</span>
					{:else}
						<span class="none">—</span>
					{/each}
				</div>
			</div>
		</section>

		<MomentumChart {match} />

		<p class="note">
			Vertical amber marks sit at the <strong>22'</strong>, <strong>45' (HT)</strong> and
			<strong>67'</strong> reference points. Momentum above the centre line favours
			<span class="ink home">{match.home.name}</span>; below favours
			<span class="ink away">{match.away.name}</span>. Source: {match.source}.
		</p>
	</main>
</div>

<style>
	.app {
		display: grid;
		grid-template-columns: minmax(260px, 1fr) 3fr;
		height: 100vh;
		height: 100dvh;
	}

	.col-list {
		min-height: 0;
		overflow: hidden;
	}

	.col-detail {
		min-width: 0;
		padding: 22px 26px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	/* ── match header ── */
	.match-head {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.title {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 18px;
	}
	.side {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 22px;
		font-weight: 600;
	}
	.side.away {
		justify-content: flex-end;
	}
	.dot {
		width: 14px;
		height: 14px;
		border-radius: 999px;
		flex: none;
	}
	.dot.home {
		background: var(--home);
	}
	.dot.away {
		background: var(--away);
	}
	.score {
		font-size: 30px;
		font-weight: 700;
		letter-spacing: 0.02em;
	}
	.score span {
		color: var(--text-faint);
		margin: 0 3px;
	}

	.sub {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: center;
	}
	.chip.warm {
		background: color-mix(in srgb, var(--accent) 26%, var(--surface-3));
		color: var(--accent);
	}

	/* ── stat strip ── */
	.stats {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 14px;
		align-items: end;
		padding: 14px 16px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.stat .label {
		display: block;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--text-faint);
		margin-bottom: 7px;
	}
	.bar2 {
		display: flex;
		height: 10px;
		border-radius: 999px;
		overflow: hidden;
		background: var(--surface-3);
	}
	.seg.home {
		background: var(--home);
	}
	.seg.away {
		background: var(--away);
	}
	.ends {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: var(--text-dim);
		margin-top: 4px;
	}
	.narrow {
		text-align: center;
	}
	.peaks {
		font-size: 16px;
		font-weight: 600;
		display: flex;
		gap: 8px;
		align-items: baseline;
		justify-content: center;
	}
	.peaks .home {
		color: var(--home);
	}
	.peaks .away {
		color: var(--away);
	}
	.peaks .vs {
		font-size: 11px;
		color: var(--text-faint);
	}
	.goalmins {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		justify-content: center;
		max-width: 180px;
	}
	.gm {
		padding: 1px 6px;
		border-radius: 5px;
		font-size: 12px;
		font-weight: 600;
	}
	.gm.home {
		background: color-mix(in srgb, var(--home) 22%, transparent);
		color: var(--home);
	}
	.gm.away {
		background: color-mix(in srgb, var(--away) 22%, transparent);
		color: var(--away);
	}
	.none {
		color: var(--text-faint);
	}

	.note {
		margin: 2px 0 8px;
		font-size: 12.5px;
		color: var(--text-dim);
		line-height: 1.6;
	}
	.note strong {
		color: var(--accent);
		font-weight: 600;
	}
	.ink.home {
		color: var(--home);
		font-weight: 600;
	}
	.ink.away {
		color: var(--away);
		font-weight: 600;
	}

	@media (max-width: 760px) {
		.app {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
			height: auto;
		}
		.stats {
			grid-template-columns: 1fr;
		}
	}
</style>
