// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

// ── Storage keys ──────────────────────────────────────────────
const TOURNAMENT_CONFIG_KEY = "tournament-generator:tournamentConfig";
const TOURNAMENT_QUALIFICATION_DRAW_KEY = "tournament-generator:qualificationDraw";
const TOURNAMENT_QUALIFICATION_ROUNDS_KEY = "tournament-generator:qualificationRounds";
const TOURNAMENT_QUALIFICATION_SCORES_KEY = "tournament-generator:qualificationScores";
const TOURNAMENT_PLAYOFF_DRAW_KEY = "tournament-generator:playoffDraw";
const TOURNAMENT_PLAYOFF_ROUNDS_KEY = "tournament-generator:playoffRounds";
const TOURNAMENT_PLAYOFF_SCORESS_KEY = "tournament-generator:playoffScores";
const TOURNAMENT_PLAYERS_KEY = "tournament-generator:tournamentPlayers";

// ── State ─────────────────────────────────────────────────────

function newTournamentConfig() {
	return {
		tournamentDate: null,
		matchesPerPlayer: 0,
		disable2MenVs2Women: false,
		qualificationDrawConfirmed: false,
		qualificationFinished: false,
		playoffDrawConfirmed: false,
		playoffFinished: false,
	};
}

// The generated tournament object, which contains:
// - tournamentDate: Date of the tournament
// - matchesPerPlayer: Number of matches each player should play
// - qualificationDraw: Numbers assigned to players (1..activePlayerCount) after a physical draw
// - qualificationDrawConfirmed: Boolean indicating whether the draw has been confirmed
// - qualificationRounds: Array of rounds, each containing matches and bench players
// - qualificationScores: Object containing player scores (allPlayerId : { played, wins, losses, winrate })
// - playoffDraw: first of every 4 players will draw its teammate from the next 3 players, and then the next 4 players will do the same, etc.
// - playoffDrawConfirmed: Boolean indicating whether the playoff draw has been confirmed
// - playoffRounds: Array of playoff rounds, this will contain quarterfinals, semifinals, and finals, each containing matches
let tournamentConfig = newTournamentConfig();


let qualificationDraw = [];
let qualificationRounds = [];
let qualificationScores = {};
let playoffDraw = [];
let playoffRounds = {};
let playoffScores = {};

// Copy of all players IDs from active players
let tournamentPlayers = [];

const localConfig = {
	qualificationRoundsFinalRendered: false,
	qualificationScoresFinalRendered: false,
	playoffDrawFinalRendered: false,
	playoffRoundsFinalRendered: false,
}

// ── DOM refs ──────────────────────────────────────────────────

const genGenerateTournamentBtn = document.getElementById("gen-generate-tournament-btn");
const genClearTournamentBtn = document.getElementById("gen-clear-tournament-btn");
const genTournamentDatePicker = document.getElementById("gen-tournament-date-picker");
const genPrintTournamentBtn = document.getElementById("gen-print-tournament-btn");
const genExportTournamentBtn = document.getElementById("gen-export-tournament-btn");

const genQualificationScoresCard = document.getElementById("gen-qualification-scores-card");
const genQualificationScoresOut = document.getElementById("gen-qualification-scores-output");

const genPlayoffDrawCard = document.getElementById("gen-playoff-draw-card");
const genPlayoffDrawTitle = document.getElementById("gen-playoff-draw-title");
const genPlayoffDrawOut = document.getElementById("gen-playoff-draw-output");
const genPlayoffOut = document.getElementById("gen-playoff-output");

const genTournamentEmpty = document.getElementById("gen-tournament-empty");
const genqualificationRoundsNum = document.getElementById("qualification-matches");
const genDisableTwoMenVsTwoWomenCb = document.getElementById("disable-2men-vs-2women");


// ── Generate button handler ───────────────────────────────────
genGenerateTournamentBtn.addEventListener("click", () => {
	if (hasTournament() && !confirm("Replace the existing tournament with a new one?"))
		return;
	generateTournament();
});

genClearTournamentBtn.addEventListener("click", () => {
	if (!confirm("Clear the generated tournament?")) return;
	clearGeneratedTournamentFromStorage();
});

genPrintTournamentBtn.addEventListener("click", () => {
	// printTournament(
	// 	tournament,
	// 	tournamentPlayers,
	// 	tournamentScores,
	// );
});

genExportTournamentBtn.addEventListener("click", () => {
	// downloadTournamentSpreadsheet(
	// 	tournament,
	// 	tournamentPlayers,
	// 	tournamentScores,
	// );
});

