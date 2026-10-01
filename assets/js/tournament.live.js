// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

const LIVE_TOURNAMENT_STORAGE_KEYS = [
	TOURNAMENT_CONFIG_KEY,
	TOURNAMENT_QUALIFICATION_ROUNDS_KEY,
	TOURNAMENT_QUALIFICATION_SCORES_KEY,
	TOURNAMENT_PLAYERS_KEY,
];
const LIVE_THEME_STORAGE_KEY = "tournament-generator:live-theme";
let lastLiveTournamentSnapshot = null;

function applyLiveTheme(theme) {
	if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
	else document.documentElement.removeAttribute("data-theme");
}

function loadLiveTheme() {
	try {
		const liveTheme = localStorage.getItem(LIVE_THEME_STORAGE_KEY);
		applyLiveTheme(liveTheme === "light" || liveTheme === "dark" ? liveTheme : localStorage.getItem("theme"));
	} catch {
		applyLiveTheme("auto");
	}
}

function getLiveTournamentSnapshot() {
	return LIVE_TOURNAMENT_STORAGE_KEYS.map((key) => localStorage.getItem(key) || "").join("\n");
}

function renderLiveTournament() {
	const snapshot = getLiveTournamentSnapshot();
	if (snapshot === lastLiveTournamentSnapshot) return;
	lastLiveTournamentSnapshot = snapshot;

	tournamentConfig = newTournamentConfig();
	qualificationRounds = [];
	qualificationScores = {};
	playoffDraw = [];
	playoffRounds = {};
	playoffScores = {};
	tournamentPlayers = [];
	tournamentPlayersMap = new Map();
	tournamentWomenCount = 0;
	loadTournamentFromStorage();

	// The live page displays standings and matches even before scoring starts.
	tournamentConfig.qualificationStarted = true;
	tournamentConfig.qualificationFinished = true;
	rankPlayers(tournamentPlayersMap);

	const displayScores = {};
	qualificationRounds.forEach((round) => {
		round.matches.forEach((match) => {
			const score = qualificationScores[match.matchId] || {};
			displayScores[match.matchId] = { a: score.a ?? 0, b: score.b ?? 0 };
		});
	});
	qualificationScores = displayScores;

	renderQualificationMatchFilter();
	updateQualificationRoundWindowChanged();
	renderQualificationRounds();
	renderQualificationPlayerStats();
}

function initLiveTournament() {
	initQualificationRoundsRenderer({ offset: 1, size: 4 });
	initQualificationPlayerStatsRenderer();
	renderLiveTournament();
}

window.addEventListener("storage", (event) => {
	if (event.key === "theme" || event.key === LIVE_THEME_STORAGE_KEY) {
		loadLiveTheme();
		return;
	}
	if (event.key === null) loadLiveTheme();
	if (event.key === null || LIVE_TOURNAMENT_STORAGE_KEYS.includes(event.key)) renderLiveTournament();
});

window.addEventListener("focus", renderLiveTournament);
loadLiveTheme();
initLiveTournament();
window.setInterval(renderLiveTournament, 1000);
