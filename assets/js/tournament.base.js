// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

// ── Storage keys ──────────────────────────────────────────────
const TOURNAMENT_CONFIG_KEY = "tournament-generator:tournamentConfig";
const TOURNAMENT_QUALIFICATION_ROUNDS_KEY = "tournament-generator:qualificationRounds";
const TOURNAMENT_QUALIFICATION_SCORES_KEY = "tournament-generator:qualificationScores";
const TOURNAMENT_PLAYOFF_DRAW_KEY = "tournament-generator:playoffDraw";
const TOURNAMENT_PLAYOFF_ROUNDS_KEY = "tournament-generator:playoffRounds";
const TOURNAMENT_PLAYOFF_SCORES_KEY = "tournament-generator:playoffScores";
const TOURNAMENT_PLAYERS_KEY = "tournament-generator:tournamentPlayers";
const QUALIFICATION_SCORE_SAVE_REQUEST_EVENT = "qualification-score-save-request";

// ── State ─────────────────────────────────────────────────────

function newTournamentConfig() {
	return {
		tournamentDate: null,
		useOnScreenNumpad: false,
		matchesPerPlayer: 0,
		twoMenVsTwoWomen: "enabled",
		pointsToWin: 15,
		scoreCap: 15,
		qualificationDrawConfirmed: false,
		qualificationStarted: false,
		qualificationFinished: false,
		playoffDrawConfirmed: false,
		playoffFinished: false,
		playoffPlayersCount: 0,
	};
}

// The generated tournament object, which contains:
// - tournamentDate: Date of the tournament
// - matchesPerPlayer: Number of matches each player should play
// - qualificationDrawConfirmed: Boolean indicating whether the draw has been confirmed
// - qualificationStarted: Boolean indicating whether the qualification rounds have started

// - qualificationRounds: Array of rounds, each containing matches and bench players
// - qualificationScores: Object containing match scores
// - playoffDraw: first of every 4 players will draw its teammate from the next 3 players, and then the next 4 players will do the same, etc.
// - playoffDrawConfirmed: Boolean indicating whether the playoff draw has been confirmed
// - playoffRounds: Array of playoff rounds, this will contain quarterfinals, semifinals, and finals, each containing matches
let tournamentConfig = newTournamentConfig();

let qualificationRounds = [];
let qualificationScores = {};
let playoffDraw = [];
let playoffRounds = {};
let playoffScores = {};

// Array of all active players with pick and stats: { allPlayerId: { id, rank, pick, played, wins, losses, diff, isWoman, opponents } }
let tournamentPlayers = [];

// this isn't persisted in local storage, it's just a runtime map for quick lookups
let tournamentPlayersMap = new Map();
// this isn't persisted in local storage either, it's just a runtime count of women players
let tournamentWomenCount = 0;

function hasTournament() {
	return (tournamentConfig?.matchesPerPlayer || 0) > 0;
}

function allManVsAllWomanMatch(match) {
	const teamA1IsWoman = tournamentPlayersMap.get(Number(match.teamA[0]))?.isWoman ?? null;
	const teamA2IsWoman = tournamentPlayersMap.get(Number(match.teamA[1]))?.isWoman ?? null;
	const teamB1IsWoman = tournamentPlayersMap.get(Number(match.teamB[0]))?.isWoman ?? null;
	const teamB2IsWoman = tournamentPlayersMap.get(Number(match.teamB[1]))?.isWoman ?? null;

	return teamA1IsWoman === teamA2IsWoman && teamB1IsWoman === teamB2IsWoman && teamA1IsWoman !== teamB1IsWoman;
}

function findQualificationMatch(matchId) {
	for (const round of qualificationRounds) {
		const match = round.matches.find((candidate) => candidate.matchId === matchId);
		if (match) return match;
	}
	return null;
}

function matchIsComplete(match) {
	const score = qualificationScores[match.matchId];
	if (!score) return false;
	const scoreA = Number(score.a) || 0;
	const scoreB = Number(score.b) || 0;
	const winningScore = Math.max(scoreA, scoreB);
	const scoreDifference = Math.abs(scoreA - scoreB);
	return scoreA !== scoreB && winningScore >= tournamentConfig.pointsToWin && (scoreDifference >= 2 || winningScore === tournamentConfig.scoreCap);
}

