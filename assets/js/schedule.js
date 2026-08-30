'use strict';

function workerMain() {

	const SCHEDULES_GEN_COUNT = 120;
	const BEST_TEAMS_ITER = 100;

	// ── Utilities ─────────────────────────────────────────────────
	function timeToMins(t) {
		const [h, m] = t.split(':').map(Number);
		return h * 60 + m;
	}

	function minsToTime(total) {
		return String(Math.floor(total / 60) % 24).padStart(2, '0') + ':' +
					 String(total % 60).padStart(2, '0');
	}

	function randInt(n) { return Math.floor(Math.random() * n); }

	function genId() {
		return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
	}

	function incMatrix(mat, idx, id1, id2) {
		if (id1 === id2) return;
		const i = idx[id1], j = idx[id2];
		if (i == null || j == null) return;
		mat[i][j]++;
		mat[j][i]++;
	}

	function getMatrix(mat, idx, id1, id2) {
		if (id1 === id2) return 0;
		const i = idx[id1], j = idx[id2];
		if (i == null || j == null) return 0;
		return mat[i][j];
	}

	// ── Main message handler ──────────────────────────────────────
	self.onmessage = function (e) {
		const { activePlayers, allPlayers, courtBlocks, roundDuration, allowSingles } = e.data;

		// Build allPlayer lookup by id
		const allMap = {};
		allPlayers.forEach(p => { allMap[p.id] = p; });

		// Enrich active players with name, skill, availability window (in minutes)
		const players = activePlayers.map(ap => {
			const base = allMap[ap.allPlayerId] || {};
			return {
				id:       ap.id,
				name:     base.name  || '?',
				skill:    Number(base.skill) || 1,
				startMin: timeToMins(ap.arrival),
				endMin:   timeToMins(ap.arrival) + Number(ap.playtime) * 60,
			};
		});

		const n = players.length;
		const idxOf = {};
		players.forEach((p, i) => { idxOf[p.id] = i; });

		// Quick skill lookup by active-player id
		const skillOf = {};
		players.forEach(p => { skillOf[p.id] = p.skill; });

		// Pre-compute total rounds for smooth progress reporting
		let totalIretations = 0;
		courtBlocks.forEach(courtBlocks => {
			if (courtBlocks.duration < 10) return;
			let rc = Math.floor(courtBlocks.duration / roundDuration);
			if (courtBlocks.duration % roundDuration >= roundDuration * 0.5) rc++;
			if (rc === 0) rc = 1;
			totalIretations += rc;
		});

		//console.log("courtBlocks:", courtBlocks);

		totalIretations *= SCHEDULES_GEN_COUNT;

		let doneIterations = 0;

		let lastSchedule = null;
		let lastScheduleTotalPenalty = Infinity;

		for (let genIdx = 0; genIdx < SCHEDULES_GEN_COUNT; genIdx++) {

			// Global history matrices (accumulated across all courtBlocks within a single schedule)
			const sameTeamMat = Array.from({ length: n }, () => new Array(n).fill(0));
			const oppMat      = Array.from({ length: n }, () => new Array(n).fill(0));

			let roundId = 0
			const rounds = [];

			const sitCount     = {};
			const lastSitRound = {};

			for (const courtBlock of courtBlocks) {
				if (courtBlock.duration < 5) continue;

				// Rounds per courtBlock (lenient rounding rule)
				let roundsPerBlock = Math.floor(courtBlock.duration / roundDuration);
				if (courtBlock.duration % roundDuration >= roundDuration * 0.5) roundsPerBlock++;
				if (roundsPerBlock === 0) roundsPerBlock = 1;

				const blockStartMin = timeToMins(courtBlock.start);

				// Per-block sit-count tracking for Phase 1 bench assignment
				players.forEach(p => { sitCount[p.id] = 0; lastSitRound[p.id] = -99; });

				for (let ri = 0; ri < roundsPerBlock; ri++) {
					const slotStart = blockStartMin + ri * roundDuration;
					const slotEnd   = slotStart + roundDuration;

					// Players whose availability window fully covers this slot
					const eligible = players.filter(p => p.startMin <= slotStart && p.endMin >= slotEnd);

					const reportProgress = () => {
						doneIterations++;
						self.postMessage({
							type: 'progress',
							pct: Math.min(95, Math.round(doneIterations / (totalIretations || 1) * 95)),
						});
					};

					if (eligible.length < 4) { reportProgress(); continue; }

					//console.log("courts:", courtBlock.courts);
					//console.log("courts length:", courtBlock.courts.length);

					// How many matches fit?
					// start with doubles assumption, then adjust if singles are allowed
					let matchCount = Math.min(courtBlock.courts.length, Math.floor(eligible.length / 4));

					const remainingPlayers = eligible.length - matchCount * 4;
					const remainingCourts = courtBlock.courts.length - matchCount;
					const doublesMatchCount = matchCount;
					const singlesMatchCount = allowSingles ? Math.min(remainingCourts, Math.floor(remainingPlayers / 2)) : 0;
					const totalMatchCount = doublesMatchCount + singlesMatchCount;

					if (totalMatchCount === 0) { reportProgress(); continue; }

					//console.log("eligible:", eligible.map(p => p.name));
					//console.log("courts:", courtBlock.courts);
					//console.log("doublesMatchCount:", matchCount, "singlesMatchCount:", singlesMatchCount, "totalMatchCount:", totalMatchCount);

					const doublesPlayingCount = doublesMatchCount * 4;
					const benchCount   = Math.max(0, eligible.length - doublesPlayingCount);

					// ── Phase 1: deterministic bench assignment ─────────────
					// Players who sat last round must play now (no consecutive sits).
					const canSitNow = eligible.filter(p => lastSitRound[p.id] !== ri - 1);
					// Sort ascending by sit count → fewest sits first (they're best candidates for bench)
					canSitNow.sort((a, b) => sitCount[a.id] - sitCount[b.id]);

					let benchPlayers = canSitNow.slice(0, benchCount);
					const benchSet     = new Set(benchPlayers.map(p => p.id));
					const playingPlayers = eligible.filter(p => !benchSet.has(p.id));


					// ── Phase 2+3: seeded init + Monte Carlo ────────────────
					let matches = findBestTeams(
						playingPlayers, doublesMatchCount, courtBlock.courts.slice(0, doublesMatchCount),
						sameTeamMat, oppMat, idxOf, skillOf,
					);

					// Update global history matrices after committing these matches
					matches.forEach(m => {
						incMatrix(sameTeamMat, idxOf, m.teamA[0], m.teamA[1]);
						incMatrix(sameTeamMat, idxOf, m.teamB[0], m.teamB[1]);
						incMatrix(oppMat, idxOf, m.teamA[0], m.teamB[0]);
						incMatrix(oppMat, idxOf, m.teamA[0], m.teamB[1]);
						incMatrix(oppMat, idxOf, m.teamA[1], m.teamB[0]);
						incMatrix(oppMat, idxOf, m.teamA[1], m.teamB[1]);
					});

					if (singlesMatchCount > 0) {
						const singlesPlayingCount = singlesMatchCount * 2;
						const singlesBenchCount   = Math.max(0, eligible.length - doublesPlayingCount - singlesPlayingCount);

						benchPlayers = canSitNow.slice(0, singlesBenchCount);
						const singlesBenchSet     = new Set(benchPlayers.map(p => p.id));

						const singlesPlayingPlayers = eligible.filter(p => !matches.some(m => m.teamA.includes(p.id) || m.teamB.includes(p.id)) && !singlesBenchSet.has(p.id));
						
						const singlesMatches = findBestSingles(singlesPlayingPlayers, singlesMatchCount, courtBlock.courts.slice(doublesMatchCount, doublesMatchCount + singlesMatchCount))
						matches = matches.concat(singlesMatches)

						singlesMatches.forEach(m => {
							incMatrix(oppMat, idxOf, m.teamA[0], m.teamB[0]);
						});
					}
					
					benchPlayers.forEach(p => {
						sitCount[p.id]++;
						lastSitRound[p.id] = ri;
					});

					rounds.push({
						roundId: roundId++,
						slotStart:  minsToTime(slotStart),
						matches : matches,
						bench: benchPlayers.map(p => p.id),
					});

					reportProgress();
				}
			}

			let schedule = { rounds: rounds };

			const penalties = computePenalties(schedule, allPlayers, activePlayers, PENALTY_WEIGHTS);
			const totalPenalty = penalties.skill + penalties.sameTeam + penalties.opponent + penalties.bench;

			// console.log(" index: ", genIdx, "penalties: ", penalties, "total penalty: ", totalPenalty);
			// console.log("penalties: ", penalties);
			// console.log("total penalty: ", totalPenalty);

			if (lastSchedule == null || totalPenalty < lastScheduleTotalPenalty) {
				lastSchedule = schedule;
				lastScheduleTotalPenalty = totalPenalty;
			}
			
		}
		self.postMessage({ type: 'progress', pct: 100 });
		self.postMessage({ type: 'done', schedule: lastSchedule });
	};

	// ── Team assignment ───────────────────────────────────────────
	function findBestTeams(players, matchCount, courts, sameTeamMat, oppMat, idxOf, skillOf) {

		let best      = seedTeams(players, matchCount);
		let bestScore = scoreTeams(best, sameTeamMat, oppMat, idxOf, skillOf);

		for (let i = 0; i < BEST_TEAMS_ITER; i++) {
			const candidate = mutate(best);
			const s = scoreTeams(candidate, sameTeamMat, oppMat, idxOf, skillOf);
			if (s < bestScore) { best = candidate; bestScore = s; }
		}

		return best.map((m, i) => ({
			matchId: genId(),
			court:   courts[i] !== undefined ? courts[i] : courts[courts.length - 1],
			teamA:   m.teamA,
			teamB:   m.teamB,
		}));
	}

	// Seed: sort by skill desc, group into 4s, pair (best + worst) vs (2nd + 3rd)
	function seedTeams(players, matchCount) {
		const sorted  = [...players].sort((a, b) => b.skill - a.skill);
		const matches = [];
		for (let i = 0; i < matchCount; i++) {
			const g = sorted.slice(i * 4, i * 4 + 4);
			if (g.length < 4) break;
			matches.push({ teamA: [g[0].id, g[3].id], teamB: [g[1].id, g[2].id] });
		}
		return matches;
	}

	// ── Team assignment ───────────────────────────────────────────
	function findBestSingles(players, matchCount, courts) {
		const sorted = [...players].sort((a, b) => b.skill - a.skill);
		const matches = [];
		
		for (let i = 0; i < matchCount; i++) {
			const p1Index = i * 2;
			const p2Index = i * 2 + 1;
			
			// Break if we run out of players to make a pair
			if (p2Index >= sorted.length) break; 
			
			matches.push({ 
				playerA: sorted[p1Index].id, 
				playerB: sorted[p2Index].id 
			});
		}

		return matches.map((m, i) => ({
			matchId: genId(),
			court:   courts[i] !== undefined ? courts[i] : courts[courts.length - 1],
			teamA:   [m.playerA],
			teamB:   [m.playerB],

		}));
	}

	// Three mutation types
	function mutate(arrangement) {
		if (arrangement.length === 0) return arrangement;
		const arr = arrangement.map(m => ({ teamA: [...m.teamA], teamB: [...m.teamB] }));
		const r = Math.random();

		if (r < 0.45 && arr.length > 1) {
			// Swap one player between two different matches
			const mi = randInt(arr.length);
			let   mj = randInt(arr.length);
			while (mj === mi) mj = randInt(arr.length);
			const ti = Math.random() < 0.5 ? 'teamA' : 'teamB';
			const tj = Math.random() < 0.5 ? 'teamA' : 'teamB';
			const pi = randInt(2), pj = randInt(2);
			[arr[mi][ti][pi], arr[mj][tj][pj]] = [arr[mj][tj][pj], arr[mi][ti][pi]];
		} else if (r < 0.75) {
			// Swap one player cross-team within the same match
			const mi = randInt(arr.length);
			const pi = randInt(2), pj = randInt(2);
			[arr[mi].teamA[pi], arr[mi].teamB[pj]] = [arr[mi].teamB[pj], arr[mi].teamA[pi]];
		} else {
			// Swap two players within the same team (minor re-ordering, still useful for history scoring)
			const mi   = randInt(arr.length);
			const team = Math.random() < 0.5 ? 'teamA' : 'teamB';
			[arr[mi][team][0], arr[mi][team][1]] = [arr[mi][team][1], arr[mi][team][0]];
		}
		return arr;
	}

	function scoreTeams(arrangement, sameTeamMat, oppMat, idxOf, skillOf) {
		let score = 0;
		for (const m of arrangement) {
			const [a0, a1, b0, b1] = [...m.teamA, ...m.teamB];
			// Same-team repeat
			score += getMatrix(sameTeamMat, idxOf, a0, a1) * PENALTY_WEIGHTS.SAME_TEAM;
			score += getMatrix(sameTeamMat, idxOf, b0, b1) * PENALTY_WEIGHTS.SAME_TEAM;
			// Opponent repeat
			score += (getMatrix(oppMat, idxOf, a0, b0) + getMatrix(oppMat, idxOf, a0, b1) +
					      getMatrix(oppMat, idxOf, a1, b0) + getMatrix(oppMat, idxOf, a1, b1)) * PENALTY_WEIGHTS.OPPONENT;
			// Skill imbalance
			const sa   = (skillOf[a0] || 1) + (skillOf[a1] || 1);
			const sb   = (skillOf[b0] || 1) + (skillOf[b1] || 1);
			const diff = Math.abs(sa - sb);
			if      (diff === 1) score += PENALTY_WEIGHTS.SKILL_1;
			else if (diff === 2) score += PENALTY_WEIGHTS.SKILL_2;
			else if (diff >= 3)  score += PENALTY_WEIGHTS.SKILL_3 + (diff - 3) * 4;
		}
		return score;
	}
}

