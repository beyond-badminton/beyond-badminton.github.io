/**
 * Computes overall ranking of players from head-to-head stats + draw picks.
 *
 * Tie-break order (applied to a *group* of players tied on the levels above it):
 *   1. WINS      - total wins (desc)
 *   2. PLAYED    - total games played (asc) - this is temporary until all players have played the same number of games
 *   3. DIFF      - overall diff (desc)
 *   4. P2P WINS  - wins within a mini-table built only from games among the tied group (desc)
 *   5. P2P DIFF  - diff within that same mini-table (desc)
 *   6. PICK      - lower drawn pick number wins
 *   7. WITHDRAWN - players who withdrew are ranked lower
 *
 * Each returned player gets a `decidedBy` field naming the criterion that
 * actually separated them from everyone else still tied with them at that
 * point - i.e. the rule that "solved" their final position. A player who is
 * already unique on total wins gets decidedBy: "WINS"; one who needed the
 * head-to-head diff within their tied group gets "P2P DIFF"; etc.
 *
 * P2P WINS/DIFF are computed fresh per tied group (only counting games played
 * among that group), rather than as a raw pairwise comparison - this avoids
 * non-transitive cycles (A beat B, B beat C, C beat A) producing a
 * meaningless, sort-order-dependent result. A genuine cycle shows up as an
 * equal P2P record for everyone in the group, and correctly falls through to
 * PICK for the whole group.
 *
 * @param {Object} stats - keyed by player id, each with { name, pick, played, wins, losses, diff, opponents, withdrawn }
 * @param {boolean} inplace - if true, also modifies the original stats objects
 * @param {boolean} tiedOnly - if true, only tied-groups will contain the `decidedBy` field
 * @returns {Array} players sorted best -> worst, each annotated with `rank`, `decidedBy`
 */
function rankPlayers(stats, inplace, tiedOnly = false) {
	console.log("Ranking players with stats:", stats);
	const players = Object.keys(stats).map((id) => ({
		id,
		...stats[id]
	}));

	if (players.length <= 1) {
		players.forEach((p) => {
			p.decidedBy = "WINS";
		});
		players.forEach((p, i) => (p.rank = i + 1));
		return players;
	}

	const orderedGroups = splitAndAssign(players, 0, 0);

	if (tiedOnly) {
		orderedGroups.forEach((group) => {
			// Only keep `decidedBy` for players who were actually tied and needed it
			if (group.length === 1 || group[0].decidedBy !== "WITHDRAWN") {
				delete group[0].decidedBy;
			}
		});
	}

	const flat = orderedGroups.flat();

	flat.forEach((p, i) => {
		p.rank = i + 1;
		if (inplace) {
			const original = stats[p.id];
			if (original) {
				original.rank = p.rank;
				original.decidedBy = p.decidedBy;
			}
		}
	});

	return flat;
}

const LEVELS = [
	{ label: "WITHDRAWN", order: "asc", keyFn: null }, // computed per-group below
	{ label: "WINS", order: "desc", keyFn: (p) => p.wins },
	{ label: "PLAYED", order: "asc", keyFn: (p) => p.played },
	{ label: "DIFF", order: "desc", keyFn: (p) => p.diff },
	{ label: "P2P WINS", order: "desc", keyFn: null }, // computed per-group below
	{ label: "P2P DIFF", order: "desc", keyFn: null }, // computed per-group below
	{ label: "PICK", order: "asc", keyFn: (p) => p.pick },
];

/**
 * Recursively splits a tied group by successive criteria, assigning
 * `decidedBy` to each player the moment they become uniquely placed.
 * Returns an array of arrays (each inner array already in final order),
 * to be flattened by the caller.
 */
