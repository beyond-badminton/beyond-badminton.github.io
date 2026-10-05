// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

// Render qualification rounds
//------------------------------------------------------------

const genQualificationOut = document.getElementById("gen-qualification-output");
const genQualificationRoundsCardLabel = document.getElementById("gen-qualification-rounds-card-label");
const genQualificationEditFilterWrap = document.getElementById("qualification-edit-filter-wrap");
const genQualificationEditFilterEditable = document.getElementById("qualification-edit-filter-editable");
const genQualificationEditFilterDrawNumbers = document.getElementById("qualification-edit-filter-draw-numbers");

function openQualificationScoreNumpad(scoreInput) {
	if (!tournamentConfig.useOnScreenNumpad || !tournamentConfig.qualificationStarted || tournamentConfig.qualificationFinished) return;

	const match = findQualificationMatch(scoreInput.dataset.matchId);
	const round = qualificationRounds.find((candidate) => candidate.matches.includes(match));
	if (!match || !round) return;

	openMatchScoreDialog({
		match,
		score: qualificationScores[match.matchId] || { a: null, b: null },
		roundId: round.roundId,
		getPlayerData: (playerId) => getTournamentPlayerData(playerId, PLAYER_SLOT.CSV),
		pointsToWin: tournamentConfig.pointsToWin,
		scoreCap: tournamentConfig.scoreCap,
		onScore: (score) =>
			document.dispatchEvent(
				// Custom event to request saving the score for the specified match, avoiding depencency on tournament.init.js
				new CustomEvent(QUALIFICATION_SCORE_SAVE_REQUEST_EVENT, {
					detail: { matchId: match.matchId, score },
				}),
			),
		onClose: () => {
			const currentScoreInput = [...genQualificationOut.querySelectorAll(".gen-score-input")].find(
				(input) => input.dataset.matchId === match.matchId && input.dataset.side === scoreInput.dataset.side,
			);
			currentScoreInput?.blur();
		},
	});
}

genQualificationOut.addEventListener("click", (event) => {
	if (!(event.target instanceof Element)) return;
	const scoreInput = event.target.closest(".gen-score-input");
	if (scoreInput) openQualificationScoreNumpad(scoreInput);
});

genQualificationOut.addEventListener("keydown", (event) => {
	if (!(event.target instanceof Element) || (event.key !== "Enter" && event.key !== " ")) return;
	const scoreInput = event.target.closest(".gen-score-input");
	if (!scoreInput || !tournamentConfig.useOnScreenNumpad || !tournamentConfig.qualificationStarted || tournamentConfig.qualificationFinished) {
		return;
	}
	event.preventDefault();
	openQualificationScoreNumpad(scoreInput);
});

function onQualificationMatchFilterChange(changeType) {
	if (changeType === "activeWindow") {
		if (updateQualificationRoundWindowChanged()) renderQualificationRounds();
		return;
	}
	if (changeType === "roundDisplay") {
		renderUpdateQualificationRounds();
		return;
	}
	if (tournamentConfig.qualificationStarted) renderQualificationRounds();
}

const qualificationMatchFilterElements = registerQualificationMatchFilter(
	genQualificationOut,
	"qualification-match-filter",
	onQualificationMatchFilterChange,
);
const qualificationMatchPlayerExcluded = qualificationMatchFilterElements.excluded;

document.addEventListener("keydown", (event) => {
	if (!event.altKey || event.ctrlKey || event.metaKey || (event.shiftKey && event.key.toLowerCase() !== "b")) return;

	const isLivePage = document.body.classList.contains("tournament-live-page");
	const tournamentSection = document.getElementById("tournament-section");
	if (!isLivePage && !tournamentSection?.classList.contains("active")) return;

	const shortcut = event.shiftKey ? `shift+${event.key.toLowerCase()}` : event.key.toLowerCase();
	const shortcuts = {
		a: qualificationMatchFilterElements.activeWindow,
		n: qualificationMatchFilterElements.drawnNumbers,
		b: qualificationMatchFilterElements.hideBenchFinished,
		"shift+b": qualificationMatchFilterElements.noBench,
	};
	const checkbox = shortcuts[shortcut];
	if (!checkbox) return;

	event.preventDefault();
	checkbox.click();
});