// ── Storage keys ──────────────────────────────────────────────
const SCHEDULE_KEY = 'tournament-generator:schedule';
const SCORES_KEY   = 'tournament-generator:scores';
const SCHEULE_DATE_KEY = 'tournament-generator:scheduleDate';

// ── Penalty weights (mirror of worker) ───────────────────────
const PENALTY_WEIGHTS = {
	EXTRA_SIT:   5,
	CONSEC_SIT: 50,
	SKILL_1:     2,
	SKILL_2:     6,
	SKILL_3:    12,
	SAME_TEAM:  20,
	OPPONENT:    5,
};

// ── State ─────────────────────────────────────────────────────
let schedule = null;   // { rounds: [...] }
let scores   = {};     // { [matchId]: { a: number|null, b: number|null } }
let worker   = null;
let scheduleDate = null; // Date object representing the date of the schedule

// ── DOM refs ──────────────────────────────────────────────────
const genMatchesPerHourSel = document.getElementById('matches-per-hour');
const genAllowSinglesCb   = document.getElementById('allow-singles');
const genGenerateBtn      = document.getElementById('gen-generate-btn');
const genClearBtn         = document.getElementById('gen-clear-btn');
const genDatePicker       = document.getElementById('gen-date-picker');
const genPrintBtn         = document.getElementById('gen-print-btn');
const genExportBtn        = document.getElementById('gen-export-btn');
const genProgress         = document.getElementById('gen-progress');
const genProgressBar      = document.getElementById('gen-progress-bar');
const genScoreboard       = document.getElementById('gen-scoreboard');
const genScheduleOut      = document.getElementById('gen-schedule-output');
const genStatsOut         = document.getElementById('gen-stats-output');
const genStatsTbody       = document.getElementById('gen-stats-tbody');
const genEmpty            = document.getElementById('gen-empty');

