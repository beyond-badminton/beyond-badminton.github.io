// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

// ── Storage keys ──────────────────────────────────────────────
const TOURNAMENT_KEY = "tournament-generator:tournament";
const TOURNAMENT_PLAYERS_KEY = "tournament-generator:tournamentPlayers";
const TOURNAMENT_SCORES_KEY = "tournament-generator:tournamentScores";
const TOURNAMENT_DATE_KEY = "tournament-generator:tournamentDate";

let tournament = {};
let tournamentPlayers = {};
let tournamentScores = {};
let tournamentDate = null;

// ── DOM refs ──────────────────────────────────────────────────

const genGenerateTournamentBtn = document.getElementById("gen-generate-tournament-btn");
const genClearTournamentBtn = document.getElementById("gen-clear-tournament-btn");
const genTournamentDatePicker = document.getElementById("gen-tournament-date-picker");
const genPrintTournamentBtn = document.getElementById("gen-print-tournament-btn");
const genExportTournamentBtn = document.getElementById("gen-export-tournament-btn");
const genTournamentOut = document.getElementById("gen-tournament-output");
const genTournamentEmpty = document.getElementById("gen-tournament-empty");
const genQualificationMatchesNum = document.getElementById("qualification-matches");
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
	// 	tournamentDate
	// );
});

genExportTournamentBtn.addEventListener("click", () => {
	// downloadTournamentSpreadsheet(
	// 	tournament,
	// 	tournamentPlayers,
	// 	tournamentScores,
	// 	tournamentDate
	// );
});

genTournamentDatePicker.addEventListener("change", () => {
	tournamentDate = genTournamentDatePicker.valueAsDate;
	saveGeneratedTournamentToStorage(false);
});

function hasTournament() {
	return (
		tournament &&
		Object.keys(tournament).length > 0
	);
}

function clearGeneratedTournamentFromStorage() {
	tournament = {};
	tournamentPlayers = {};
	tournamentScores = {};
	tournamentDate = null;

	try {
		localStorage.removeItem(TOURNAMENT_KEY);
		localStorage.removeItem(TOURNAMENT_PLAYERS_KEY);
		localStorage.removeItem(TOURNAMENT_SCORES_KEY);
		localStorage.removeItem(TOURNAMENT_DATE_KEY);
	} catch {}

	renderTournament();
}

function saveTournamentScores() {
	try {
		localStorage.setItem(TOURNAMENT_SCORES_KEY, JSON.stringify(scores));
	} catch (_) {}
}

function saveTournamentPlayers() {
	try {
		localStorage.setItem(TOURNAMENT_PLAYERS_KEY, JSON.stringify(players));
	} catch (_) {}
}

function saveGeneratedTournamentToStorage(render = true) {
	try {
		localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(tournament));
		if (tournamentDate) {
			localStorage.setItem(
				TOURNAMENT_DATE_KEY,
				tournamentDate.toISOString(),
			);
		} else {
			localStorage.removeItem(TOURNAMENT_DATE_KEY);
		}
	} catch {}

	saveTournamentPlayers();
	saveTournamentScores();

	if (render) renderTournament();
}

function loadGeneratedTournamentFromStorage() {
	try {
		const savedTournament = localStorage.getItem(TOURNAMENT_KEY);
		const savedPlayers = localStorage.getItem(TOURNAMENT_PLAYERS_KEY);
		const savedScores = localStorage.getItem(TOURNAMENT_SCORES_KEY);
		const savedDate = localStorage.getItem(TOURNAMENT_DATE_KEY);

		if (savedTournament) tournament = JSON.parse(savedTournament);
		if (savedPlayers) tournamentPlayers = JSON.parse(savedPlayers);
		if (savedScores) tournamentScores = JSON.parse(savedScores);
		if (savedDate) tournamentDate = new Date(savedDate);
	} catch {
		tournament = {};
		tournamentPlayers = {};
		tournamentScores = {};
		tournamentDate = null;
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
 * @param {Object} options
 * @param {number} options.activePlayerCount Total number of active players.
 * @param {number} options.men Number of men.
 * @param {number} options.women Number of women.
 * @param {number} options.matchCount Number of doubles matches to generate.
 * @param {boolean} options.allowTwoMenVsTwoWomen
 * @param {string[]} options.courts Available court names, e.g. ["C1", "C2", "C3"]
 *
 * @returns {{
 *   players: number[],
 *   matches: Array,
 *   stats: Object
 * }}
 */
function generateQualificationMatches(
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

function generateTournament() {
	const activeWomenCount = genDisableTwoMenVsTwoWomenCb.value 
		? activePlayers.filter((ap) => playerIsWoman(ap.allPlayerId)).length
		: null;

	const rounds = generateQualificationMatches(activePlayers.length, activeWomenCount, Number(genQualificationMatchesNum.value), ["C1", "C2", "C3"]);
	tournament = { qualificationRounds : rounds };
	saveGeneratedTournamentToStorage(true);
}

function renderTournament() {
	const hasTournamentValue = hasTournament();
	
	genTournamentEmpty.hidden = hasTournamentValue;
	genTournamentOut.hidden = !hasTournamentValue;
	genTournamentOut.innerHTML = "";
	genClearTournamentBtn.hidden = !hasTournamentValue;
	genPrintTournamentBtn.hidden = !hasTournamentValue;
	genExportTournamentBtn.hidden = !hasTournamentValue;

	if (!hasTournamentValue) {
		return;
	}

	//console.log("Rendering training:", training);
	const blockEl = document.createElement("section");
	blockEl.className = "gen-block";

	// with round, we will print time for each whole hour
	// this is sufficient since we are generating matches per hour
	let courtBlockStart = null;

	tournament.qualificationRounds.forEach((round) => {
		const roundEl = document.createElement("div");
		roundEl.className = "gen-round";
		roundEl.dataset.roundId = round.roundId;

		if (round.courtBlockStart && round.courtBlockStart !== courtBlockStart) {
			const bHeader = document.createElement("div");
			bHeader.className = "gen-block-header";
			bHeader.textContent = round.courtBlockStart;
			blockEl.appendChild(bHeader);
		}

		courtBlockStart = round.courtBlockStart;

		const rLabel = document.createElement("p");
		rLabel.className = "gen-round-label";
		rLabel.innerHTML = `Round ${round.roundId + 1}`;
		roundEl.appendChild(rLabel);

		const matchesRow = document.createElement("div");
		matchesRow.className = "gen-matches-row";

		round.matches.forEach((match) => {
			matchesRow.appendChild(
				buildMatchCard(match, round.roundId, false, (number) => String(number)),
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

	genTournamentOut.appendChild(blockEl);

	// if (trainingDate) {
	// 	genDatePicker.valueAsDate = trainingDate; // Format as YYYY-MM-DD for input[type=date]
	// }
}

// const rounds = generateRandomDoublesTournament({
// 	activePlayerCount: 14,
// 	matchCount: 4,
// 	activeWomenCount: 4,
// 	courts: ["C1", "C2", "C3"],
// });

// //console.log("Generated tournament rounds:", rounds);


loadGeneratedTournamentFromStorage();