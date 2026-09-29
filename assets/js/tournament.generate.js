// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

// ── DOM refs ──────────────────────────────────────────────────

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

genTournamentDatePicker.addEventListener("change", () => {
	if (!hasTournament()) return;
	tournamentConfig.tournamentDate = genTournamentDatePicker.valueAsDate.toISOString();
	saveTournamentConfig();
});

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
}