// ── Utility ───────────────────────────────────────────────────
function timeToMins(t) {
	const [h, m] = t.split(':').map(Number);
	return h * 60 + m;
}

function minsToTime(total) {
	return String(Math.floor(total / 60) % 24).padStart(2, '0') + ':' +
				 String(total % 60).padStart(2, '0');
}

function playerName(activeId) {
	const ap = activePlayers.find(p => p.id === activeId);
	if (!ap) return '?';
	const p = allPlayers.find(p => p.id === ap.allPlayerId);
	return p ? p.name : '?';
}
function playerSkill(activeId) {
	const ap = activePlayers.find(p => p.id === activeId);
	if (!ap) return '?';
	const p = allPlayers.find(p => p.id === ap.allPlayerId);
	return p ? p.skill : '?';
}

// ── Generate button handler ───────────────────────────────────
genGenerateBtn.addEventListener('click', () => {
	if (schedule && !confirm('Replace the existing schedule with a new one?')) return;
	runGeneration();
});

genClearBtn.addEventListener('click', () => {
	if (!confirm('Clear the generated schedule and all scores?')) return;
	clearGeneratedScheduleFromStorage();
});

genPrintBtn.addEventListener('click', () => {
	printSchedule();
});


genExportBtn.addEventListener('click', () => {
	downloadScheduleSpreadsheet();
});