function allMatchesComplete() {
	return qualificationRounds.every((round) => round.matches.every((match) => matchIsComplete(match)));
}

function reassignQualificationMatches() {
	const qualificationPickToPlayer = new Map();
	tournamentPlayers.forEach((player) => {
		qualificationPickToPlayer.set(player.pick, player);
	});

	qualificationRounds.forEach((round) => {
		round.matches.forEach((match) => {
			match.teamA[0] = qualificationPickToPlayer.get(match.teamA[0])?.id || match.teamA[0];
			match.teamA[1] = qualificationPickToPlayer.get(match.teamA[1])?.id || match.teamA[1];
			match.teamB[0] = qualificationPickToPlayer.get(match.teamB[0])?.id || match.teamB[0];
			match.teamB[1] = qualificationPickToPlayer.get(match.teamB[1])?.id || match.teamB[1];
		});
		round.bench = round.bench.map((playerId) => qualificationPickToPlayer.get(Number(playerId))?.id || playerId);
	});
	saveQualificationRounds();
}

function clearGeneratedTournamentFromStorage() {
	tournamentConfig = newTournamentConfig();
	qualificationRounds = [];
	qualificationScores = {};
	playoffDraw = {};
	playoffRounds = {};
	playoffScores = {};
	tournamentPlayers = [];
	tournamentPlayersMap = new Map();
	tournamentWomenCount = 0;

	try {
		localStorage.removeItem(TOURNAMENT_CONFIG_KEY);
		localStorage.removeItem(TOURNAMENT_QUALIFICATION_ROUNDS_KEY);
		localStorage.removeItem(TOURNAMENT_QUALIFICATION_SCORES_KEY);
		localStorage.removeItem(TOURNAMENT_PLAYOFF_DRAW_KEY);
		localStorage.removeItem(TOURNAMENT_PLAYOFF_ROUNDS_KEY);
		localStorage.removeItem(TOURNAMENT_PLAYOFF_SCORES_KEY);
		localStorage.removeItem(TOURNAMENT_PLAYERS_KEY);
	} catch (err) {
		console.log("Error clearing generated tournament from storage.", err);
	}
}

function saveTournamentConfig() {
	try {
		localStorage.setItem(TOURNAMENT_CONFIG_KEY, JSON.stringify(tournamentConfig));
	} catch (_) {}
}

function saveQualificationRounds() {
	try {
		localStorage.setItem(TOURNAMENT_QUALIFICATION_ROUNDS_KEY, JSON.stringify(qualificationRounds));
	} catch (_) {}
}

function saveQualificationScores() {
	try {
		localStorage.setItem(TOURNAMENT_QUALIFICATION_SCORES_KEY, JSON.stringify(qualificationScores));
	} catch (err) {
		console.log("Error saving qualification scores to localStorage:", err);
	}
}

function savePlayoffDraw() {
	try {
		localStorage.setItem(TOURNAMENT_PLAYOFF_DRAW_KEY, JSON.stringify(playoffDraw));
	} catch (err) {
		console.log("Error saving playoff draw to localStorage:", err);
	}
}

function savePlayoffRounds() {
	try {
		localStorage.setItem(TOURNAMENT_PLAYOFF_ROUNDS_KEY, JSON.stringify(playoffRounds));
	} catch (err) {
		console.log("Error saving playoff rounds to localStorage:", err);
	}
}

function savePlayoffScores() {
	try {
		localStorage.setItem(TOURNAMENT_PLAYOFF_SCORES_KEY, JSON.stringify(playoffScores));
	} catch (err) {
		console.log("Error saving playoff scores to localStorage:", err);
	}
}

function saveTournamentPlayers() {
	try {
		localStorage.setItem(TOURNAMENT_PLAYERS_KEY, JSON.stringify(tournamentPlayers));
	} catch (err) {
		console.log("Error saving tournament players to localStorage:", err);
	}
}

function saveTournamentToStorage() {
	saveTournamentConfig();
	saveQualificationRounds();
	saveQualificationScores();
	savePlayoffDraw();
	savePlayoffRounds();
	savePlayoffScores();
	saveTournamentPlayers();
}

