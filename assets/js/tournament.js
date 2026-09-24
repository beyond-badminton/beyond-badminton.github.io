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

// ── State ─────────────────────────────────────────────────────

function newTournamentConfig() {
	return {
		tournamentDate: null,
		matchesPerPlayer: 0,
		twoMenVsTwoWomen: "enabled",
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

// ── DOM refs ──────────────────────────────────────────────────

const genGenerateTournamentBtn = document.getElementById("gen-generate-tournament-btn");
const genClearTournamentBtn = document.getElementById("gen-clear-tournament-btn");
const genTournamentDatePicker = document.getElementById("gen-tournament-date-picker");
const genPrintTournamentBtn = document.getElementById("gen-print-tournament-btn");
const genExportTournamentBtn = document.getElementById("gen-export-tournament-btn");

// const genPlayoffDrawCard = document.getElementById("gen-playoff-draw-card");
// const genPlayoffDrawTitle = document.getElementById("gen-playoff-draw-title");
// const genPlayoffDrawOut = document.getElementById("gen-playoff-draw-output");
// const genPlayoffOut = document.getElementById("gen-playoff-output");

const genTournamentEmpty = document.getElementById("gen-tournament-empty");
const genqualificationRoundsNum = document.getElementById("qualification-matches");
const genDTwoMenVsTwoWomenSelect = document.getElementById("two-men-vs-two-women");

// ── Generate button handler ───────────────────────────────────
genGenerateTournamentBtn.addEventListener("click", async () => {
	if (hasTournament() && !(await confirmDialog("Replace the ongoing tournament with a new one?"))) return;
	if (!genqualificationRoundsNum.value || Number.isNaN(genqualificationRoundsNum.value) || genqualificationRoundsNum.value <= 0) {
		alertDialog(null, "Please enter the number of qualification rounds.");
		return;
	}

	if ((activePlayers.length || 0) < 4) {
		alertDialog(null, "There must be at least 4 active players.");
		return;
	}

	if (genDTwoMenVsTwoWomenSelect.value !== "enabled") {
		const playersWithoutGender = activePlayers.filter((p) => playerGender(p.allPlayerId) === "x");
		if (playersWithoutGender.length > 0) {
			alertDialog("Players missing gender", [
				`To '${genDTwoMenVsTwoWomenSelect.options[genDTwoMenVsTwoWomenSelect.selectedIndex].text}', all players must have a specified gender.`,
				`Update players: ${playersWithoutGender.map((p) => playerName(p.allPlayerId)).join(", ")}`,
			]);
			return;
		}
	}

	if ((genqualificationRoundsNum.value * activePlayers.length) % 4 > 0) {
		alertDialog(
			"The total number of matches must be divisible by 4",
			"Please adjust the number of qualification rounds or the number of active players accordingly.",
		);
		return;
	}

	generateTournament(activePlayers, courtBlocks);
});

genClearTournamentBtn.addEventListener("click", async () => {
	if (!(await confirmDialog("Discard the ongoing tournament?"))) return;
	clearGeneratedTournamentFromStorage();
});

genPrintTournamentBtn.addEventListener("click", () => {
	const tournamentSchedule = { rounds: qualificationRounds };
	printSchedule("Tournament", tournamentSchedule, new Date(tournamentConfig.tournamentDate), qualificationScores, false, false, tournamentPlayerName);
});

genExportTournamentBtn.addEventListener("click", () => {
	const tournamentSchedule = { rounds: qualificationRounds };
	downloadScheduleSpreadsheet(
		"Tournament",
		tournamentSchedule,
		new Date(tournamentConfig.tournamentDate),
		qualificationScores,
		false,
		false,
		tournamentPlayerName,
	);
});

genTournamentDatePicker.addEventListener("change", () => {
	if (!hasTournament()) return;
	tournamentConfig.tournamentDate = genTournamentDatePicker.valueAsDate.toISOString();
	saveTournamentConfig();
});

function hasTournament() {
	return (tournamentConfig?.matchesPerPlayer || 0) > 0;
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

	//console.log("Cleared generated tournament from storage.", tournamentConfig);
	renderTournament();
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

function saveTournamentToStorage(render = true) {
	saveTournamentConfig();
	saveQualificationRounds();
	saveQualificationScores();
	savePlayoffDraw();
	savePlayoffRounds();
	savePlayoffScores();
	saveTournamentPlayers();

	if (render) renderTournament();
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
			tournamentConfig = JSON.parse(savedTournamentConfig);
		} else {
			tournamentConfig = newTournamentConfig();
		}
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

	renderTournament();
}

/**
 * Generate an independent random doubles tournament.
 *
 * IMPORTANT:
 * - Uses anonymous numbers 1..playersCount.
 * - Does NOT use activePlayers IDs.
 * - Does NOT use the existing schedule.
 * - Does NOT use player names.
 *
 * @param {number} playersCount Total number of active players.
 * @param {number} womenCount If set, number of women portion of active players. If set, then disable 2 men vs 2 women matches.
 * @param {number} matchCount Number of matches per player.
 * @param {string[]} courts Available court names, e.g. ["C1", "C2", "C3"]
 *
 * @returns {{
 *   players: number[],
 *   matches: Array,
 *   stats: Object
 * }}
 */
function generateQualificationRounds(playersCount, womenCount = null, matchCount, courts = []) {
	// ------------------------------------------------------------
	// Validation
	// ------------------------------------------------------------

	if (!Number.isInteger(playersCount) || playersCount < 4) {
		throw new Error("playersCount must be at least 4.");
	}

	if (Number.isInteger(womenCount) && womenCount > playersCount) {
		throw new Error("womenCount must null or to be less or equal playersCount.");
	}

	if (!Number.isInteger(matchCount) || matchCount < 1) {
		throw new Error("matchCount must be at least 1.");
	}

	if (!Array.isArray(courts) || courts.length === 0) {
		throw new Error("At least one court is required.");
	}

	// ------------------------------------------------------------
	// Anonymous tournament numbers
	//
	// Women: 1..women
	// Men:   women+1..activePlayerCount
	//
	// These numbers have NOTHING to do with activePlayers.id.
	// ------------------------------------------------------------

	const players = Array.from({ length: playersCount }, (_, i) => i + 1);

	const gender = new Map();

	const allowTwoMenVsTwoWomen = !Number.isInteger(womenCount);

	if (!allowTwoMenVsTwoWomen) {
		players.forEach((player, i) => {
			gender.set(player, i < womenCount ? "W" : "M");
		});
	}

	// ------------------------------------------------------------
	// Helpers
	// ------------------------------------------------------------

	let matchIdCounter = 0;

	function genId() {
		return `qm${(matchIdCounter++).toString(36)}`;
	}

	// ------------------------------------------------------------
	// Check whether a match is legal.
	//
	// The ONLY forbidden matchup is:
	//
	//   2 men vs 2 women
	//
	// when allowTwoMenVsTwoWomen === false.
	//
	// All other combinations are allowed.
	// ------------------------------------------------------------

	function isMatchLegal(teamA, teamB) {
		if (allowTwoMenVsTwoWomen) {
			return true;
		}

		const aMen = teamA.filter((p) => gender.get(p) === "M").length;
		const aWomen = teamA.filter((p) => gender.get(p) === "W").length;

		const bMen = teamB.filter((p) => gender.get(p) === "M").length;
		const bWomen = teamB.filter((p) => gender.get(p) === "W").length;

		const is2M = (men, women) => men === 2 && women === 0;
		const is2W = (men, women) => men === 0 && women === 2;

		return !((is2M(aMen, aWomen) && is2W(bMen, bWomen)) || (is2W(aMen, aWomen) && is2M(bMen, bWomen)));
	}

	// ------------------------------------------------------------
	// Player statistics.
	//
	// We use these to make playing time and bench time fair.
	// ------------------------------------------------------------

	const stats = {};

	players.forEach((player) => {
		stats[player] = {
			played: 0,
			benched: 0,
			teammates: {},
			opponents: {},
		};
	});

	const rounds = [];

	function generateMatches() {
		while (true) {
			// exclude players that played all games;
			// sort all players by how many times they have played,ascending order, so that players who have played less are prioritized;
			// if players have played teh same maches, sort by how many times they have benched, descending order, so that players who have benched more are prioritized;
			// then slice the list to only include enough players for the number of courts available (courts.length * 4), taking multiples of 4 to ensure full teams;

			const availablePlayers = players
				.filter((player) => stats[player].played < matchCount)
				.sort((a, b) => stats[a].played - stats[b].played || stats[b].benched - stats[a].benched)
				.slice(0, Math.min(courts.length * 4, players.length - (players.length % 4)));

			if (availablePlayers.length === 0) {
				// all players have played all matches
				break;
			}

			// randomize players
			shuffle(availablePlayers);

			const matches = [];

			// generate matches
			for (let i = 0; i < availablePlayers.length; i += 4) {
				const teamA = [availablePlayers[i], availablePlayers[i + 1]];
				const teamB = [availablePlayers[i + 2], availablePlayers[i + 3]];

				if (!isMatchLegal(teamA, teamB)) {
					// swap first players of teamA and teamB
					[teamA[0], teamB[0]] = [teamB[0], teamA[0]];
				}

				const court = courts[matches.length % courts.length];

				matches.push({
					court,
					teamA,
					teamB,
					matchId: genId(),
				});
			}

			// Update statistics.
			availablePlayers.forEach((player) => {
				stats[player].played++;
				stats[player].benched = 0;
			});

			const benchedPlayers = players.filter((player) => !availablePlayers.includes(player));

			benchedPlayers.forEach((player) => {
				stats[player].benched++;
			});

			rounds.push({
				roundId: rounds.length,
				matches,
				bench: benchedPlayers,
			});
		}
	}

	generateMatches();

	return rounds;
}

function generateTournament(activePlayers, courtBlocks) {
	clearGeneratedTournamentFromStorage();

	tournamentConfig.twoMenVsTwoWomen = genDTwoMenVsTwoWomenSelect.value;
	tournamentConfig.matchesPerPlayer = Number(genqualificationRoundsNum.value);
	tournamentConfig.tournamentDate = genTournamentDatePicker.valueAsDate
		? genTournamentDatePicker.valueAsDate.toISOString()
		: new Date().toISOString();
	if (activePlayers.length < 8) {
		tournamentConfig.playoffPlayersCount = 4;
	} else if (activePlayers.length < 16) {
		tournamentConfig.playoffPlayersCount = 8;
	} else {
		tournamentConfig.playoffPlayersCount = 16;
	}
	saveTournamentConfig();

	// Initialize qualification player stats for active players, get all relevant information from all players to avoid additional lookup.
	tournamentPlayers = activePlayers.map((ap) => ({
		id: ap.allPlayerId,
		rank: 0,
		name: playerName(ap.allPlayerId),
		isWoman: playerIsWoman(ap.allPlayerId),
		pick: 0,
		played: 0,
		wins: 0,
		losses: 0,
		diff: 0,
		opponents: {},
	}));

	// keep map for lookup
	tournamentPlayersMap = new Map(tournamentPlayers.map((p) => [Number(p.id), p]));
	tournamentWomenCount = getWomenCount(tournamentPlayers);

	//console.log("Generating tournament with players:", tournamentPlayers);
	saveTournamentPlayers();

	const activeWomenCount = tournamentConfig.twoMenVsTwoWomen !== "enabled" ? tournamentWomenCount : null;

	// also remove duplicit court names
	const courts = Array.from(new Set(courtBlocks.reduce((arr, block) => arr.concat(block.courts), []))).sort();

	qualificationRounds = generateQualificationRounds(tournamentPlayers.length, activeWomenCount, tournamentConfig.matchesPerPlayer, courts);

	saveQualificationRounds();

	renderTournament();
}

function populateSelectElementWithKeyValue(selectEl, keyvals, firstValueHint) {
	selectEl.innerHTML = "";
	const opt = document.createElement("option");
	opt.value = "";
	opt.textContent = firstValueHint;
	selectEl.appendChild(opt);

	keyvals.forEach((item) => {
		const opt = document.createElement("option");
		opt.value = item.key;
		opt.textContent = item.value;
		selectEl.appendChild(opt);
	});
}

function populateSelectElementWithValues(selectEl, values, firstValueHint) {
	selectEl.innerHTML = "";
	const opt = document.createElement("option");
	opt.value = "";
	opt.textContent = firstValueHint;
	selectEl.appendChild(opt);

	values.forEach((value) => {
		const opt = document.createElement("option");
		opt.value = value;
		opt.textContent = String(value);
		selectEl.appendChild(opt);
	});
}

// ------------------------------------------------------------
// Qualification draw
// ------------------------------------------------------------

const genQualificationDrawCard = document.getElementById("gen-qualification-draw-card");
const genQualificationDrawTitle = document.getElementById("gen-qualification-draw-title");
const genQualificationDrawTableBody = document.getElementById("qualification-draw-table-body");

const qualificationDrawFormCard = document.getElementById("gen-qualification-draw-form-card");
const qualificationDrawPlayerField = document.getElementById("qualification-draw-player");
const qualificationDrawPickField = document.getElementById("qualification-draw-pick");
const qualificationDrawSubmitButton = document.getElementById("submit-qualification-draw-btn");
const qualificationDrawPanelHeader = document.getElementById("qualification-draw-panel-header");
const qualificationDrawClearButton = document.getElementById("clear-qualification-draw-btn");

let currentDrawPlayerId = null;

function populateQualificationDrawPlayerField() {
	const playerOptions = tournamentPlayers
		.filter((p) => p.pick === 0)
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((p) => ({ key: p.id, value: p.name }));
	populateSelectElementWithKeyValue(qualificationDrawPlayerField, playerOptions, "Select a player");
	if (playerOptions.length === 0) {
		qualificationDrawPlayerField.disabled = true;
	} else {
		qualificationDrawPlayerField.disabled = false;
	}
}

function populateQualificationDrawPickField() {
	const values = [];

	if (currentDrawPlayerId !== null) {
		let start = 1;
		let end = tournamentPlayers.length;

		if (tournamentConfig.twoMenVsTwoWomen === "disabled") {
			const womenCount = getWomenCount();
			if (playerIsWoman(currentDrawPlayerId)) {
				end = womenCount;
			} else {
				start = 1 + womenCount;
			}
		}

		for (let i = start; i <= end; i++) {
			if (tournamentPlayers.some((p) => p.pick === i)) {
				continue;
			}
			values.push(i);
		}
	}

	populateSelectElementWithValues(qualificationDrawPickField, values, "Select a pick");

	if (currentDrawPlayerId === null || values.length === 0) {
		qualificationDrawPickField.disabled = true;
	} else {
		qualificationDrawPickField.disabled = false;
	}
}

qualificationDrawPlayerField.addEventListener("change", (event) => {
	if (!event.target.value) return;

	currentDrawPlayerId = Number(event.target.value);

	//populateAvailableDraws();
	populateQualificationDrawPickField();

	// on pick change, reset the pick field and enable it
	qualificationDrawPickField.value = "";
	qualificationDrawPickField.disabled = false;
});

qualificationDrawPickField.addEventListener("change", (event) => {
	const drawNumber = event.target.value;
	if (!drawNumber) return;

	qualificationDrawPickField.value = "";
	qualificationDrawPickField.disabled = true;

	tournamentPlayersMap.get(currentDrawPlayerId).pick = Number(drawNumber);

	//console.log("Updated tournamentPlayersMap with pick for playerId:", currentDrawPlayerId);

	saveTournamentPlayers();

	renderQualificationDrawPlayers();

	// remove playerId from qualificationDrawPlayerField options
	const optionToRemove = qualificationDrawPlayerField.querySelector(`option[value="${currentDrawPlayerId}"]`);
	if (optionToRemove) {
		//console.log("Removing playerId from qualificationDrawPlayerField options:", currentDrawPlayerId);
		optionToRemove.remove();
	}

	currentDrawPlayerId = null;

	if (tournamentPlayers.every((p) => p.pick !== 0)) {
		qualificationDrawPlayerField.disabled = true;
		qualificationDrawSubmitButton.disabled = false;
		qualificationDrawSubmitButton.hidden = false;
	}
});

function reassignQualificationMatches() {
	const qualificationPickToPlayer = new Map();
	tournamentPlayers.forEach((p) => {
		qualificationPickToPlayer.set(p.pick, p);
	});

	// iterate over all matches and change player numbers to playerids
	qualificationRounds.forEach((round) => {
		round.matches.forEach((match) => {
			//console.log("Before reassignment:", match);
			match.teamA[0] = qualificationPickToPlayer.get(match.teamA[0])?.id || match.teamA[0];
			match.teamA[1] = qualificationPickToPlayer.get(match.teamA[1])?.id || match.teamA[1];
			match.teamB[0] = qualificationPickToPlayer.get(match.teamB[0])?.id || match.teamB[0];
			match.teamB[1] = qualificationPickToPlayer.get(match.teamB[1])?.id || match.teamB[1];
			//console.log("After reassignment:", match);
		});
		round.bench = round.bench.map((playerId) => qualificationPickToPlayer.get(Number(playerId))?.id || playerId);
	});
	saveQualificationRounds();
}

function allManVsAllWomanMatch(match) {
	// const teamA1player = tournamentPlayersMap.get(Number(match.teamA[0])) || null;
	// const teamA2player = tournamentPlayersMap.get(Number(match.teamA[1])) || null;
	// const teamB1player = tournamentPlayersMap.get(Number(match.teamB[0])) || null;
	// const teamB2player = tournamentPlayersMap.get(Number(match.teamB[1])) || null;
	// console.log("Processing match:", JSON.stringify(tournamentPlayersMap.get(Number(match.teamA[0]))), JSON.stringify(tournamentPlayersMap.get(Number(match.teamA[1]))), JSON.stringify(tournamentPlayersMap.get(Number(match.teamB[0]))), JSON.stringify(tournamentPlayersMap.get(Number(match.teamB[1]))));
	// console.log("teamA1player:", teamA1player, "teamA2player:", teamA2player, "teamB1player:", teamB1player, "teamB2player:", teamB2player);

	const teamA1IsWoman = tournamentPlayersMap.get(Number(match.teamA[0]))?.isWoman ?? null;
	const teamA2IsWoman = tournamentPlayersMap.get(Number(match.teamA[1]))?.isWoman ?? null;

	const teamB1IsWoman = tournamentPlayersMap.get(Number(match.teamB[0]))?.isWoman ?? null;
	const teamB2IsWoman = tournamentPlayersMap.get(Number(match.teamB[1]))?.isWoman ?? null;
	//console.log("teamA1IsWoman:", teamA1IsWoman, "teamA2IsWoman:", teamA2IsWoman, "teamB1IsWoman:", teamB1IsWoman, "teamB2IsWoman:", teamB2IsWoman);
	return teamA1IsWoman === teamA2IsWoman && teamB1IsWoman === teamB2IsWoman && teamA1IsWoman !== teamB1IsWoman;
}

qualificationDrawSubmitButton.addEventListener("click", async () => {
	if (tournamentPlayers.some((p) => p.pick === 0)) {
		alertDialog(null, "Please complete the qualification draw for all players before confirming");
		return;
	}

	if (await confirmDialog("Confirm these drawn numbers?", "This action cannot be undone.")) {
		reassignQualificationMatches();

		tournamentConfig.qualificationDrawConfirmed = true;
		tournamentConfig.qualificationStarted = tournamentConfig.twoMenVsTwoWomen !== "manual";

		saveTournamentConfig();

		if (tournamentConfig.twoMenVsTwoWomen === "manual") {
			let menVsWomenMatchFound = false;
			for (const round of qualificationRounds) {
				//console.log("Checking round for '2 Men vs 2 Women' matches:", round);
				for (const match of round.matches) {
					//console.log("Checking match for '2 Men vs 2 Women':", match, allManVsAllWomanMatch(match));
					if (allManVsAllWomanMatch(match)) {
						//console.log("Found '2 Men vs 2 Women' match:", match);
						menVsWomenMatchFound = true;
						match.editable = true;
					}
				}
			}
			if (!menVsWomenMatchFound) {
				alertDialog("Qualification started", "No '2 Men vs 2 Women' matches found. No edit mode required.");
				tournamentConfig.qualificationStarted = true;
				saveTournamentConfig();
			} else {
				alertDialog("Entering edit mode", "A '2 Men vs 2 Women' match was found. Check the matches before starting the qualification.");
			}
		}

		renderTournament();
	}
});

qualificationDrawClearButton.addEventListener("click", async () => {
	if (!(await confirmDialog("Clear these drawn numbers?"))) return;
	tournamentPlayers.forEach((player) => {
		player.pick = 0;
	});
	saveTournamentPlayers();
	tournamentConfig.qualificationDrawConfirmed = false;
	saveTournamentConfig();
	renderQualificationDraw();
});

function renderQualificationDrawPlayers() {
	genQualificationDrawTableBody.innerHTML = "";
	//console.log("Rendering qualification draw players:", tournamentPlayers.filter((p) => p.pick !== 0));
	getSorted(
		tournamentPlayers.filter((p) => p.pick !== 0),
		"qualificationDraw",
	).forEach((p) => {
		const row = document.createElement("tr");
		let removeBtnHtml = "";

		// withdrawal is not allowed after the qualification is finished
		if (!tournamentConfig.qualificationFinished) {
			let buttonTitle = "Remove";
			if (tournamentConfig.qualificationDrawConfirmed) {
				if (p.withdrawn) {
					buttonTitle = "Undo Withdrawal";
				} else {
					buttonTitle = "Withdraw";
				}
			}
			removeBtnHtml = `<button type="button" class="remove-btn" data-id="${p.id}">${buttonTitle}</button>`;
		}

		row.innerHTML = `
		<td>${p.name}</td>
		<td>${p.pick}</td>
		<td>${removeBtnHtml}</td>`;
		genQualificationDrawTableBody.appendChild(row);
	});

	updateSortUI("qualificationDraw");
}

function renderQualificationDraw() {
	qualificationDrawFormCard.hidden = tournamentConfig.qualificationDrawConfirmed;
	genQualificationDrawTitle.innerText = tournamentConfig.qualificationDrawConfirmed ? "Qualification draw" : "Enter qualification draw results";

	if (!tournamentConfig.qualificationDrawConfirmed) {
		const hint = qualificationDrawFormCard.querySelector("p.section-hint");
		if (tournamentConfig.twoMenVsTwoWomen === "enabled") {
			hint.innerText = "2 Men vs. 2 Women matches are allowed. Men and women share the same draw pool.";
		} else if (tournamentConfig.twoMenVsTwoWomen === "disabled") {
			hint.innerHTML = `2 Men vs. 2 Women matches are blocked. Men and women draw from separate pools: <ul class="section-hint-list"><li>Women: 1–${tournamentWomenCount}</li><li>Men: ${tournamentWomenCount + 1}–${tournamentPlayers.length}</li></ul>`;
		} else if (tournamentConfig.twoMenVsTwoWomen === "manual") {
			hint.innerText =
				"2 Men vs. 2 Women matches are allowed but flagged for organizer review using a shared draw pool. If any are created, confirming draws opens edit mode automatically.";
		}
	}
	qualificationDrawSubmitButton.disabled = tournamentConfig.qualificationDrawConfirmed || tournamentPlayers.some((p) => p.pick === 0);
	qualificationDrawSubmitButton.hidden = qualificationDrawSubmitButton.disabled;
	qualificationDrawClearButton.disabled = tournamentConfig.qualificationDrawConfirmed;
	qualificationDrawPanelHeader.hidden = tournamentConfig.qualificationDrawConfirmed;

	if (!tournamentConfig.qualificationDrawConfirmed) {
		populateQualificationDrawPlayerField();
		populateQualificationDrawPickField();
	}

	renderQualificationDrawPlayers();
}

//------------------------------------------------------------
// Render qualification rounds
//------------------------------------------------------------

const genQualificationCard = document.getElementById("gen-qualification-card");
const genQualificationOut = document.getElementById("gen-qualification-output");
const genQualificationStartBtn = document.getElementById("gen-qualification-start-btn");
const genQualificationCardLabel = document.getElementById("gen-qualification-card-label");
const genQualificationEditFilterWrap = document.getElementById("qualification-edit-filter-wrap");
const genQualificationEditFilterCheckbox = document.getElementById("qualification-edit-filter-editable");
const genQualificationMatchFilterWrap = document.getElementById("qualification-match-filter-wrap");
const genQualificationMatchFilterList = document.getElementById("qualification-match-player-filter");
const genQualificationMatchFilterCount = document.getElementById("qualification-match-filter-count");
const genQualificationMatchFilterSearch = document.getElementById("qualification-match-filter-search");
const genQualificationMatchFilterAllBtn = document.getElementById("qualification-match-filter-all-btn");
const genQualificationMatchFilterNoneBtn = document.getElementById("qualification-match-filter-none-btn");

// Player ids hidden from the P2P stats table (session-only, not persisted).
const qualificationMatchPlayerExcluded = new Set();

function renderPlayersCheckboxFilter(filterListElement, excludeSet) {
	filterListElement.innerHTML = "";
	tournamentPlayers.forEach((p) => {
		const isChecked = !excludeSet.has(Number(p.id));
		const label = document.createElement("label");
		label.className = `checkbox-pill${isChecked ? " checked" : ""}`;
		label.dataset.name = p.name.toLowerCase();
		label.innerHTML = `<input type="checkbox" value="${p.id}" ${isChecked ? "checked" : ""}> ${p.name}`;
		filterListElement.appendChild(label);
	});
}
function renderQualificationMatchFilter() {
	renderPlayersCheckboxFilter(genQualificationMatchFilterList, qualificationMatchPlayerExcluded);
	applyQualificationMatchFilterSearch();
	genQualificationMatchFilterCount.textContent = `${tournamentPlayers.length - qualificationMatchPlayerExcluded.size}/${tournamentPlayers.length}`;
}

function applyQualificationMatchFilterSearch() {
	const term = genQualificationMatchFilterSearch.value.trim().toLowerCase();
	genQualificationMatchFilterList.querySelectorAll(".checkbox-pill").forEach((label) => {
		label.classList.toggle("filter-hidden", term !== "" && !label.dataset.name.includes(term));
	});
}
genQualificationEditFilterCheckbox.addEventListener("change", renderQualificationRounds);

genQualificationMatchFilterSearch.addEventListener("input", applyQualificationMatchFilterSearch);

genQualificationMatchFilterAllBtn.addEventListener("click", () => {
	qualificationMatchPlayerExcluded.clear();
	renderQualificationMatchFilter();
	if (tournamentConfig.qualificationStarted) {
		renderQualificationRounds();
	}
});

genQualificationMatchFilterNoneBtn.addEventListener("click", () => {
	tournamentPlayersMap.keys().forEach((playerId) => {
		qualificationMatchPlayerExcluded.add(Number(playerId));
	});
	renderQualificationMatchFilter();
	if (tournamentConfig.qualificationStarted) {
		renderQualificationRounds();
	}
});

genQualificationMatchFilterList.addEventListener("change", (e) => {
	const input = e.target.closest("input[type=checkbox]");
	if (!input) return;

	const playerId = Number(input.value);
	const label = input.closest(".checkbox-pill");

	if (input.checked) {
		qualificationMatchPlayerExcluded.delete(playerId);
		label.classList.add("checked");
	} else {
		qualificationMatchPlayerExcluded.add(playerId);
		label.classList.remove("checked");
	}

	genQualificationMatchFilterCount.textContent = `${tournamentPlayers.length - qualificationMatchPlayerExcluded.size}/${tournamentPlayers.length}`;

	if (tournamentConfig.qualificationStarted) {
		renderQualificationRounds();
	}
});

genQualificationStartBtn.addEventListener("click", async () => {
	if (await confirmDialog("Start qualification with these matchups?", "This action cannot be undone.")) {
		tournamentConfig.qualificationStarted = true;
		saveTournamentConfig();
		renderTournament();
	}
});

function tournamentPlayerName(playerId) {
	if (tournamentConfig.qualificationDrawConfirmed) {
		const player = tournamentPlayersMap.get(Number(playerId));
		if (player?.withdrawn || false) {
			return `(Withdrawn) ${player?.name || ""}`;
		}
		return player?.name || "";
	}

	return String(playerId);
}

// Find a qualification match (and its round) by matchId
function findQualificationMatch(matchId) {
	for (const round of qualificationRounds) {
		const match = round.matches.find((m) => m.matchId === matchId);
		if (match) return match;
	}
	return null;
}

function qualificationRoundPlayersSwap(dragSrc, dragDst) {
	// Only allow moves within the same match
	if (dragSrc.roundId !== dragDst.roundId || dragSrc.matchId !== dragDst.matchId || dragSrc.bench || dragDst.bench) {
		return;
	}

	// Prevent swapping the same player in the same slot
	if (dragSrc.team === dragDst.team && dragSrc.pos === dragDst.pos) {
		return;
	}

	const match = findQualificationMatch(dragSrc.matchId);
	if (!match) {
		return;
	}

	const tmp = match[dragSrc.team][dragSrc.pos];
	match[dragSrc.team][dragSrc.pos] = match[dragDst.team][dragDst.pos];
	match[dragDst.team][dragDst.pos] = tmp;

	saveQualificationRounds();
	renderQualificationRounds();
}

function renderQualificationRounds() {
	const blockEl = document.createElement("section");
	blockEl.className = "gen-block";

	const manualEdit =
		tournamentConfig.qualificationDrawConfirmed && !tournamentConfig.qualificationStarted && tournamentConfig.twoMenVsTwoWomen === "manual";

	genQualificationCardLabel.textContent = `Qualification rounds ${manualEdit ? " (Edit Mode)" : ""}`;
	genQualificationMatchFilterWrap.style.display = tournamentConfig.qualificationStarted ? "block" : "none";
	genQualificationEditFilterWrap.style.display = manualEdit ? "block" : "none";
	genQualificationStartBtn.hidden = !manualEdit;
	genQualificationStartBtn.disabled = !manualEdit;

	const filterEditableMatches = manualEdit && genQualificationEditFilterCheckbox.checked;

	//console.log("Rendering qualification rounds:", tournamentConfig);
	qualificationRounds.forEach((round) => {
		const matchesRow = document.createElement("div");
		matchesRow.className = "gen-matches-row";
		//console.log("Rendering round:", round.roundId, "with matches:", round.matches, "and qualificationScores:", qualificationScores);

		round.matches.forEach((match) => {
			// check if all players are excluded
			if (
				!manualEdit && // only apply exclusion filter when not in manual edit mode
				qualificationMatchPlayerExcluded.has(match.teamA[0]) &&
				qualificationMatchPlayerExcluded.has(match.teamA[1]) &&
				qualificationMatchPlayerExcluded.has(match.teamB[0]) &&
				qualificationMatchPlayerExcluded.has(match.teamB[1])
			) {
				return;
			}

			if (filterEditableMatches && !match.editable) {
				// in manual edit, display only '2 Men vs 2 Women' matches that are object of manual editing
				return;
			}

			matchesRow.appendChild(
				buildMatchCard(
					match,
					qualificationScores[match.matchId] || { a: null, b: null },
					round.roundId,
					manualEdit && match.editable ? PLAYER_SLOT.DRAGGABLE : PLAYER_SLOT.CSV,
					!tournamentConfig.qualificationStarted || tournamentConfig.qualificationFinished,
					tournamentPlayerName,
					manualEdit && match.editable,
				),
			);
		});

		if (matchesRow.children.length === 0) {
			// filter applied
			return;
		}

		const roundEl = document.createElement("div");
		roundEl.className = "gen-round";
		roundEl.dataset.roundId = round.roundId;

		const rLabel = document.createElement("p");
		rLabel.className = "gen-round-label";
		rLabel.innerHTML = `Round ${round.roundId + 1}`;
		roundEl.appendChild(rLabel);
		roundEl.appendChild(matchesRow);

		// Bench
		// display bench only if not in exclusion filter mode and not in manual edit mode with filtering
		if ((!manualEdit || qualificationMatchPlayerExcluded.size === 0) && !filterEditableMatches && round.bench && round.bench.length > 0) {
			roundEl.appendChild(buildBenchCard(round.bench, round.roundId, PLAYER_SLOT.CSV, tournamentPlayerName));
		}

		blockEl.appendChild(roundEl);
	});

	genQualificationOut.innerHTML = "";
	genQualificationOut.appendChild(blockEl);

	attachDragHandlers(genQualificationOut, qualificationRoundPlayersSwap);
}

//------------------------------------------------------------
// Qualification player stats
//------------------------------------------------------------

const genQualificationStatsCard = document.getElementById("gen-qualification-stats-card");
const genQualificationStatsTableBody = document.getElementById("qualification-stats-table-body");
const genQualificationP2PStatsTableBody = document.getElementById("qualification-stats-p2p-table-body");
const genQualificationP2PFilterList = document.getElementById("qualification-p2p-player-filter");
const genQualificationP2PFilterCount = document.getElementById("qualification-p2p-filter-count");
const genQualificationP2PFilterSearch = document.getElementById("qualification-p2p-filter-search");
const genQualificationP2PFilterAllBtn = document.getElementById("qualification-p2p-filter-all-btn");
const genQualificationP2PFilterNoneBtn = document.getElementById("qualification-p2p-filter-none-btn");
const genQualificationConfirmBtn = document.getElementById("gen-qualification-confirm-btn");
const genQualificationConfirmEmpty = document.getElementById("gen-qualification-confirm-empty");

// Player ids hidden from the P2P stats table (session-only, not persisted).
const qualificationP2PExcluded = new Set();

function renderQualificationPlayerStats() {
	genQualificationStatsTableBody.innerHTML = getSorted(tournamentPlayers, "qualificationPlayerStats")
		.map((stat) => {
			const sortState = stat.rank === tournamentConfig.playoffPlayersCount ? getSortState("qualificationPlayerStats") : null;
			const playoffLine = sortState && sortState.field === "rank" && sortState.dir === "asc" ? ' class="playoff-line"' : "";
			const playoffSpot = stat.rank <= tournamentConfig.playoffPlayersCount ? ' class="playoff-spot"' : "";
			return `<tr${playoffLine}>
			<td${playoffSpot}>${stat.rank}</td>
			<td>${stat.name}</td>
			<td>${stat.played}</td>
			<td>${stat.wins}</td>
			<td>${stat.losses}</td>
			<td>${valueWithSign(stat.diff)}</td>
			<td>${stat.decidedBy ?? ""}</td>
		</tr>`;
		})
		.join("");
	updateSortUI("qualificationPlayerStats");
}

function renderQualificationP2PPlayerFilter() {
	renderPlayersCheckboxFilter(genQualificationP2PFilterList, qualificationP2PExcluded);
	applyQualificationP2PFilterSearch();
	genQualificationP2PFilterCount.textContent = `${tournamentPlayers.length - qualificationP2PExcluded.size}/${tournamentPlayers.length}`;
}

function applyQualificationP2PFilterSearch() {
	const term = genQualificationP2PFilterSearch.value.trim().toLowerCase();
	genQualificationP2PFilterList.querySelectorAll(".checkbox-pill").forEach((label) => {
		label.classList.toggle("filter-hidden", term !== "" && !label.dataset.name.includes(term));
	});
}

genQualificationP2PFilterSearch.addEventListener("input", applyQualificationP2PFilterSearch);

genQualificationP2PFilterAllBtn.addEventListener("click", () => {
	qualificationP2PExcluded.clear();
	renderQualificationP2PPlayerFilter();
	renderQualificationP2PStats();
});

genQualificationP2PFilterNoneBtn.addEventListener("click", () => {
	tournamentPlayersMap.keys().forEach((playerId) => {
		qualificationP2PExcluded.add(playerId);
	});
	renderQualificationP2PPlayerFilter();
	renderQualificationP2PStats();
});

genQualificationP2PFilterList.addEventListener("change", (e) => {
	const input = e.target.closest("input[type=checkbox]");
	if (!input) return;

	const playerId = Number(input.value);
	const label = input.closest(".checkbox-pill");

	if (input.checked) {
		qualificationP2PExcluded.delete(playerId);
		label.classList.add("checked");
	} else {
		qualificationP2PExcluded.add(playerId);
		label.classList.remove("checked");
	}

	genQualificationP2PFilterCount.textContent = `${tournamentPlayers.length - qualificationP2PExcluded.size}/${tournamentPlayers.length}`;
	renderQualificationP2PStats();
});

function renderQualificationP2PStats() {
	const rows = tournamentPlayers
		.filter((p) => !qualificationP2PExcluded.has(Number(p.id)))
		.flatMap((p) => {
			return Object.entries(p.opponents || {}).map(([, opponentRecord]) => {
				return {
					name: p.name,
					opponent: opponentRecord.name,
					played: opponentRecord.played,
					wins: opponentRecord.wins,
					losses: opponentRecord.losses,
					diff: opponentRecord.diff,
				};
			});
		});
	genQualificationP2PStatsTableBody.innerHTML = getSorted(rows, "qualificationP2PStats")
		.map((row) => {
			return `<tr>
					<td>${row.name}</td>
					<td>${row.opponent}</td>
					<td>${row.played}</td>
					<td>${row.wins}</td>
					<td>${row.losses}</td>
					<td>${valueWithSign(row.diff)}</td>
				</tr>`;
		})
		.join("");
	updateSortUI("qualificationP2PStats");
}

genQualificationConfirmBtn.addEventListener("click", async () => {
	// Handle confirmation of qualification results here
	if (await confirmDialog("Confirm qualification results and proceed to the playoffs?", "This action cannot be undone.")) {
		tournamentConfig.qualificationFinished = true;
		saveTournamentConfig();
		renderTournament();
	}
});

function allMatchesComplete() {
	const scores = Object.values(qualificationScores);
	return scores.length === (tournamentConfig.matchesPerPlayer * tournamentPlayers.length) / 4 && scores.every((score) => score.a !== score.b); // draw is not considered complete
}

function renderQualificationStats() {
	const confirmButtonShow =
		tournamentConfig.qualificationStarted &&
		!tournamentConfig.qualificationFinished &&
		(tournamentConfig?.matchesPerPlayer || 0) > 0 &&
		allMatchesComplete();

	genQualificationConfirmEmpty.hidden = confirmButtonShow;
	genQualificationConfirmBtn.disabled = !confirmButtonShow;
	genQualificationConfirmBtn.hidden = !confirmButtonShow;

	if (!tournamentConfig?.qualificationStarted) {
		return;
	}

	renderQualificationPlayerStats();
	renderQualificationP2PStats();
}

//------------------------------------------------------------
// Render qualification scores
//------------------------------------------------------------

genQualificationOut.addEventListener("change", (e) => {
	const inp = e.target.closest(".gen-score-input");
	if (!inp) return;

	const val = inp.value === "" ? null : Number(inp.value);
	if (val !== null && val < 0) {
		inp.value = "";
		return;
	}

	const { matchId, side } = inp.dataset;

	const match = findQualificationMatch(matchId);
	const oldScore = qualificationScores[matchId] || { a: null, b: null };

	// Revert the stats contribution of the previous score before applying the new one
	if (match) revertMatchScore(tournamentPlayersMap, match, oldScore);

	if (!qualificationScores[matchId]) qualificationScores[matchId] = { a: null, b: null };

	qualificationScores[matchId][side] = val;

	if (match) applyMatchScore(tournamentPlayersMap, match, qualificationScores[matchId]);

	saveTournamentPlayers();
	saveQualificationScores();

	updateScoreUI(qualificationScores[matchId], inp);

	renderQualificationStats();
});

//------------------------------------------------------------
// Initialization
//------------------------------------------------------------

function renderTournament() {
	const hasTournamentValue = hasTournament();

	//console.log("Rendering tournament, hasTournament:", hasTournamentValue);

	genClearTournamentBtn.hidden = !hasTournamentValue;
	genPrintTournamentBtn.hidden = !hasTournamentValue;
	genExportTournamentBtn.hidden = !hasTournamentValue;
	genTournamentEmpty.hidden = hasTournamentValue;
	genQualificationDrawCard.hidden = !hasTournamentValue;
	genQualificationCard.hidden = !hasTournamentValue;
	genQualificationStatsCard.hidden = !tournamentConfig?.qualificationStarted;
	genQualificationConfirmEmpty.hidden = !genQualificationStatsCard.hidden && allMatchesComplete();

	if (!hasTournamentValue) {
		genTournamentDatePicker.valueAsDate = null;
		return;
	}

	genTournamentDatePicker.valueAsDate = tournamentConfig.tournamentDate ? new Date(tournamentConfig.tournamentDate) : null;

	rankPlayers(tournamentPlayersMap);

	renderQualificationDraw();

	renderQualificationMatchFilter();

	renderQualificationRounds();

	renderQualificationP2PPlayerFilter();

	renderQualificationStats();
}

function openWithdrawPlayerDialog(player) {
	return openDialog(
		`${player.withdrawn ? "Undo" : "Confirm"} Player Withdrawal`,
		player.withdrawn
			? null
			: "The withdrawn player will remain in qualification matches to keep generated results consistent. A replacement player must be assigned to take their place.",
		true,
		player.name,
	);
}

genQualificationDrawTableBody.addEventListener("click", async (e) => {
	const playerId = Number(e.target.dataset.id);

	// 1. Handle the Remove Button
	if (e.target.closest(".remove-btn")) {
		const player = tournamentPlayersMap.get(playerId);
		if (!player) return;

		if (tournamentConfig.qualificationDrawConfirmed) {
			if (await openWithdrawPlayerDialog(player)) {
				//console.log(`Player ${player.name} withdrawal status: ${player.withdrawn || false}`);
				player.withdrawn = !(player.withdrawn || false);
				//console.log(`Player ${player.name} current withdrawal status: ${player.withdrawn}`);
				saveTournamentPlayers();
				renderTournament();
			}
			return;
		}

		player.pick = 0;
		saveTournamentPlayers();
		renderQualificationDrawPlayers();
		populateQualificationDrawPlayerField();
		return;
	}
});

loadTournamentFromStorage();

const tournamentDataDesc = "Tournament";

window.StorageEvents.on(StorageEvents.Type.LOAD, tournamentDataDesc, (data) => {
	saveTournamentDataToStorage(data);
	loadTournamentFromStorage();
});

window.StorageEvents.on(StorageEvents.Type.SAVE, tournamentDataDesc, () => {
	return getTournamentDataFromStorage();
});

window.StorageEvents.on(StorageEvents.Type.DEL_EVENT_DATA, tournamentDataDesc, () => {
	clearGeneratedTournamentFromStorage();
});

window.StorageEvents.on(StorageEvents.Type.HAS_EVENT_DATA, tournamentDataDesc, () => {
	return (tournamentConfig?.matchesPerPlayer || 0) > 0;
});

window.PlayerEvents.on(PlayerEvents.Type.MUST, tournamentDataDesc, (id) => {
	return tournamentPlayersMap.has(id);
});