genDatePicker.addEventListener('change', () => {
	scheduleDate = genDatePicker.valueAsDate;
	saveGeneratedScheduleToStorage();
});

function normalizeBlock(blocks) {
	// Helper: Convert "HH:MM" to total minutes since midnight
	const timeToMins = (time) => {
	  const [hours, minutes] = time.split(':').map(Number);
	  return hours * 60 + minutes;
	};
  
	// Helper: Convert total minutes back to "HH:MM"
	const minsToTime = (mins) => {
	  const hours = String(Math.floor(mins / 60)).padStart(2, '0');
	  const minutes = String(mins % 60).padStart(2, '0');
	  return `${hours}:${minutes}`;
	};
  
	// 1. Gather all unique time boundaries (starts and ends)
	const boundaries = new Set();
	const processedBlocks = blocks.map(block => {
	  const startMins = timeToMins(block.start);
	  const endMins = startMins + block.duration;
	  boundaries.add(startMins);
	  boundaries.add(endMins);
	  return { ...block, startMins, endMins };
	});
  
	// Sort boundaries chronologically
	const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
  
	const result = [];
  
	// 2. Create intervals between consecutive boundaries
	for (let i = 0; i < sortedBoundaries.length - 1; i++) {
	  const segmentStart = sortedBoundaries[i];
	  const segmentEnd = sortedBoundaries[i + 1];
	  const duration = segmentEnd - segmentStart;
  
	  const activeCourts = new Set();
  
	  // Find all original blocks that cover this time segment
	  for (const block of processedBlocks) {
		if (block.startMins <= segmentStart && block.endMins >= segmentEnd) {
		  block.courts.forEach(court => activeCourts.add(court));
		}
	  }
  
	  // If courts are available during this segment, add to result
	  if (activeCourts.size > 0) {
		result.push({
		  start: minsToTime(segmentStart),
		  duration: duration,
		  courts: Array.from(activeCourts).sort() // sort alphabetically (optional)
		});
	  }
	}
  
	// 3. Clean up: Merge consecutive blocks that have the exact same courts
	const mergedResult = [];
	for (const current of result) {
	  if (mergedResult.length > 0) {
		const last = mergedResult[mergedResult.length - 1];
		const lastEndMins = timeToMins(last.start) + last.duration;
		const currentStartMins = timeToMins(current.start);
		
		// Check if the courts are identical
		const sameCourts = JSON.stringify(last.courts) === JSON.stringify(current.courts);
  
		// If they touch continuously and have the same courts, merge them
		if (lastEndMins === currentStartMins && sameCourts) {
		  last.duration += current.duration;
		  continue;
		}
	  }
	  mergedResult.push(current);
	}

	//console.log("Original court blocks:", blocks);
	//console.log("Normalized court blocks:", mergedResult);

	return mergedResult;
}

function runGeneration() {
	if (activePlayers.length === 0) { alert('Add active players first.'); return; }
	if (courtBlocks.length === 0)   { alert('Add court availability blocks first.'); return; }

	if (worker) { worker.terminate(); worker = null; }

	setProgress(0);
	genProgress.hidden         = false;
	genGenerateBtn.disabled    = true;
	// Build Blob URL from the inlined worker source string.
	// This works under file:// origins — no fetch or external file needed.
	const blob = new Blob([`
		const PENALTY_WEIGHTS = ${JSON.stringify(PENALTY_WEIGHTS)};
		${computePenalties.toString()};
		(${workerMain.toString()})()
	`], { type: 'application/javascript' });

	const workerUrl = URL.createObjectURL(blob);
	worker = new Worker(workerUrl);
	URL.revokeObjectURL(workerUrl);
	worker.onmessage = e => {
		const msg = e.data;
		if (msg.type === 'progress') {
			setProgress(msg.pct);
		} else if (msg.type === 'done') {
			worker = null;
			genProgress.hidden         = false;
			genGenerateBtn.disabled    = false;
			setProgress(100);
			setTimeout(() => { genProgress.hidden = true; }, 600);

			// Preserve existing scores for any surviving matchIds
			schedule = msg.schedule;
			//console.log("New schedule generated:", schedule);
			const newScores = {};
			if (schedule) {
				schedule.rounds.forEach(r => r.matches.forEach(m => {
					newScores[m.matchId] = scores[m.matchId] || { a: null, b: null };
				}));
			}
			scores = newScores;
			saveGeneratedScheduleToStorage();
			renderGeneratedSchedule();
		}
	};
	worker.onerror = err => {
		alert('Generator error: ' + err.message);
		genProgress.hidden        = true;
		genGenerateBtn.disabled   = false;
		worker = null;
	};

	worker.postMessage({
		activePlayers,
		allPlayers,
		courtBlocks: normalizeBlock(courtBlocks),
		roundDuration: Math.floor(60 / Number(genMatchesPerHourSel.value)),
		allowSingles:  genAllowSinglesCb.checked,
	});
}