genQualificationEditFilterEditable?.addEventListener("change", renderQualificationRounds);
genQualificationEditFilterDrawNumbers?.addEventListener("change", renderQualificationRounds);

let roundWindowFilterStartId = null; // this point of the first shown index (like begin iterator)
let roundWindowFilterEndId = null; // this point past the last shown index (like end iterator)
let firstUnfinishedRoundId = null; // this point of the first unfinished round

let roundWindowOffset = 1;
let roundWindowSize = 4;

function getFirstUnfinishedQualificationRound() {
	return qualificationRounds.find((round) => round.matches.some((match) => !matchIsComplete(match)));
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
	let tmpFirstUnfinishedRoundId = null;

	if (tournamentConfig.qualificationStarted && qualificationMatchFilterElements.activeWindow.checked) {
		// note that roud id matches rounds array index, so we can use it directly
		const firstUnfinishedRound = getFirstUnfinishedQualificationRound();
		tmpFirstUnfinishedRoundId = firstUnfinishedRound?.roundId ?? null;

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

	if (
		tmpRoundWindowFilterStartId !== roundWindowFilterStartId ||
		tmpRoundWindowFilterEndId !== roundWindowFilterEndId ||
		tmpFirstUnfinishedRoundId !== firstUnfinishedRoundId
	) {
		return [tmpRoundWindowFilterStartId, tmpRoundWindowFilterEndId, tmpFirstUnfinishedRoundId];
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
	firstUnfinishedRoundId = changed[2];
	return true;
}

function tournamentPlayerName(playerId) {
	if (tournamentConfig.qualificationDrawConfirmed) {
		const player = tournamentPlayersMap.get(Number(playerId));
		return player?.name || "";
	}

	return String(playerId);
}

function getTournamentPlayerData(playerId, slotType, accent = false) {
	const showDrawnNumber =
		(tournamentConfig.qualificationStarted && qualificationMatchFilterElements.drawnNumbers.checked) ||
		(!tournamentConfig.qualificationStarted && genQualificationEditFilterDrawNumbers?.checked);
	const player = tournamentPlayersMap.get(Number(playerId));

	return {
		name: tournamentPlayerName(playerId),
		slotType,
		accent,
		drawnNumber: tournamentConfig.qualificationDrawConfirmed && showDrawnNumber ? String(player?.pick || 0) : null,
		isWithdrawn: tournamentConfig.qualificationDrawConfirmed && (player?.withdrawn ?? false),
	};
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

	qualificationMatchFilterElements.wrap.hidden = !tournamentConfig.qualificationStarted;
	if (genQualificationEditFilterWrap) {
		genQualificationEditFilterWrap.hidden = !manualEdit;
	}

	const filterEditableMatches = manualEdit && genQualificationEditFilterEditable?.checked;

	const blockEl = document.createElement("section");
	blockEl.className = "gen-block";

	const firstRoundIdToShowBench =
		tournamentConfig.qualificationStarted && qualificationMatchFilterElements.hideBenchFinished.checked
			? getFirstUnfinishedQualificationRound()?.roundId
			: 0;

	qualificationRounds.forEach((round) => {
		if (tournamentConfig.qualificationStarted && roundWindowFilterStartId !== null && roundWindowFilterEndId !== null) {
			if (round.roundId < roundWindowFilterStartId || round.roundId >= roundWindowFilterEndId) {
				return;
			}
		}
		const visibleMatches = round.matches.filter((match) => {
			// check if all players are excluded
			if (
				!manualEdit && // only apply exclusion filter when not in manual edit mode
				qualificationMatchPlayerExcluded.has(match.teamA[0]) &&
				qualificationMatchPlayerExcluded.has(match.teamA[1]) &&
				qualificationMatchPlayerExcluded.has(match.teamB[0]) &&
				qualificationMatchPlayerExcluded.has(match.teamB[1])
			) {
				return false;
			}

			if (filterEditableMatches && !match.editable) {
				// in manual edit, display only '2 Men vs 2 Women' matches that are object of manual editing
				return false;
			}
			return true;
		});

		if (visibleMatches.length === 0) {
			// filter applied
			return;
		}

		const showBench =
			!qualificationMatchFilterElements.noBench.checked && round.roundId >= firstRoundIdToShowBench && !(manualEdit && filterEditableMatches);
		const roundBuilder = createRoundBuilder({
			roundId: round.roundId,
			disabledScore: !tournamentConfig.qualificationStarted || tournamentConfig.qualificationFinished,
			readOnlyScore: tournamentConfig.useOnScreenNumpad && tournamentConfig.qualificationStarted && !tournamentConfig.qualificationFinished,
			scoreCap: tournamentConfig.scoreCap,
			getPlayerData: (playerId) => getTournamentPlayerData(playerId, PLAYER_SLOT.CSV),
			courtNames: visibleMatches.map((match) => match.court),
			bench: showBench ? round.bench : [],
		});

		visibleMatches.forEach((match) => {
			roundBuilder.addMatch(match, qualificationScores[match.matchId] || { a: null, b: null }, (playerId) =>
				getTournamentPlayerData(playerId, manualEdit && match.editable ? PLAYER_SLOT.DRAGGABLE : PLAYER_SLOT.CSV, manualEdit && match.editable),
			);
		});

		const roundEl = roundBuilder.build();
		const roundHeader = roundEl.querySelector(".gen-round-header");

		if (tournamentConfig.qualificationStarted && qualificationMatchFilterElements.activeWindow.checked) {
			const middle = document.createElement("div");
			middle.className = "middle";
			roundHeader.appendChild(middle);

			const timer = document.createElement("div");
			timer.className = "gen-round-window-timer hidden";
			middle.appendChild(timer);

			const cancel = document.createElement("button");
			cancel.className = "discard-btn right";
			cancel.innerText = "Cancel shifting (Esc)";
			cancel.hidden = true;
			cancel.disabled = true;
			cancel.addEventListener("click", () => cancelRoundWindowTimer());
			roundHeader.appendChild(cancel);

			const shiftNow = document.createElement("button");
			shiftNow.className = "discard-btn right gen-round-window-shift";
			shiftNow.innerText = "Shift now";
			shiftNow.hidden = true;
			shiftNow.disabled = true;
			shiftNow.addEventListener("click", commitRoundWindowShiftNow);
			roundHeader.appendChild(shiftNow);
		}
		blockEl.appendChild(roundEl);
	});

	genQualificationOut.innerHTML = "";
	genQualificationOut.appendChild(blockEl);
	refreshQualificationActiveRoundHighlight();

	attachDragHandlers(genQualificationOut, qualificationRoundPlayersSwap);
}

function renderUpdateQualificationRounds() {
	const manualEdit =
		tournamentConfig.qualificationDrawConfirmed && !tournamentConfig.qualificationStarted && tournamentConfig.twoMenVsTwoWomen === "manual";
	const filterEditableMatches = manualEdit && genQualificationEditFilterEditable?.checked;
	const firstRoundIdToShowBench =
		tournamentConfig.qualificationStarted && qualificationMatchFilterElements.hideBenchFinished.checked
			? getFirstUnfinishedQualificationRound()?.roundId
			: 0;

	qualificationRounds.forEach((round) => {
		const roundEl = genQualificationOut.querySelector(`.gen-round[data-round-id="${round.roundId}"]`);
		if (!roundEl) {
			return;
		}

		const showBench =
			!qualificationMatchFilterElements.noBench.checked && round.roundId >= firstRoundIdToShowBench && !(manualEdit && filterEditableMatches);
		const visibleMatches = round.matches.filter((match) => !(filterEditableMatches && !match.editable));

		updateRoundBuilder(roundEl, {
			disabledScore: !tournamentConfig.qualificationStarted || tournamentConfig.qualificationFinished,
			readOnlyScore: tournamentConfig.useOnScreenNumpad && tournamentConfig.qualificationStarted && !tournamentConfig.qualificationFinished,
			getPlayerData: (playerId) => {
				const match = visibleMatches.find((m) => m.teamA.includes(playerId) || m.teamB.includes(playerId));
				return getTournamentPlayerData(
					playerId,
					manualEdit && match?.editable ? PLAYER_SLOT.DRAGGABLE : PLAYER_SLOT.CSV,
					manualEdit && match?.editable,
				);
			},
			courtNames: visibleMatches.map((match) => match.court),
			bench: showBench ? round.bench : [],
		});
	});
}
//------------------------------------------------------------

let timeoutId = null;

function commitRoundWindowShiftNow() {
	if (timeoutId !== null) {
		clearTimeout(timeoutId);
		timeoutId = null;
	}
	updateQualificationRoundWindowChanged();
	renderQualificationRounds();
}

function cancelRoundWindowTimer(full = false) {
	if (timeoutId !== null) {
		clearTimeout(timeoutId);
		timeoutId = null;
	}

	genQualificationOut.querySelectorAll(".gen-round-window-timer").forEach((bar) => {
		bar.classList.remove("running");
		bar.classList.add("hidden");
	});

	genQualificationOut.querySelectorAll(`.gen-round-header .discard-btn${full ? "" : ":not(.gen-round-window-shift)"}`).forEach((button) => {
		button.hidden = true;
		button.disabled = true;
	});
}

genQualificationOut.addEventListener("focusout", (e) => {
	if (e.target.type !== "number" || (e.target.readOnly && document.querySelector(".score-entry-dialog[open]"))) {
		return;
	}

	if (qualificationRoundWindowHasChanged() === null) {
		return;
	}

	const round = e.target.closest(".gen-round");
	const roundHeader = round.querySelector(".gen-round-header");
	if (!roundHeader) return;

	const bar = roundHeader.querySelector(".gen-round-window-timer");
	bar?.classList.remove("hidden");
	bar?.classList.add("running");

	roundHeader.querySelectorAll(".discard-btn").forEach((button) => {
		button.hidden = false;
		button.disabled = false;
	});

	clearTimeout(timeoutId);

	timeoutId = setTimeout(commitRoundWindowShiftNow, 5000);
});

genQualificationOut.addEventListener("focusin", (event) => {
	if (event.target.type !== "number") {
		return;
	}

	cancelRoundWindowTimer(true);
});

//genQualificationOut.addEventListener("input", (event) => {
function roundRendererOnScoreChanged() {
	// const input = event.target.closest(".gen-score-input");
	// if (!input) return;

	if (!qualificationMatchFilterElements.activeWindow.checked) {
		if (qualificationMatchFilterElements.hideBenchFinished.checked) {
			renderUpdateQualificationRounds();
		}
		refreshQualificationActiveRoundHighlight();
	}
}
//});

function initQualificationRoundsRenderer({ offset = 1, size = 4, matchFilters = {} } = {}) {
	qualificationMatchFilterElements.initialize({ offset, size, matchFilters });
	roundWindowOffset = offset;
	roundWindowSize = size;
}

function resetQualificationRoundsRenderer() {
	resetRegisteredTableFitControls();
	qualificationMatchFilterElements.reset();
	if (genQualificationEditFilterEditable) {
		genQualificationEditFilterEditable.checked = false;
	}
	if (genQualificationEditFilterDrawNumbers) {
		genQualificationEditFilterDrawNumbers.checked = false;
	}

	roundWindowFilterStartId = null;
	roundWindowFilterEndId = null;
}
