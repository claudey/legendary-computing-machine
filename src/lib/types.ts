export type Team = {
	name: string;
	color: string;
};

export type Goal = {
	minute: number;
	team: 'home' | 'away';
	player: string;
};

export type Weather = {
	temperature: number | null;
	humidity: number | null;
	description: string | null;
};

/** [minute, value] — value in [-100, 100]; positive = home pressure, negative = away. */
export type MomentumPoint = [number, number];

export type Match = {
	id: string;
	source: string;
	league: string;
	group: string | null;
	date: string;
	kickoffUTC: string;
	home: Team;
	away: Team;
	score: [number, number];
	weather: Weather;
	breakMarks: number[];
	goals: Goal[];
	momentum: MomentumPoint[];
};