function setProgress(pct) {
	genProgressBar.style.width = pct + '%';
	genProgressBar.textContent = pct < 100 ? pct + '%' : 'Done';
}

// ── Render ────────────────────────────────────────────────────
function renderGeneratedSchedule() {
	const hasSchedule = schedule && schedule.rounds && schedule.rounds.length > 0;

	genEmpty.hidden          = hasSchedule;
	genScoreboard.hidden     = !hasSchedule;
	genScheduleOut.hidden    = !hasSchedule;
	genStatsOut.hidden       = !hasSchedule;
	genClearBtn.hidden       = !hasSchedule;
	genPrintBtn.hidden       = !hasSchedule;
	genExportBtn.hidden      = !hasSchedule;
	
	genDatePicker.valueAsDate = null;

	if (!hasSchedule) return;

	renderSchedule();
	renderScoreboard();
	renderStatsTable();
}

function buildPlayerSlotInnerHtml(pid) {
	return `${playerName(pid)}&nbsp;` + renderSkillPillHtml(playerSkill(pid));
}

// ── Schedule output ───────────────────────────────────────────
function renderSchedule() {
	genScheduleOut.innerHTML = '';
	//console.log("Rendering schedule:", schedule);
	const blockEl = document.createElement('section');
	blockEl.className = 'gen-block';

	schedule.rounds.forEach(round => {
		const roundEl = document.createElement('div');
		roundEl.className = 'gen-round';
		roundEl.dataset.roundId = round.roundId;

		const rLabel = document.createElement('p');
		rLabel.className = 'gen-round-label';
		rLabel.textContent = `Round ${round.roundId + 1}`;
		roundEl.appendChild(rLabel);

		const matchesRow = document.createElement('div');
		matchesRow.className = 'gen-matches-row';

		round.matches.forEach(match => {
			matchesRow.appendChild(buildMatchCard(match, round.roundId));
		});

		roundEl.appendChild(matchesRow);

		// Bench
		if (round.bench && round.bench.length > 0) {
			const benchEl = document.createElement('div');
			benchEl.className = 'gen-bench';
			benchEl.dataset.roundId = round.roundId;

			const bLabel = document.createElement('span');
			bLabel.className   = 'gen-bench-label';
			bLabel.textContent = 'Bench:';
			benchEl.appendChild(bLabel);

			round.bench.forEach((pid, bi) => {
				const slot = document.createElement('div');
				slot.className    = 'gen-player-slot bench-slot';
				slot.draggable    = true;
				slot.dataset.playerId   = pid;
				slot.dataset.bench      = 'true';
				slot.dataset.pos        = bi;
				slot.dataset.roundId = round.roundId;
				slot.innerHTML = buildPlayerSlotInnerHtml(pid);
				benchEl.appendChild(slot);
			});

			// Print-only: comma-separated bench names
			const printBench = document.createElement('span');
			printBench.className   = 'print-bench-names';
			printBench.textContent = round.bench.map(pid => playerName(pid)).join(', ');
			benchEl.appendChild(printBench);

			roundEl.appendChild(benchEl);
		}

		blockEl.appendChild(roundEl);
	});

	genScheduleOut.appendChild(blockEl);

	attachDragHandlers();

	if (scheduleDate) {
		genDatePicker.valueAsDate = scheduleDate; // Format as YYYY-MM-DD for input[type=date]
	}
}

