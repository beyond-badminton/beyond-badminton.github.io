// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

// Render qualification rounds
//------------------------------------------------------------

const genQualificationOut = document.getElementById("gen-qualification-output");
const genQualificationRoundsCardLabel = document.getElementById("gen-qualification-rounds-card-label");
const genQualificationEditFilterWrap = document.getElementById("qualification-edit-filter-wrap");
const genQualificationEditFilterEditable = document.getElementById("qualification-edit-filter-editable");
const genQualificationEditFilterDrawNumbers = document.getElementById("qualification-edit-filter-draw-numbers");
const genQualificationMatchFilterWrap = document.getElementById("qualification-match-filter-wrap");
const genQualificationMatchFilterLabel = document.getElementById("qualification-match-filter-label");
const genQualificationMatchFilterList = document.getElementById("qualification-match-player-filter");
const genQualificationMatchFilterCount = document.getElementById("qualification-match-filter-count");
const genQualificationMatchFilterSearch = document.getElementById("qualification-match-filter-search");
const genQualificationMatchFilterAllBtn = document.getElementById("qualification-match-filter-all-btn");
const genQualificationMatchFilterNoneBtn = document.getElementById("qualification-match-filter-none-btn");
const genQualificationMatchFilterActiveWindow = document.getElementById("qualification-match-filter-active-window");
const genQualificationMatchFilterActiveWindowLabel = document.getElementById("qualification-match-filter-active-window-label");
const genQualificationMatchFilterActiveWindowHint = genQualificationMatchFilterActiveWindow.closest(".checkbox-group").querySelector(".help-icon");
const genQualificationMatchFilterNoBench = document.getElementById("qualification-match-filter-no-bench");
const genQualificationMatchFilterDrawnNumbers = document.getElementById("qualification-match-filter-drawn-numbers");

// Player ids hidden from the P2P stats table (session-only, not persisted).
const qualificationMatchPlayerExcluded = new Set();

function renderQualificationMatchFilter() {
	renderQualificationCheckboxFilter(genQualificationMatchFilterList, qualificationMatchPlayerExcluded, tournamentPlayers);
	renderQualificationFilterLabel(
		genQualificationMatchFilterLabel,
		genQualificationMatchFilterCount,
		qualificationMatchPlayerExcluded,
		tournamentPlayers,
		genQualificationMatchFilterActiveWindow.checked || genQualificationMatchFilterDrawnNumbers.checked || genQualificationMatchFilterNoBench.checked,
	);
	applyQualificationMatchFilterSearch();
}

function applyQualificationMatchFilterSearch() {
	const term = genQualificationMatchFilterSearch.value.trim().toLowerCase();
	genQualificationMatchFilterList.querySelectorAll(".checkbox-pill").forEach((label) => {
		label.classList.toggle("filter-hidden", term !== "" && !label.dataset.name.includes(term));
	});
}

genQualificationEditFilterEditable.addEventListener("change", renderQualificationRounds);
genQualificationEditFilterDrawNumbers.addEventListener("change", renderQualificationRounds);

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

	renderQualificationFilterLabel(
		genQualificationMatchFilterLabel,
		genQualificationMatchFilterCount,
		qualificationMatchPlayerExcluded,
		tournamentPlayers,
		genQualificationMatchFilterActiveWindow.checked || genQualificationMatchFilterDrawnNumbers.checked || genQualificationMatchFilterNoBench.checked,
	);

	if (tournamentConfig.qualificationStarted) {
		renderQualificationRounds();
	}
});

let roundWindowFilterStartId = null; // this point of the first shown index (like begin iterator)
let roundWindowFilterEndId = null; // this point past the last shown index (like end iterator)

let roundWindowOffset = 1;
let roundWindowSize = 4;

function getFirstUnfinishedQualificationRound() {
	return qualificationRounds.find((round) =>
		round.matches.some((match) => {
			const scores = qualificationScores[match.matchId] || { a: null, b: null };
			return (scores.a || 0) === (scores.b || 0);
		}),
	);
}

function refreshQualificationActiveRoundHighlight() {
	const activeRoundId = tournamentConfig.qualificationStarted ? getFirstUnfinishedQualificationRound()?.roundId : null;
	genQualificationOut.querySelectorAll(".gen-round").forEach((roundElement) => {
		roundElement.classList.toggle("gen-round-active", Number(roundElement.dataset.roundId) === activeRoundId);
	});
}