genTournamentDatePicker.addEventListener("change", () => {
	if (!hasTournament()) return;
	tournament.tournamentDate = genTournamentDatePicker.valueAsDate.toISOString();
	saveTournamentToStorage(false);
});

function hasTournament() {
	return (tournamentConfig?.matchesPerPlayer || 0) > 0;
}

function clearGeneratedTournamentFromStorage() {
	tournamentConfig = newTournamentConfig();
	qualificationDraw = [];
	qualificationRounds = [];
	qualificationScores = {};
	playoffDraw = {};
	playoffRounds = {};
	playoffScores = {};
	tournamentPlayers = [];

	try {
		localStorage.removeItem(TOURNAMENT_CONFIG_KEY);
		localStorage.removeItem(TOURNAMENT_QUALIFICATION_DRAW_KEY);
		localStorage.removeItem(TOURNAMENT_QUALIFICATION_ROUNDS_KEY);
		localStorage.removeItem(TOURNAMENT_QUALIFICATION_SCORES_KEY);
		localStorage.removeItem(TOURNAMENT_PLAYOFF_DRAW_KEY);
		localStorage.removeItem(TOURNAMENT_PLAYOFF_ROUNDS_KEY);
		localStorage.removeItem(TOURNAMENT_PLAYOFF_SCORESS_KEY);
		localStorage.removeItem(TOURNAMENT_PLAYERS_KEY);
	} catch {}

	renderTournament();
}

function savedTournamentConfig() {
	try {
		localStorage.setItem(TOURNAMENT_CONFIG_KEY, JSON.stringify(tournamentConfig));
	} catch (_) {}
}

function saveQualificationDraw() {
	try {
		localStorage.setItem(TOURNAMENT_QUALIFICATION_DRAW_KEY, JSON.stringify(qualificationDraw));
	} catch (_) {}
}

function savequalificationRounds() {
	try {
		localStorage.setItem(TOURNAMENT_QUALIFICATION_ROUNDS_KEY, JSON.stringify(qualificationRounds));
	} catch (_) {}
}

function saveQualificationScores() {
	try {
		localStorage.setItem(TOURNAMENT_QUALIFICATION_SCORES_KEY, JSON.stringify(scores));
	} catch (_) {}
}

function savePlayoffDraw() {
	try {
		localStorage.setItem(TOURNAMENT_PLAYOFF_DRAW_KEY, JSON.stringify(playoffDraw));
	} catch (_) {}
}

function saveplayoffRounds() {
	try {
		localStorage.setItem(TOURNAMENT_PLAYOFF_ROUNDS_KEY, JSON.stringify(playoffRounds));
	} catch (_) {}
}

function savePlayoffScores() {
	try {
		localStorage.setItem(TOURNAMENT_PLAYOFF_SCORESS_KEY, JSON.stringify(scores));
	} catch (_) {}
}

function saveTournamentPlayers() {
	try {
		localStorage.setItem(TOURNAMENT_PLAYERS_KEY, JSON.stringify(players));
	} catch (_) {}
}

function saveTournamentToStorage(render = true) {
	savedTournamentConfig();
	saveQualificationDraw();
	savequalificationRounds();
	saveQualificationScores();
	savePlayoffDraw();
	saveplayoffRounds();
	savePlayoffScores();
	saveTournamentPlayers();

	if (render) renderTournament();
}

function loadTournamentFromStorage() {
	try {
		const savedTournamentConfig = localStorage.getItem(TOURNAMENT_CONFIG_KEY);
		const savedQualificationDraw = localStorage.getItem(TOURNAMENT_QUALIFICATION_DRAW_KEY);
		const savedqualificationRounds = localStorage.getItem(TOURNAMENT_QUALIFICATION_ROUNDS_KEY);
		const savedQualificationScores = localStorage.getItem(TOURNAMENT_QUALIFICATION_SCORES_KEY);
		const savedPlayoffDraw = localStorage.getItem(TOURNAMENT_PLAYOFF_DRAW_KEY);
		const savedplayoffRounds = localStorage.getItem(TOURNAMENT_PLAYOFF_ROUNDS_KEY);
		const savedPlayoffScores = localStorage.getItem(TOURNAMENT_PLAYOFF_SCORESS_KEY);
		const savedTournamentPlayers = localStorage.getItem(TOURNAMENT_PLAYERS_KEY);

		if (savedTournamentConfig) {tournamentConfig = JSON.parse(savedTournamentConfig);} else { tournamentConfig = newTournamentConfig(); }
		if (savedQualificationDraw) qualificationDraw = JSON.parse(savedQualificationDraw);
		if (savedqualificationRounds) qualificationRounds = JSON.parse(savedqualificationRounds);
		if (savedQualificationScores) qualificationScores = JSON.parse(savedQualificationScores);
		if (savedPlayoffDraw) playoffDraw = JSON.parse(savedPlayoffDraw);
		if (savedplayoffRounds) playoffRounds = JSON.parse(savedplayoffRounds);
		if (savedPlayoffScores) playoffScores = JSON.parse(savedPlayoffScores);
		if (savedTournamentPlayers) tournamentPlayers = JSON.parse(savedTournamentPlayers);
	} catch {
		clearGeneratedTournamentFromStorage();
		return;
	}

	renderTournament();
}