function buildMatchCard(match, roundId) {
	const sc = scores[match.matchId] || { a: null, b: null };

	const card = document.createElement('div');
	card.className   = 'gen-match-card';
	card.dataset.matchId = match.matchId;

	const courtLabel = document.createElement('p');
	courtLabel.className = 'gen-court-label';
	courtLabel.textContent = match.court;
	card.appendChild(courtLabel);

	['teamA', 'teamB'].forEach((teamKey, ti) => {
		const teamEl = document.createElement('div');
		teamEl.className = 'gen-team' + (ti === 1 ? ' gen-team--right' : '');
		teamEl.dataset.team = teamKey;
		teamEl.dataset.matchId = match.matchId;

		match[teamKey].forEach((pid, pi) => {
			const slot = document.createElement('div');
			slot.className = 'gen-player-slot';
			slot.draggable = true;
			slot.dataset.playerId = pid;
			slot.dataset.team     = teamKey;
			slot.dataset.pos      = pi;
			slot.dataset.matchId  = match.matchId;
			slot.dataset.roundId  = roundId;
			slot.innerHTML = buildPlayerSlotInnerHtml(pid);
			teamEl.appendChild(slot);
		});

		// Print-only: comma-separated names
		const printSpan = document.createElement('span');
		printSpan.className   = 'print-team';
		printSpan.textContent = match[teamKey].map(pid => playerName(pid)).join(', ');
		teamEl.appendChild(printSpan);

		card.appendChild(teamEl);

		// Score box between teams
		if (ti === 0) {
			const scoreRow = document.createElement('div');
			const hasScore = sc.a !== null || sc.b !== null;
			scoreRow.className = 'gen-score-row' + (hasScore ? '' : ' score-blank');

			const inA = document.createElement('input');
			inA.type        = 'number';
			inA.min         = '0';
			inA.placeholder = '0';
			inA.className   = 'gen-score-input';
			inA.value       = sc.a !== null ? sc.a : '';
			inA.dataset.matchId = match.matchId;
			inA.dataset.side    = 'a';

			const sep = document.createElement('span');
			sep.textContent = ':';
			sep.className   = 'gen-score-sep';

			const inB = document.createElement('input');
			inB.type        = 'number';
			inB.min         = '0';
			inB.placeholder = '0';
			inB.className   = 'gen-score-input';
			inB.value       = sc.b !== null ? sc.b : '';
			inB.dataset.matchId = match.matchId;
			inB.dataset.side    = 'b';

			scoreRow.appendChild(inA);
			scoreRow.appendChild(sep);
			scoreRow.appendChild(inB);
			card.appendChild(scoreRow);
		}
	});

	return card;
}

// ── Score input handler ───────────────────────────────────────
genScheduleOut.addEventListener('change', e => {
	const inp = e.target.closest('.gen-score-input');
	if (!inp) return;
	const { matchId, side } = inp.dataset;
	if (!scores[matchId]) scores[matchId] = { a: null, b: null };
	const val = inp.value === '' ? null : Number(inp.value);
	scores[matchId][side] = val;
	saveScores();
});


// ── Scoreboard ────────────────────────────────────────────────
function computePenalties(schedule, allPlayers, activePlayers, penaltyWeights) {
	if (!schedule) return { skill: 0, sameTeam: 0, opponent: 0, bench: 0 };

	// Rebuild history matrices from schedule
	const ids = activePlayers.map(p => p.id);
	const n   = ids.length;
	const idx = {};
	ids.forEach((id, i) => { idx[id] = i; });

	const stMat  = Array.from({ length: n }, () => new Array(n).fill(0));
	const oppMat = Array.from({ length: n }, () => new Array(n).fill(0));

	function incM(mat, id1, id2) {
		if (id1 === id2) return;
		const i = idx[id1], j = idx[id2];
		if (i == null || j == null) return;
		mat[i][j]++; mat[j][i]++;
	}
	function getM(mat, id1, id2) {
		if (id1 === id2) return 0;
		const i = idx[id1], j = idx[id2];
		if (i == null || j == null) return 0;
		return mat[i][j];
	}

	function playerSkill(allPlayers, activePlayers, activeId) {
		const ap = activePlayers.find(p => p.id === activeId);
		if (!ap) return 1;
		const p = allPlayers.find(p => p.id === ap.allPlayerId);
		return p ? Number(p.skill) : 1;
	}
	
	let skillPen = 0, stPen = 0, oppPen = 0, benchPen = 0;

	// Track consecutive bench streak per player across all rounds
	const consecBench = {};
	ids.forEach(id => { consecBench[id] = 0; });

	schedule.rounds.forEach(round => {
		const benchSet   = new Set(round.bench || []);
		const playingSet = new Set();
		round.matches.forEach(m => { [...m.teamA, ...m.teamB].forEach(id => playingSet.add(id)); });

		// Update consecutive bench streaks; only for players participating this round
		ids.forEach(id => {
			if (!benchSet.has(id) && !playingSet.has(id)) return;
			if (benchSet.has(id)) {
				consecBench[id] = (consecBench[id] || 0) + 1;
				if (consecBench[id] >= 2) benchPen += penaltyWeights.CONSEC_SIT;
			} else {
				consecBench[id] = 0;
			}
		});

		round.matches.forEach(m => {
			const [a0, a1, b0, b1] = [...m.teamA, ...m.teamB];
			// Skill
			const sa = playerSkill(allPlayers, activePlayers, a0) + playerSkill(allPlayers, activePlayers, a1);
			const sb = playerSkill(allPlayers, activePlayers, b0) + playerSkill(allPlayers, activePlayers, b1);
			const diff = Math.abs(sa - sb);
			if      (diff === 1) skillPen += penaltyWeights.SKILL_1;
			else if (diff === 2) skillPen += penaltyWeights.SKILL_2;
			else if (diff >= 3)  skillPen += penaltyWeights.SKILL_3 + (diff - 3) * 4;
			// Same-team repeat
			stPen += getM(stMat, a0, a1) * penaltyWeights.SAME_TEAM;
			stPen += getM(stMat, b0, b1) * penaltyWeights.SAME_TEAM;
			// Opponent repeat
			oppPen += (getM(oppMat, a0, b0) + getM(oppMat, a0, b1) +
							getM(oppMat, a1, b0) + getM(oppMat, a1, b1)) * penaltyWeights.OPPONENT;
			// Now accumulate
			incM(stMat,  a0, a1); incM(stMat,  b0, b1);
			incM(oppMat, a0, b0); incM(oppMat, a0, b1);
			incM(oppMat, a1, b0); incM(oppMat, a1, b1);
		});
	});

	return { skill: skillPen, sameTeam: stPen, opponent: oppPen, bench: benchPen };
}

