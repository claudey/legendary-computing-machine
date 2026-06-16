<script lang="ts">
	import type { Match } from '$lib/types';

	let { match }: { match: Match } = $props();

	// ── geometry (fixed viewBox, scales to container via CSS) ──
	const VB_W = 1000;
	const VB_H = 440;
	const padL = 18;
	const padR = 18;
	const padT = 30; // headroom for goal markers
	const padB = 34; // axis labels
	const plotW = VB_W - padL - padR;
	const plotH = VB_H - padT - padB;
	const midY = padT + plotH / 2;
	const MAX_MIN = 90;

	const xScale = (m: number) => padL + (Math.min(m, 95) / MAX_MIN) * plotW;
	const barW = (plotW / 96) * 0.72;

	type Bar = { x: number; y: number; h: number; home: boolean };
	const bars = $derived(
		match.momentum.map(([m, v]): Bar => {
			const mag = (Math.abs(v) / 100) * (plotH / 2);
			return {
				x: xScale(m) - barW / 2,
				y: v >= 0 ? midY - mag : midY,
				h: Math.max(mag, 0.5),
				home: v >= 0
			};
		})
	);

	const axisTicks = [0, 15, 30, 45, 60, 75, 90];

	const goals = $derived(match.goals.map((g) => ({ ...g, x: xScale(g.minute) })));
</script>

<figure
	class="chart"
	style="--home:{match.home.color}; --away:{match.away.color};"
	aria-label="Attack momentum for {match.home.name} versus {match.away.name}"
>
	<figcaption class="legend">
		<span class="key"><i class="swatch home"></i>{match.home.name}</span>
		<span class="key"><i class="swatch away"></i>{match.away.name}</span>
		<span class="key muted"><i class="swatch brk"></i>Hydration / break marks</span>
		<span class="key muted"><i class="swatch goal"></i>Goal</span>
	</figcaption>

	<svg viewBox="0 0 {VB_W} {VB_H}" preserveAspectRatio="none" role="img">
		<!-- mid baseline -->
		<line x1={padL} y1={midY} x2={VB_W - padR} y2={midY} class="baseline" />

		<!-- break / half marks -->
		{#each match.breakMarks as bm (bm)}
			{@const isHT = bm === 45}
			<line x1={xScale(bm)} y1={padT - 6} x2={xScale(bm)} y2={VB_H - padB + 6} class="brkline" />
			<text x={xScale(bm)} y={VB_H - 8} class="brklabel" text-anchor="middle">
				{isHT ? 'HT' : `${bm}'`}
			</text>
		{/each}

		<!-- momentum bars -->
		{#each bars as b, i (i)}
			<rect
				x={b.x}
				y={b.y}
				width={barW}
				height={b.h}
				rx="1.2"
				class={b.home ? 'bar home' : 'bar away'}
			/>
		{/each}

		<!-- axis ticks -->
		{#each axisTicks as t (t)}
			<text x={xScale(t)} y={VB_H - 20} class="tick" text-anchor="middle">{t}'</text>
		{/each}

		<!-- goal markers -->
		{#each goals as g, i (i)}
			<g class="goal {g.team}">
				<title>{g.player} — {g.minute}' ({g.team === 'home' ? match.home.name : match.away.name})</title>
				<line x1={g.x} y1={padT - 10} x2={g.x} y2={VB_H - padB} class="goalline" />
				<circle cx={g.x} cy={padT - 12} r="7" class="goaldot" />
				<text x={g.x} y={padT - 9} class="goalmin" text-anchor="middle">{g.minute}</text>
			</g>
		{/each}
	</svg>
</figure>

<style>
	.chart {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-height: 0;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		font-size: 12px;
		color: var(--text-dim);
	}
	.key {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.key.muted {
		color: var(--text-faint);
	}
	.swatch {
		width: 11px;
		height: 11px;
		border-radius: 3px;
		display: inline-block;
	}
	.swatch.home {
		background: var(--home);
	}
	.swatch.away {
		background: var(--away);
	}
	.swatch.brk {
		background: repeating-linear-gradient(
			0deg,
			var(--accent),
			var(--accent) 2px,
			transparent 2px,
			transparent 4px
		);
	}
	.swatch.goal {
		background: var(--goal);
		border-radius: 999px;
	}

	svg {
		width: 100%;
		height: clamp(280px, 46vh, 460px);
		display: block;
		background:
			linear-gradient(var(--surface-2), var(--surface-2)) padding-box,
			var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: visible;
	}

	.baseline {
		stroke: var(--border-strong);
		stroke-width: 1;
	}

	.bar {
		transition: opacity 0.12s;
	}
	.bar.home {
		fill: var(--home);
	}
	.bar.away {
		fill: var(--away);
	}

	.brkline {
		stroke: var(--accent);
		stroke-width: 1.4;
		stroke-dasharray: 3 4;
		opacity: 0.55;
	}
	.brklabel {
		fill: var(--accent);
		font-size: 12px;
		font-weight: 600;
		font-family: var(--font-mono);
		opacity: 0.85;
	}

	.tick {
		fill: var(--text-faint);
		font-size: 11px;
		font-family: var(--font-mono);
	}

	.goalline {
		stroke: var(--goal);
		stroke-width: 1;
		stroke-dasharray: 2 3;
		opacity: 0.5;
	}
	.goaldot {
		fill: var(--goal);
		stroke: var(--bg);
		stroke-width: 1.5;
	}
	.goalmin {
		fill: #1a1300;
		font-size: 9px;
		font-weight: 700;
		font-family: var(--font-mono);
	}
	.goal {
		cursor: default;
	}
</style>