function qualificationRoundWindowHasChanged() {
	let tmpRoundWindowFilterStartId = null;
	let tmpRoundWindowFilterEndId = null;

	if (tournamentConfig.qualificationStarted && genQualificationMatchFilterActiveWindow.checked) {
		// note that roud id matches rounds array index, so we can use it directly
		const firstUnfinishedRound = getFirstUnfinishedQualificationRound();

		if (firstUnfinishedRound) {
			tmpRoundWindowFilterStartId = Math.max(0, firstUnfinishedRound.roundId - roundWindowOffset);
			tmpRoundWindowFilterEndId = Math.min(qualificationRounds.length, tmpRoundWindowFilterStartId + roundWindowSize);
		} else {
			// if all matches are played, show the last 4 rounds
			tmpRoundWindowFilterStartId = qualificationRounds.length - Math.min(qualificationRounds.length, roundWindowSize);
			tmpRoundWindowFilterEndId = qualificationRounds.length;
		}

		if (tmpRoundWindowFilterEndId - tmpRoundWindowFilterStartId < roundWindowSize) {
			tmpRoundWindowFilterStartId = Math.max(0, tmpRoundWindowFilterEndId - roundWindowSize);
		}
	}

	if (tmpRoundWindowFilterStartId !== roundWindowFilterStartId || tmpRoundWindowFilterEndId !== roundWindowFilterEndId) {
		return [tmpRoundWindowFilterStartId, tmpRoundWindowFilterEndId];
	}

	return null;
}

function updateQualificationRoundWindowChanged() {
	const changed = qualificationRoundWindowHasChanged();
	if (!changed) {
		return false;
	}

	roundWindowFilterStartId = changed[0];
	roundWindowFilterEndId = changed[1];

	return true;
}

genQualificationMatchFilterActiveWindow.addEventListener("change", () => {
	renderQualificationFilterLabel(
		genQualificationMatchFilterLabel,
		genQualificationMatchFilterCount,
		qualificationMatchPlayerExcluded,
		tournamentPlayers,
		genQualificationMatchFilterActiveWindow.checked || genQualificationMatchFilterDrawnNumbers.checked || genQualificationMatchFilterNoBench.checked,
	);

	if (updateQualificationRoundWindowChanged()) {
		renderQualificationRounds();
	}
});

genQualificationMatchFilterDrawnNumbers.addEventListener("change", () => {
	renderQualificationFilterLabel(
		genQualificationMatchFilterLabel,
		genQualificationMatchFilterCount,
		qualificationMatchPlayerExcluded,
		tournamentPlayers,
		genQualificationMatchFilterActiveWindow.checked || genQualificationMatchFilterDrawnNumbers.checked || genQualificationMatchFilterNoBench.checked,
	);

	renderQualificationRounds();
});

genQualificationMatchFilterNoBench.addEventListener("change", () => {
	renderQualificationFilterLabel(
		genQualificationMatchFilterLabel,
		genQualificationMatchFilterCount,
		qualificationMatchPlayerExcluded,
		tournamentPlayers,
		genQualificationMatchFilterActiveWindow.checked || genQualificationMatchFilterDrawnNumbers.checked || genQualificationMatchFilterNoBench.checked,
	);

	renderQualificationRounds();
});

function tournamentPlayerName(playerId) {
	if (tournamentConfig.qualificationDrawConfirmed) {
		const player = tournamentPlayersMap.get(Number(playerId));
		if (player?.withdrawn || false) {
			return `(Withdrawn) ${player?.name || ""}`;
		} else if (
			(tournamentConfig.qualificationStarted && genQualificationMatchFilterDrawnNumbers.checked) ||
			(tournamentConfig.qualificationDrawConfirmed && !tournamentConfig.qualificationStarted && genQualificationEditFilterDrawNumbers.checked)
		) {
			return `(${player?.pick || 0}) ${player?.name || ""}`;
		}
		return player?.name || "";
	}

	return String(playerId);
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
	const manualEdit =
		tournamentConfig.qualificationDrawConfirmed && !tournamentConfig.qualificationStarted && tournamentConfig.twoMenVsTwoWomen === "manual";

	if (genQualificationRoundsCardLabel) {
		genQualificationRoundsCardLabel.textContent = `Qualification rounds ${manualEdit ? " (Edit Mode)" : ""}`;
	}

	genQualificationMatchFilterWrap.style.display = tournamentConfig.qualificationStarted ? "block" : "none";
	genQualificationEditFilterWrap.style.display = manualEdit ? "block" : "none";

	const filterEditableMatches = manualEdit && genQualificationEditFilterEditable.checked;

	const blockEl = document.createElement("section");
	blockEl.className = "gen-block";

	//console.log("Rendering qualification rounds:", tournamentConfig);
	qualificationRounds.forEach((round) => {
		if (tournamentConfig.qualificationStarted && roundWindowFilterStartId !== null && roundWindowFilterEndId !== null) {
			if (round.roundId < roundWindowFilterStartId || round.roundId >= roundWindowFilterEndId) {
				return;
			}
		}
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

		const roundHeader = document.createElement("div");
		roundHeader.className = "gen-round-header";
		roundEl.appendChild(roundHeader);

		const rLabel = document.createElement("p");
		rLabel.className = "gen-round-label left";
		rLabel.innerHTML = `Round ${round.roundId + 1}`;
		roundHeader.appendChild(rLabel);

		if (tournamentConfig.qualificationStarted && genQualificationMatchFilterActiveWindow.checked) {
			const middle = document.createElement("div");
			middle.className = "middle";
			roundHeader.appendChild(middle);

			const timer = document.createElement("div");
			timer.className = "gen-round-window-timer hidden";
			middle.appendChild(timer);

			const cancel = document.createElement("button");
			cancel.className = "discard-btn right";
			cancel.innerText = "Cancel shifting";
			cancel.hidden = true;
			cancel.disabled = true;
			cancel.addEventListener("click", cancelRoundWindowTimer);
			roundHeader.appendChild(cancel);
		}
		roundEl.appendChild(matchesRow);

		const showBench = !genQualificationMatchFilterNoBench.checked && !(manualEdit && filterEditableMatches);

		if (showBench && round.bench && round.bench.length > 0) {
			roundEl.appendChild(buildBenchCard(round.bench, round.roundId, PLAYER_SLOT.CSV, tournamentPlayerName));
		}

		blockEl.appendChild(roundEl);
	});

	genQualificationOut.innerHTML = "";
	genQualificationOut.appendChild(blockEl);
	refreshQualificationActiveRoundHighlight();

	attachDragHandlers(genQualificationOut, qualificationRoundPlayersSwap);
}