function penColor(val) {
	if (val === 0) return 'pen-green';
	if (val <= 10) return 'pen-yellow';
	return 'pen-red';
}

function renderScoreboard() {
	const p = computePenalties(schedule, allPlayers, activePlayers, PENALTY_WEIGHTS);
	const total = p.skill + p.sameTeam + p.opponent + p.bench;
	const rows = [
		['Skill imbalance',             p.skill],
		['Same-team repeats',           p.sameTeam],
		['Opponent repeats',            p.opponent],
		['Consecutive bench sits (≥2)', p.bench],
		['Total',                       total],
	];
	genScoreboard.innerHTML = '<h3 class="gen-section-heading">Tournament penalty score</h3>' +
		rows.map(([label, val]) =>
			`<div class="sb-row">
				 <span class="sb-label">${label}</span>
				 <span class="sb-val ${penColor(val)}">${val}</span>
			 </div>`
		).join('');
}

// ── Player stats ──────────────────────────────────────────────
function renderStatsTable() {
	if (!schedule) return;

	const stats = {};
	activePlayers.forEach(ap => {
		stats[ap.id] = { name: playerName(ap.id), skill: playerSkill(ap.id), playtime: ap.playtime, matches: 0, bench: 0, partners: new Set(), opponents: new Set() };
	});

	schedule.rounds.forEach(round => {
		round.matches.forEach(m => {
			[...m.teamA, ...m.teamB].forEach(id => {
				if (stats[id]) stats[id].matches++;
			});
			m.teamA.forEach(id => {
				m.teamA.forEach(pid => { if (pid !== id && stats[id]) stats[id].partners.add(pid); });
				m.teamB.forEach(pid => { if (stats[id]) stats[id].opponents.add(pid); });
			});
			m.teamB.forEach(id => {
				m.teamB.forEach(pid => { if (pid !== id && stats[id]) stats[id].partners.add(pid); });
				m.teamA.forEach(pid => { if (stats[id]) stats[id].opponents.add(pid); });
			});
		});
		(round.bench || []).forEach(id => { if (stats[id]) stats[id].bench++; });
	});

	const rows = Object.values(stats).sort((a, b) => a.name.localeCompare(b.name));

	genStatsTbody.innerHTML = getSorted(rows, 'stats').map(r => `<tr>
					<td>${r.name}</td>
					<td>` + renderSkillPillHtml(r.skill) + `</td>
					<td>${r.playtime}h</td>
					<td>${r.matches}</td>
					<td>${r.bench}</td>
					<td>${r.partners.size}</td>
					<td>${r.opponents.size}</td>
				</tr>`).join('')

	updateSortUI('stats');
}

// ── Persistence ───────────────────────────────────────────────
function loadGeneratedScheduleFromStorage() {
	try {
		const s = localStorage.getItem(SCHEDULE_KEY);
		const c = localStorage.getItem(SCORES_KEY);
		const d = localStorage.getItem(SCHEULE_DATE_KEY);
		if (s) schedule = JSON.parse(s);
		if (c) scores   = JSON.parse(c);
		if (d) scheduleDate = new Date(d);
	} catch (_) {}
	
	if (scheduleDate == null) scheduleDate = new Date();

	renderGeneratedSchedule();
}

function saveScores() {
	try {
		localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
	} catch (_) {}
}

function saveGeneratedScheduleToStorage() {
	try {
		localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
		localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
		localStorage.setItem(SCHEULE_DATE_KEY, scheduleDate.toISOString());
	} catch (_) {}
}


function clearGeneratedScheduleFromStorage() {
	schedule = null;
	scores   = {};
	scheduleDate = new Date();
	try {
		localStorage.removeItem(SCHEDULE_KEY);
		localStorage.removeItem(SCORES_KEY);
		localStorage.removeItem(SCHEULE_DATE_KEY);
	} catch (_) {}
	renderGeneratedSchedule();
}


// ── Drag & Drop ───────────────────────────────────────────────
let dragSrc = null; // { playerId, team, pos, matchId, roundId }

function attachDragHandlers() {
	genScheduleOut.querySelectorAll('.gen-player-slot').forEach(el => {
		el.addEventListener('dragstart', onDragStart);
		el.addEventListener('dragover',  onDragOver);
		el.addEventListener('dragleave', onDragLeave);
		el.addEventListener('drop',      onDrop);
		el.addEventListener('dragend',   onDragEnd);
	});
	// Bench slots also act as drop targets
	genScheduleOut.querySelectorAll('.gen-bench').forEach(el => {
		el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
		el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
		el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('drag-over'); onDropBench(e, el); });
	});
}