function saveTournamentDataToStorage(data) {
	[
		TOURNAMENT_CONFIG_KEY,
		TOURNAMENT_QUALIFICATION_ROUNDS_KEY,
		TOURNAMENT_QUALIFICATION_SCORES_KEY,
		TOURNAMENT_PLAYOFF_DRAW_KEY,
		TOURNAMENT_PLAYOFF_ROUNDS_KEY,
		TOURNAMENT_PLAYOFF_SCORES_KEY,
		TOURNAMENT_PLAYERS_KEY,
	].forEach((key) => {
		if (key in data) {
			const value = data[key];
			const toStore = typeof value === "string" ? value : JSON.stringify(value);
			localStorage.setItem(key, toStore);
		}
	});
}

function getTournamentDataFromStorage() {
	const data = {};
	[
		TOURNAMENT_CONFIG_KEY,
		TOURNAMENT_QUALIFICATION_ROUNDS_KEY,
		TOURNAMENT_QUALIFICATION_SCORES_KEY,
		TOURNAMENT_PLAYOFF_DRAW_KEY,
		TOURNAMENT_PLAYOFF_ROUNDS_KEY,
		TOURNAMENT_PLAYOFF_SCORES_KEY,
		TOURNAMENT_PLAYERS_KEY,
	].forEach((key) => {
		const value = localStorage.getItem(key);
		if (value !== null) {
			data[key] = value;
		}
	});
	return data;
}

function getWomenCount() {
	if (!tournamentPlayers || tournamentPlayers.length === 0) {
		return 0;
	}

	return tournamentPlayers.reduce((count, player) => {
		return player.isWoman ? count + 1 : count;
	}, 0);
}

function loadTournamentFromStorage() {
	try {
		const savedTournamentConfig = localStorage.getItem(TOURNAMENT_CONFIG_KEY);
		const savedQualificationRounds = localStorage.getItem(TOURNAMENT_QUALIFICATION_ROUNDS_KEY);
		const savedQualificationScores = localStorage.getItem(TOURNAMENT_QUALIFICATION_SCORES_KEY);
		const savedPlayoffDraw = localStorage.getItem(TOURNAMENT_PLAYOFF_DRAW_KEY);
		const savedPlayoffRounds = localStorage.getItem(TOURNAMENT_PLAYOFF_ROUNDS_KEY);
		const savedPlayoffScores = localStorage.getItem(TOURNAMENT_PLAYOFF_SCORES_KEY);
		const savedTournamentPlayers = localStorage.getItem(TOURNAMENT_PLAYERS_KEY);

		//console.log("Loading savedQualificationScores from storage:", savedQualificationScores);
		if (savedTournamentConfig) {
			tournamentConfig = { ...newTournamentConfig(), ...JSON.parse(savedTournamentConfig) };
		} else {
			tournamentConfig = newTournamentConfig();
		}
		if (!Number.isSafeInteger(tournamentConfig.pointsToWin) || tournamentConfig.pointsToWin < 1) {
			tournamentConfig.pointsToWin = 15;
		}
		if (!Number.isSafeInteger(tournamentConfig.scoreCap) || tournamentConfig.scoreCap < tournamentConfig.pointsToWin) {
			tournamentConfig.scoreCap = tournamentConfig.winByTwo ? tournamentConfig.pointsToWin + 2 : tournamentConfig.pointsToWin;
		}
		delete tournamentConfig.winByTwo;
		if (savedQualificationRounds) qualificationRounds = JSON.parse(savedQualificationRounds);
		if (savedQualificationScores) qualificationScores = JSON.parse(savedQualificationScores);
		//console.log("Loading qualificationScores from storage:", qualificationScores);

		if (savedPlayoffDraw) playoffDraw = JSON.parse(savedPlayoffDraw);
		if (savedPlayoffRounds) playoffRounds = JSON.parse(savedPlayoffRounds);
		if (savedPlayoffScores) playoffScores = JSON.parse(savedPlayoffScores);
		if (savedTournamentPlayers) tournamentPlayers = JSON.parse(savedTournamentPlayers);
	} catch {
		clearGeneratedTournamentFromStorage();
		return;
	}

	if (!tournamentPlayers) tournamentPlayers = [];

	// keep map for lookup
	tournamentPlayersMap = new Map(tournamentPlayers.map((p) => [Number(p.id), p]));
	tournamentWomenCount = getWomenCount(tournamentPlayers);
}
