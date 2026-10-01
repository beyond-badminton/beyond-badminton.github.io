// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

function renderLiveTournament() {
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
	const tournamentKeys = [TOURNAMENT_CONFIG_KEY, TOURNAMENT_QUALIFICATION_ROUNDS_KEY, TOURNAMENT_QUALIFICATION_SCORES_KEY, TOURNAMENT_PLAYERS_KEY];
	if (event.key === null || tournamentKeys.includes(event.key)) renderLiveTournament();
});

window.addEventListener("focus", renderLiveTournament);
initLiveTournament();