function onDragStart(e) {
	const el = e.currentTarget;
	dragSrc = {
		playerId:   Number(el.dataset.playerId),
		team:       el.dataset.team   || null,
		pos:        Number(el.dataset.pos),
		matchId:    el.dataset.matchId || null,
		bench:      el.dataset.bench === 'true',
		roundId:    el.dataset.roundId != null ? Number(el.dataset.roundId) : null,
	};
	el.classList.add('dragging');
	e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
	e.preventDefault();
	e.dataTransfer.dropEffect = 'move';
	e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
	e.preventDefault();
	e.dataTransfer.dropEffect = 'move';
	e.currentTarget.classList.remove('drag-over');
}
function onDragEnd(e) {
	e.currentTarget.classList.remove('dragging');
	genScheduleOut.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function onDrop(e) {
	e.preventDefault();
	if (!dragSrc) return;
	const el = e.currentTarget;
	const dst = {
		playerId:   Number(el.dataset.playerId),
		team:       el.dataset.team   || null,
		pos:        Number(el.dataset.pos),
		matchId:    el.dataset.matchId || null,
		bench:      el.dataset.bench === 'true',
		roundId:    el.dataset.roundId != null ? Number(el.dataset.roundId) : null,
	};
	if (!dragSrc.bench && !dst.bench &&
			dragSrc.matchId === dst.matchId && dragSrc.team === dst.team && dragSrc.pos === dst.pos) return;
	// Only allow moves within the same round
	if (dragSrc.roundId !== dst.roundId) return;

	swapPlayerOrBench(dragSrc, dst);
	saveGeneratedScheduleToStorage();
	renderSchedule();
	renderScoreboard();
	renderStatsTable();
	dragSrc = null;
}

// Drop onto the bench container (empty area between bench slots)
function onDropBench(e, benchEl) {
	if (!dragSrc) return;
	if (String(dragSrc.roundId) !== String(benchEl.dataset.roundId)) return;
	const roundId = Number(benchEl.dataset.roundId);
	// Find the round
	const round = schedule.rounds.find(r => r.roundId === roundId);
	if (!round) return;
	if (dragSrc.bench) return; // already on bench
	// Move playing player to bench; move first bench player to the vacated slot
	const srcMatch = findMatchInSchedule(dragSrc.roundId, dragSrc.matchId);
	if (!srcMatch) return;
	if (round.bench.length === 0) {
		// No bench player to swap with — just move to bench
		round.bench.push(dragSrc.playerId);
		srcMatch[dragSrc.team].splice(dragSrc.pos, 1, null);
		// Compact: remove nulls (match is now short — not ideal, but guard)
		srcMatch[dragSrc.team] = srcMatch[dragSrc.team].filter(x => x != null);
	} else {
		// Swap first bench player into the vacated slot
		const benchPid = round.bench[0];
		srcMatch[dragSrc.team][dragSrc.pos] = benchPid;
		round.bench[0] = dragSrc.playerId;
	}
	saveGeneratedScheduleToStorage();
	renderSchedule();
	renderScoreboard();
	renderStatsTable();
	dragSrc = null;
}

function findMatchInSchedule(roundId, matchId) {
	for (const round of schedule.rounds) {
		if (String(round.roundId) !== String(roundId)) continue;
		for (const match of round.matches) {
			if (match.matchId === matchId) return match;
		}
	}
	return null;
}

function swapPlayerOrBench(src, dst) {
	// Both in matches — simple team swap
	if (!src.bench && !dst.bench) {
		const srcMatch = findMatchInSchedule(src.roundId, src.matchId);
		const dstMatch = findMatchInSchedule(dst.roundId, dst.matchId);
		if (!srcMatch || !dstMatch) return;
		const tmp = srcMatch[src.team][src.pos];
		srcMatch[src.team][src.pos] = dstMatch[dst.team][dst.pos];
		dstMatch[dst.team][dst.pos] = tmp;
		return;
	}

	// Find relevant round (bench lives at round level)
	const roundId = src.bench ? src.roundId : dst.roundId;
	const round = schedule.rounds.find(r => r.roundId === roundId);
	if (!round) return;

	if (src.bench && !dst.bench) {
		// Bench -> Match slot
		const dstMatch = findMatchInSchedule(dst.roundId, dst.matchId);
		if (!dstMatch) return;
		const benchIdx = round.bench.indexOf(src.playerId);
		if (benchIdx === -1) return;
		const displaced = dstMatch[dst.team][dst.pos];
		dstMatch[dst.team][dst.pos] = src.playerId;
		round.bench[benchIdx] = displaced;
	} else if (!src.bench && dst.bench) {
		// Match slot -> Bench
		const srcMatch = findMatchInSchedule(src.roundId, src.matchId);
		if (!srcMatch) return;
		const benchIdx = round.bench.indexOf(dst.playerId);
		if (benchIdx === -1) return;
		const displaced = srcMatch[src.team][src.pos];
		srcMatch[src.team][src.pos] = dst.playerId;
		round.bench[benchIdx] = displaced;
	} else {
		// Bench <-> Bench swap (same round)
		const bi = round.bench.indexOf(src.playerId);
		const bj = round.bench.indexOf(dst.playerId);
		if (bi === -1 || bj === -1) return;
		[round.bench[bi], round.bench[bj]] = [round.bench[bj], round.bench[bi]];
	}
}

// ============================================================
// INIT — initial render on page load
// ============================================================
loadGeneratedScheduleFromStorage();