function splitAndAssign(group, levelIdx) {
	console.log(`Splitting group at level ${levelIdx}:`, group);
	if (group.length <= 1) return [group];
	if (levelIdx >= LEVELS.length) {
		// Should not happen if pick numbers are unique - everyone stays tied.
		return [group];
	}


	if (levelIdx === 0) {
		const withdrawn = group.filter((p) => p.withdrawn || false);
		if (withdrawn.length > 0) {
			const levelLabel = LEVELS[levelIdx].label;
			withdrawn.forEach((p) => {
				p.decidedBy = levelLabel;
			});

			const orderedWithdrawnGroups = splitAndAssign(withdrawn, levelIdx + 1);
			const orderedWithdrawn = orderedWithdrawnGroups.flat();
			for (const p of orderedWithdrawn) {
				p.decidedBy = "WITHDRAWN";
			}

			return [...splitAndAssign(group.filter((p) => !p.withdrawn), levelIdx + 1), ...orderedWithdrawn];
		}
		levelIdx++;
	}

	const level = LEVELS[levelIdx];
	let keyed;

	if (level.label === "P2P WINS" || level.label === "P2P DIFF") {
		const ids = new Set(group.map((p) => p.id));
		const mini = {};
		group.forEach((p) => {
			let w = 0;
			let d = 0;
			Object.keys(p.opponents || {}).forEach((oid) => {
				if (ids.has(oid)) {
					w += p.opponents[oid].wins;
					d += p.opponents[oid].diff;
				}
			});
			mini[p.id] = { w, d };
		});
		keyed = group.map((p) => ({
			p,
			key: level.label === "P2P WINS" ? mini[p.id].w : mini[p.id].d,
		}));
	} else {
		keyed = group.map((p) => ({ p, key: level.keyFn(p) }));
	}

	keyed.sort((a, b) => (level.order === "asc" ? a.key - b.key : b.key - a.key));

	// Bucket consecutive entries with equal key into subgroups.
	const subgroups = [];
	for (const item of keyed) {
		const last = subgroups[subgroups.length - 1];
		if (last && last.key === item.key) {
			last.players.push(item.p);
		} else {
			subgroups.push({ key: item.key, players: [item.p] });
		}
	}

	const result = [];
	for (const sg of subgroups) {
		console.log(`Processing subgroup with key ${sg.key}:`, sg.players);
		if (sg.players.length === 1) {
			sg.players[0].decidedBy = level.label;
			result.push(sg.players);
		} else {
			result.push(...splitAndAssign(sg.players, levelIdx + 1));
		}
	}
	return result;
}

/**
 * @brief Applies (or reverts) a single match's score to a playerStats table.
 *
 * @param {Object} playerStats keyed by player id, each an existing player record with an `opponents` map
 * @param {Object} match { teamA: [ids], teamB: [ids] }
 * @param {Object} score { a, b }
 * @param {number} [sign=1] 1 to apply the match, -1 to undo/revert it
 * @return {void}
 *
 * @note Calls rankPlayers(playerStats, true) after updating stats.
 */
function applyMatchScore(playerStats, match, score, sign = 1) {
	const scoreA = score?.a || 0;
	const scoreB = score?.b || 0;

	if (scoreA === 0 && scoreB === 0) {
		// No score to apply
		return;
	}

	function updatePlayerRecord(record, sign, teamScore, opponentScore) {
		record.played += sign;
		if (teamScore > opponentScore) record.wins += sign;
		else if (teamScore < opponentScore) record.losses += sign;
		record.diff += sign * (teamScore - opponentScore);
	}

	match.teamA.forEach((id) => {
		//console.log(`Processing player ${id} in team A`, playerStats);
		const playerRecord = playerStats[id];
		//console.log(`Updating stats for player ${id} in team A: ${JSON.stringify(playerRecord)}`);
		updatePlayerRecord(playerRecord, sign, scoreA, scoreB);
		//console.log(`Updated stats for player ${id} in team A: ${JSON.stringify(playerRecord)}`);
		
		match.teamB.forEach((opponentId) => {
			const opponentRecord = playerRecord.opponents[opponentId] || { name: playerName(opponentId), played : 0, wins: 0, losses: 0, diff: 0 };
			updatePlayerRecord(opponentRecord, sign, scoreA, scoreB);
			if (opponentRecord.played === 0) {
				delete playerRecord.opponents[opponentId];
			} else {
				playerRecord.opponents[opponentId] = opponentRecord;
			}
		});
		//console.log(`Updated stats for player ${id} in team A: played=${playerRecord.played}, wins=${playerRecord.wins}, losses=${playerRecord.losses}, diff=${playerRecord.diff}`);
	});

	match.teamB.forEach((id) => {
		//console.log(`Processing player ${id} in team B`, playerStats);

		const playerRecord = playerStats[id];
		//console.log(`Updating stats for player ${id} in team B: ${JSON.stringify(playerRecord)}`);
		updatePlayerRecord(playerRecord, sign, scoreB, scoreA);
		//console.log(`Updated stats for player ${id} in team B: ${JSON.stringify(playerRecord)}`);
		
		match.teamA.forEach((opponentId) => {
			const opponentRecord = playerRecord.opponents[opponentId] || { name: playerName(opponentId), played : 0, wins: 0, losses: 0, diff: 0 };
			updatePlayerRecord(opponentRecord, sign, scoreB, scoreA);
			if (opponentRecord.played === 0) {
				delete playerRecord.opponents[opponentId];
			} else {
				playerRecord.opponents[opponentId] = opponentRecord;
			}
		});
		//console.log(`Updated stats for player ${id} in team B: played=${playerRecord.played}, wins=${playerRecord.wins}, losses=${playerRecord.losses}, diff=${playerRecord.diff}`);
	});

	rankPlayers(playerStats, true);
}

/**
 * @brief Reverts a previously applied match result from playerStats.
 *
 * @param {Object} playerStats keyed by player id, same shape as in applyMatchScore
 * @param {Object} match { teamA: [ids], teamB: [ids] }
 * @param {Object} score { a, b } the score originally applied for this match
 * @return {void}
 */
function revertMatchScore(playerStats, match, score) {
	applyMatchScore(playerStats, match, score, -1);
}
