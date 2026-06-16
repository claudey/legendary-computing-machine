<script lang="ts">
	import type { Match } from '$lib/types';

	let {
		matches,
		selectedId,
		onselect
	}: {
		matches: Match[];
		selectedId: string;
		onselect: (id: string) => void;
	} = $props();

	let query = $state('');

	const filtered = $derived(
		matches.filter((m) => {
			const q = query.trim().toLowerCase();
			if (!q) return true;
			return (
				m.home.name.toLowerCase().includes(q) ||
				m.away.name.toLowerCase().includes(q) ||
				(m.group ?? '').toLowerCase().includes(q)
			);
		})
	);

	const fmtDate = (iso: string) =>
		new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
</script>

<aside class="list">
	<header class="head">
		<h1>WC&nbsp;2026 · Hydration &amp; Momentum</h1>
		<p>How cooling breaks bend the run of play.</p>
	</header>

	<div class="search">
		<svg viewBox="0 0 24 24" aria-hidden="true"
			><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg
		>
		<input
			type="search"
			placeholder="Search team or group…"
			bind:value={query}
			aria-label="Search matches"
		/>
	</div>

	<ul class="cards">
		{#each filtered as m (m.id)}
			<li>
				<button
					class="card"
					class:active={m.id === selectedId}
					onclick={() => onselect(m.id)}
					style="--home:{m.home.color}; --away:{m.away.color};"
				>
					<div class="meta">
						<span class="chip">{m.group ?? '—'}</span>
						<span class="date mono">{fmtDate(m.kickoffUTC)}</span>
					</div>
					<div class="teams">
						<span class="team"><i class="dot home"></i>{m.home.name}</span>
						<span class="score mono">{m.score[0]}&ndash;{m.score[1]}</span>
						<span class="team"><i class="dot away"></i>{m.away.name}</span>
					</div>
					<div class="foot">
						<span class="chip">{m.weather.temperature}°C · {m.weather.humidity}% RH</span>
						<span class="src mono">{m.source}</span>
					</div>
				</button>
			</li>
		{:else}
			<li class="empty">No matches found.</li>
		{/each}
	</ul>
</aside>

<style>
	.list {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: var(--surface);
		border-right: 1px solid var(--border);
	}

	.head {
		padding: 18px 16px 12px;
		border-bottom: 1px solid var(--border);
	}
	.head h1 {
		font-size: 15px;
		line-height: 1.3;
	}
	.head p {
		margin: 4px 0 0;
		font-size: 12px;
		color: var(--text-faint);
	}

	.search {
		position: relative;
		padding: 12px 16px;
	}
	.search svg {
		position: absolute;
		left: 27px;
		top: 50%;
		transform: translateY(-50%);
		width: 15px;
		height: 15px;
		fill: none;
		stroke: var(--text-faint);
		stroke-width: 2;
		stroke-linecap: round;
		pointer-events: none;
	}
	.search input {
		width: 100%;
		padding: 9px 12px 9px 34px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text);
		font: inherit;
		font-size: 13px;
		outline: none;
	}
	.search input:focus {
		border-color: var(--border-strong);
		background: var(--surface-3);
	}

	.cards {
		list-style: none;
		margin: 0;
		padding: 4px 10px 16px;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.card {
		width: 100%;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 11px 12px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-left: 3px solid transparent;
		border-radius: var(--radius-sm);
		color: var(--text);
		font: inherit;
		cursor: pointer;
		transition:
			background 0.12s,
			border-color 0.12s,
			transform 0.06s;
	}
	.card:hover {
		background: var(--surface-3);
		border-color: var(--border-strong);
	}
	.card:active {
		transform: translateY(1px);
	}
	.card.active {
		background: var(--surface-3);
		border-left-color: var(--accent);
		border-color: var(--border-strong);
	}

	.meta,
	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.date {
		font-size: 11px;
		color: var(--text-faint);
	}

	.teams {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 8px;
	}
	.team {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-weight: 500;
		font-size: 13px;
	}
	.team:last-child {
		justify-content: flex-end;
		text-align: right;
	}
	.dot {
		width: 9px;
		height: 9px;
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
		font-size: 14px;
		font-weight: 600;
		padding: 1px 8px;
		background: var(--bg);
		border-radius: 6px;
	}

	.src {
		font-size: 10px;
		color: var(--text-faint);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.empty {
		list-style: none;
		padding: 24px 12px;
		text-align: center;
		color: var(--text-faint);
		font-size: 13px;
	}
</style>