/**
 * Generate an independent random doubles tournament.
 *
 * IMPORTANT:
 * - Uses anonymous numbers 1..activePlayerCount.
 * - Does NOT use activePlayers IDs.
 * - Does NOT use the existing schedule.
 * - Does NOT use player names.
 *
 * @param {number} activePlayerCount Total number of active players.
 * @param {number} activeWomenCount If set, number of women portion of active players. If set, then disable 2 men vs 2 women matches.
 * @param {number} matchCount Number of doubles matches to generate.
 * @param {string[]} courts Available court names, e.g. ["C1", "C2", "C3"]
 *
 * @returns {{
 *   players: number[],
 *   matches: Array,
 *   stats: Object
 * }}
 */
function generatequalificationRounds(
	activePlayerCount,
	activeWomenCount = null,
	matchCount,
	courts = []
) {
	// ------------------------------------------------------------
	// Validation
	// ------------------------------------------------------------

	if (!Number.isInteger(activePlayerCount) || activePlayerCount < 4) {
		throw new Error("activePlayerCount must be at least 4.");
	}

	if (
		Number.isInteger(activeWomenCount) &&
		activeWomenCount > activePlayerCount
	) {
		throw new Error(
			"activeWomenCount must null or to be less or equal activePlayerCount.",
		);
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

	const players = Array.from({ length: activePlayerCount }, (_, i) => i + 1);

	const gender = new Map();

	const allowTwoMenVsTwoWomen = !Number.isInteger(activeWomenCount);

	if (!allowTwoMenVsTwoWomen) {
		players.forEach((player, i) => {
			gender.set(player, i < activeWomenCount ? "W" : "M");
		});
	}

	// ------------------------------------------------------------
	// Helpers
	// ------------------------------------------------------------

	const teamKey = (team) => [...team].sort((a, b) => a - b).join("-");

	const matchKey = (teamA, teamB) => {
		const a = teamKey(teamA);
		const b = teamKey(teamB);

		return [a, b].sort().join("|");
	};

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

		return !(
			(is2M(aMen, aWomen) && is2W(bMen, bWomen)) ||
			(is2W(aMen, aWomen) && is2M(bMen, bWomen))
		);
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
			// then slice the list to only include enough players for the number of courts available (courts.length * 4);

			const availablePlayers = players
				.filter((player) => stats[player].played < matchCount)
				.sort(
					(a, b) =>
						stats[a].played - stats[b].played ||
						stats[b].benched - stats[a].benched,
				)
				.slice(0, courts.length * 4);

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
					matchNumber: matches.length + 1,
					court,
					teamA,
					teamB,
					matchKey: matchKey(teamA, teamB),
				});
			}

			// Update statistics.
			availablePlayers.forEach((player) => {
				stats[player].played++;
				stats[player].benched = 0;
			});

			const benchedPlayers = players.filter(
				(player) => !availablePlayers.includes(player),
			);

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

function getWomenCount() {
	if (!tournamentPlayers || tournamentPlayers.length === 0) {
		return 0;
	}

	return tournamentPlayers.reduce((count, playerId) => {
		return playerIsWoman(playerId) ? count + 1 : count;
	}, 0);
}