//------------------------------------------------------------

let timeoutId = null;

genQualificationOut.addEventListener("focusout", (e) => {
	if (e.target.type !== "number") {
		return;
	}

	if (qualificationRoundWindowHasChanged() === null) {
		return;
	}

	timeoutId = setTimeout(() => {
		if (updateQualificationRoundWindowChanged()) {
			renderQualificationRounds();
		}
		timeoutId = null;
	}, 5000);

	const roundHeader = e.target.closest(".gen-round").querySelector(".gen-round-header");
	if (!roundHeader) return;

	const bar = roundHeader.querySelector(".gen-round-window-timer");
	if (!bar) return;

	bar.classList.remove("hidden", "running");
	// Trigger reflow to restart CSS transition
	//void bar.offsetWidth;
	bar.classList.add("running");
	const cancelBtn = roundHeader.querySelector(".discard-btn[hidden]");
	if (!cancelBtn) return;
	cancelBtn.hidden = false;
	cancelBtn.disabled = false;
});

function cancelRoundWindowTimer(e) {
	if (timeoutId !== null) {
		clearTimeout(timeoutId);
		timeoutId = null;
		const broundsBlock = e.target.closest(".gen-block");
		if (!broundsBlock) return;

		const bar = broundsBlock.querySelector(".gen-round-window-timer.running");
		if (!bar) return;

		bar.classList.remove("running");
		// Trigger reflow to restart CSS transition
		//void bar.offsetWidth;
		bar.classList.add("hidden");
		const cancelBtn = bar.closest(".gen-round-header").querySelector(".discard-btn");
		cancelBtn.hidden = true;
		cancelBtn.disabled = true;

		// const bar = genQualificationOut.querySelector('.gen-round-window-timer');
		// bar.classList.remove('running', 'hidden');
		// bar.classList.add('hidden');
	}
}

genQualificationOut.addEventListener("focusin", cancelRoundWindowTimer);

function initQualificationRoundsRenderer({ offset = 1, size = 4, matchFilters = {} } = {}) {
	if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(size) || size < 1 || offset >= size) {
		throw new RangeError("The active round window requires an offset >= 0 and a size greater than the offset.");
	}

	roundWindowOffset = offset;
	roundWindowSize = size;
	genQualificationMatchFilterActiveWindow.checked = matchFilters.activeWindow ?? genQualificationMatchFilterActiveWindow.checked;
	genQualificationMatchFilterDrawnNumbers.checked = matchFilters.drawnNumbers ?? genQualificationMatchFilterDrawnNumbers.checked;
	genQualificationMatchFilterNoBench.checked = matchFilters.noBench ?? genQualificationMatchFilterNoBench.checked;
	genQualificationMatchFilterActiveWindowLabel.textContent = `Show active ${size}-round window`;

	const previousRounds = offset === 1 ? "the last finished round" : `the last ${offset} finished rounds`;
	const nextRoundCount = size - offset - 1;
	const nextRounds = nextRoundCount === 1 ? "the next round" : `the next ${nextRoundCount} rounds`;
	const windowDescription = [offset > 0 ? previousRounds : null, "the current round", nextRoundCount > 0 ? nextRounds : null]
		.filter(Boolean)
		.join(", ");

	genQualificationMatchFilterActiveWindowHint.title = `Shows ${windowDescription}. Active window is shifted 5 seconds after all score inputs lose focus. Keyboard shortcut: Alt + A.`;
}

function resetQualificationRoundsRenderer() {
	resetRegisteredTableFitControls();
	genQualificationEditFilterEditable.checked = true;
	genQualificationEditFilterDrawNumbers.checked = false;
	genQualificationMatchFilterActiveWindow.checked = false;
	genQualificationMatchFilterDrawnNumbers.checked = false;
	genQualificationMatchFilterNoBench.checked = false;
	qualificationMatchPlayerExcluded.clear();
	roundWindowFilterStartId = null;
	roundWindowFilterEndId = null;
}