function generateTournament() {

	tournamentConfig.disable2MenVs2Women = genDisableTwoMenVsTwoWomenCb.checked;
	tournamentConfig.matchesPerPlayer = Number(genqualificationRoundsNum.value);
	tournamentConfig.tournamentDate = genTournamentDatePicker.valueAsDate ? genTournamentDatePicker.valueAsDate.toISOString() : null;
	savedTournamentConfig();

	tournamentPlayers = activePlayers.map((ap) => ap.allPlayerId);
	console.log("Generating tournament with players:", tournamentPlayers);
	saveTournamentPlayers();

	const activeWomenCount = tournamentConfig.disable2MenVs2Women
		? getWomenCount()
		: null;

	qualificationRounds = generatequalificationRounds(tournamentPlayers.length, activeWomenCount, tournamentConfig.matchesPerPlayer, ["C1", "C2", "C3"]);

	savequalificationRounds();

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

//const availableDraws = []
let currentPlayerId = null;

// function populateAvailableDraws() {
// 	availableDraws.length = 0;
// 	let start = 1;
// 	let end = tournamentPlayers.length;

// 	if (tournamentConfig.disable2MenVs2Women) {
// 		const womenCount = getWomenCount();
// 		if (playerIsWoman(currentPlayerId)) {
// 			end = womenCount;
// 		}
// 		else {
// 			start = 1 + womenCount;
// 		}
// 	}

// 	for (let i = start; i <= end; i++) {
// 		if (qualificationDraw.some((p) => p.pick === i)) {
// 			continue;
// 		}
// 		availableDraws.push(i);
// 	}
// }


function populateQualificationDrawPlayerField() {
	const playerOptions = tournamentPlayers
		.filter((playerId) => !qualificationDraw.some((p) => p.id === playerId))
		.map((playerId) => ({ key: playerId, value: playerName(playerId) }));
	playerOptions.sort((a, b) => a.value.localeCompare(b.value));
	populateSelectElementWithKeyValue(qualificationDrawPlayerField, playerOptions, "Select a player");
	if (playerOptions.length === 0) {
		qualificationDrawPlayerField.disabled = true;
	}
	else {
		qualificationDrawPlayerField.disabled = false;
	}
};

function populateQualificationDrawPickField() {
	const values = [];

	if (currentPlayerId !== null) {
		let start = 1;
		let end = tournamentPlayers.length;

		if (tournamentConfig.disable2MenVs2Women) {
			const womenCount = getWomenCount();
			if (playerIsWoman(currentPlayerId)) {
				end = womenCount;
			}
			else {
				start = 1 + womenCount;
			}
		}

		for (let i = start; i <= end; i++) {
			if (qualificationDraw.some((p) => p.pick === i)) {
				continue;
			}
			values.push(i);
		}
	}

	populateSelectElementWithValues(qualificationDrawPickField, values, "Select a pick");

	if (currentPlayerId === null || values.length === 0) {
		qualificationDrawPickField.disabled = true;
	}
	else {
		qualificationDrawPickField.disabled = false;
	}
}

qualificationDrawPlayerField.addEventListener("change", (event) => {
	if (!event.target.value) return;

	currentPlayerId = Number(event.target.value);

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

	qualificationDraw.push({
		id: currentPlayerId,
		name: playerName(currentPlayerId),
		pick: Number(drawNumber),
	});

	console.log("Added to qualificationDraw:", qualificationDraw);

	saveQualificationDraw();

	renderQualificationDrawPlayers();

	// remove playerId from qualificationDrawPlayerField options
	const optionToRemove = qualificationDrawPlayerField.querySelector(`option[value="${currentPlayerId}"]`);
	if (optionToRemove) {
		console.log("Removing playerId from qualificationDrawPlayerField options:", currentPlayerId);
		optionToRemove.remove();
	}

	if (qualificationDraw.length === tournamentPlayers.length) {
		qualificationDrawPlayerField.disabled = true;
		qualificationDrawSubmitButton.disabled = false;
		qualificationDrawSubmitButton.hidden = false;
	}
});

qualificationDrawSubmitButton.addEventListener("click", () => {
	if (qualificationDraw.length !== tournamentPlayers.length) {
		alert("Please complete the qualification draw for all players before confirming.");
		return;
	}

	tournamentConfig.qualificationDrawConfirmed = true;
	savedTournamentConfig();
	renderQualificationDraw();

	populateQualificationPickToPlayer();
	renderQualificationRounds();
});

qualificationDrawClearButton.addEventListener("click", () => {
	if (!confirm("Are you sure you want to clear the qualification draw?")) return;
	qualificationDraw = [];
	saveQualificationDraw();
	tournamentConfig.qualificationDrawConfirmed = false;
	savedTournamentConfig();
	renderQualificationDraw();
});

function renderQualificationDrawPlayers() {
	genQualificationDrawTableBody.innerHTML = "";

	getSorted(qualificationDraw, "qualification").forEach((p) => {
		const row = document.createElement("tr");
		const removeBtnHtml = tournamentConfig.qualificationDrawConfirmed
			? ""
			: `<button type="button" class="remove-btn" data-id="${p.id}">Remove</button>`;
		row.innerHTML = `
		<td>${p.name}</td>
		<td>${p.pick}</td>
		<td>${removeBtnHtml}</td>`;
		genQualificationDrawTableBody.appendChild(row);
	});

	updateSortUI("qualification");
}

function renderQualificationDraw() {

	qualificationDrawFormCard.hidden = tournamentConfig.qualificationDrawConfirmed;
	genQualificationDrawTitle.innerText = tournamentConfig.qualificationDrawConfirmed
		? "Qualification draw"
		: "Enter qualification draw results";

	qualificationDrawSubmitButton.disabled = tournamentConfig.qualificationDrawConfirmed || qualificationDraw.length !== tournamentPlayers.length;
	qualificationDrawClearButton.disabled = tournamentConfig.qualificationDrawConfirmed;
	qualificationDrawPanelHeader.hidden = tournamentConfig.qualificationDrawConfirmed;

	if (!tournamentConfig.qualificationDrawConfirmed) {
		populateQualificationDrawPlayerField();
		populateQualificationDrawPickField();
	}
	else {
		renderQualificationDrawPlayers();
	}
}

//------------------------------------------------------------
// Render qualification rounds
//------------------------------------------------------------

const genQualificationCard = document.getElementById("gen-qualification-card");
const genQualificationOut = document.getElementById("gen-qualification-output");

const qualificationPickToPlayer = new Map();

function populateQualificationPickToPlayer() {
	qualificationPickToPlayer.clear();
	qualificationDraw.forEach((p) => {
		qualificationPickToPlayer.set(p.pick, p);
	});
}

function renderQualificationRounds() {

	const blockEl = document.createElement("section");
	blockEl.className = "gen-block";

	qualificationRounds.forEach((round) => {
		const roundEl = document.createElement("div");
		roundEl.className = "gen-round";
		roundEl.dataset.roundId = round.roundId;

		const rLabel = document.createElement("p");
		rLabel.className = "gen-round-label";
		rLabel.innerHTML = `Round ${round.roundId + 1}`;
		roundEl.appendChild(rLabel);

		const matchesRow = document.createElement("div");
		matchesRow.className = "gen-matches-row";

		round.matches.forEach((match) => {
			matchesRow.appendChild(
				buildMatchCard(match, round.roundId, false, (number) => qualificationPickToPlayer.get(number)?.name || String(number)),
			);
		});

		roundEl.appendChild(matchesRow);

		// Bench
		if (round.bench && round.bench.length > 0) {
			roundEl.appendChild(
				buildBenchCard(round.bench, round.roundId, false, (number) =>
					String(number),
				),
			);
		}

		blockEl.appendChild(roundEl);
	});

	genQualificationOut.innerHTML = "";
	genQualificationOut.appendChild(blockEl);
}

function renderQualificationScores() {
}


function renderTournament() {
	const hasTournamentValue = hasTournament();

	console.log("Rendering tournament, hasTournament:", hasTournamentValue);
	
	genTournamentEmpty.hidden = hasTournamentValue;
	genQualificationDrawCard.hidden = !hasTournamentValue;
	genQualificationCard.hidden = !hasTournamentValue;
	genClearTournamentBtn.hidden = !hasTournamentValue;
	genPrintTournamentBtn.hidden = !hasTournamentValue;
	genExportTournamentBtn.hidden = !hasTournamentValue;

	if (!hasTournamentValue) {
		return;
	}

	renderQualificationDraw();
	renderQualificationRounds();
	renderQualificationScores();

	genTournamentDatePicker.valueAsDate = tournamentConfig.tournamentDate ? new Date(tournamentConfig.tournamentDate) : null;

	// if (trainingDate) {
	// 	genDatePicker.valueAsDate = trainingDate; // Format as YYYY-MM-DD for input[type=date]
	// }
}


genQualificationDrawTableBody.addEventListener("click", (e) => {
	const playerId = Number(e.target.dataset.id);

	// 1. Handle the Remove Button
	if (e.target.closest(".remove-btn")) {
		qualificationDraw = qualificationDraw.filter((p) => p.id !== playerId);
		saveQualificationDraw();
		renderQualificationDrawPlayers();
		populateQualificationDrawPlayerField();
		return;
	}
});

// const rounds = generateRandomDoublesTournament({
// 	activePlayerCount: 14,
// 	matchCount: 4,
// 	activeWomenCount: 4,
// 	courts: ["C1", "C2", "C3"],
// });

// //console.log("Generated tournament rounds:", rounds);


//loadTournamentFromStorage();
generateTournament();