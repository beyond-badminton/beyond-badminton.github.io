// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

const PLAYER_SLOT = Object.freeze({
	DRAGGABLE: 1, // Draggable player slot, displayed as a pill
	PILL: 2, // Non-draggable player slot, displayed as a pill
	CSV: 3, // Player slot represented in CSV format, no pill
});

function buildPlayerSlot(roundId, playerId, lastSlot, getPlayerData) {
	const { name, slotType, accent, drawnNumber, isWithdrawn } = getPlayerData(playerId);
	const slot = document.createElement("div");
	slot.className = "gen-player-slot";
	if (slotType !== PLAYER_SLOT.CSV) {
		slot.classList.add("gen-player-slot-pill");
	}
	if (slotType === PLAYER_SLOT.DRAGGABLE) {
		slot.classList.add("gen-player-slot-draggable");
		slot.draggable = true;
	}
	if (accent) {
		slot.classList.add("gen-player-slot-accent");
	}
	slot.dataset.roundId = roundId;
	slot.dataset.playerId = playerId;
	slot.innerHTML = name;

	if (drawnNumber !== null && drawnNumber !== undefined) {
		const badge = document.createElement("span");
		badge.className = "gen-drawn-number-badge";
		badge.textContent = drawnNumber;
		badge.title = "Drawn number";
		badge.setAttribute("aria-label", `Drawn number ${drawnNumber}`);
		slot.appendChild(badge);
	}

	if (isWithdrawn) {
		const badge = document.createElement("span");
		badge.className = "gen-withdrawn-badge";
		badge.textContent = "WD";
		badge.title = "Withdrawn";
		badge.setAttribute("aria-label", "Withdrawn");
		slot.appendChild(badge);
	}
	if (slotType === PLAYER_SLOT.CSV && !lastSlot) {
		const comma = document.createElement("span");
		comma.textContent = ", ";
		slot.appendChild(comma);
	}
	return slot;
}

function buildMatchCard(match, score, roundId, getPlayerData, disabledScore = false, readOnlyScore = false, scoreCap = null) {
	const card = document.createElement("div");
	card.className = "gen-match-card";
	card.dataset.matchId = match.matchId;

	const courtLabel = document.createElement("p");
	courtLabel.className = "gen-court-label";
	courtLabel.textContent = match.court;
	card.appendChild(courtLabel);

	["teamA", "teamB"].forEach((teamKey, ti) => {
		const teamEl = document.createElement("div");
		teamEl.className = `gen-team${ti === 1 ? " gen-team--right" : ""}`;
		teamEl.dataset.team = teamKey;
		teamEl.dataset.matchId = match.matchId;

		match[teamKey].forEach((pid, pi) => {
			const slot = buildPlayerSlot(roundId, pid, pi + 1 === match[teamKey].length, getPlayerData);
			slot.dataset.matchId = match.matchId;
			slot.dataset.team = teamKey;
			slot.dataset.pos = pi;
			teamEl.appendChild(slot);
		});

		card.appendChild(teamEl);

		// Score box between teams
		if (ti === 0) {
			const scoreRow = document.createElement("div");
			const hasScore = score.a !== null || score.b !== null;
			scoreRow.className = `gen-score-row${hasScore ? "" : " score-blank"}`;

			const winnerOrLoserAclass = score.a !== null && score.a > (score.b || 0) ? "winner" : "loser";
			const winnerOrLoserBclass = score.b !== null && score.b > (score.a || 0) ? "winner" : "loser";

			const inA = document.createElement("input");
			inA.type = "number";
			inA.min = "0";
			if (scoreCap !== null) {
				inA.max = String(scoreCap);
				inA.step = "1";
			}
			inA.placeholder = "0";
			inA.className = `gen-score-input ${winnerOrLoserAclass}`;
			inA.value = score.a !== null ? score.a : "";
			inA.dataset.matchId = match.matchId;
			inA.dataset.side = "a";
			inA.readOnly = readOnlyScore;

			const sep = document.createElement("span");
			sep.textContent = ":";
			sep.className = "gen-score-sep";

			const inB = document.createElement("input");
			inB.type = "number";
			inB.min = "0";
			if (scoreCap !== null) {
				inB.max = String(scoreCap);
				inB.step = "1";
			}
			inB.placeholder = "0";
			inB.className = `gen-score-input ${winnerOrLoserBclass}`;
			inB.value = score.b !== null ? score.b : "";
			inB.dataset.matchId = match.matchId;
			inB.dataset.side = "b";
			inB.readOnly = readOnlyScore;

			if (disabledScore) {
				inA.disabled = true;
				inB.disabled = true;
			}

			scoreRow.appendChild(inA);
			scoreRow.appendChild(sep);
			scoreRow.appendChild(inB);
			card.appendChild(scoreRow);
		}
	});

	return card;
}

function updateMatchScoreUI(score, matchCard) {
	const scoreRow = matchCard?.querySelector(".gen-score-row");
	if (!scoreRow) return;

	const winnerOrLoserAclass = score.a !== null && score.a > (score.b || 0) ? "winner" : "loser";
	const winnerOrLoserBclass = score.b !== null && score.b > (score.a || 0) ? "winner" : "loser";
	scoreRow.querySelectorAll(".gen-score-input").forEach((input) => {
		const side = input.dataset.side;
		input.value = score[side] ?? "";
		input.className = `gen-score-input ${side === "a" ? winnerOrLoserAclass : winnerOrLoserBclass}`;
	});
	scoreRow.classList.toggle("score-blank", score.a === null && score.b === null);
}

function openMatchScoreDialog({ match, score, roundId, getPlayerData, pointsToWin, scoreCap, onScore, onClose }) {
	const dialog = document.createElement("dialog");
	dialog.className = "confirm-modal score-entry-dialog";
	dialog.setAttribute("aria-labelledby", "score-entry-title");

	const heading = document.createElement("header");
	heading.className = "score-entry-heading";
	const context = document.createElement("p");
	context.className = "score-entry-context";
	context.textContent = `Round ${roundId + 1} · ${match.court}`;
	const title = document.createElement("h2");
	title.id = "score-entry-title";
	title.textContent = "Record match score";
	heading.append(context, title);
	dialog.appendChild(heading);

	if (score.a !== null || score.b !== null) {
		const currentScore = document.createElement("p");
		currentScore.className = "score-entry-current-score";
		currentScore.textContent = `Current score: ${score.a ?? 0} : ${score.b ?? 0}`;
		dialog.appendChild(currentScore);
	}

	const matchPreview = document.createElement("div");
	matchPreview.className = "score-entry-match";
	const winnerPrompt = document.createElement("h3");
	winnerPrompt.className = "score-entry-step-heading";
	winnerPrompt.textContent = "Select the team that won";
	matchPreview.appendChild(winnerPrompt);

	const winnerChoices = document.createElement("div");
	winnerChoices.className = "score-entry-winner-choices";
	const loserSection = document.createElement("section");
	loserSection.className = "score-entry-loser-section";
	const loserHeading = document.createElement("h3");
	loserHeading.textContent = "Losing team's score";
	const loserHelp = document.createElement("p");
	loserHelp.className = "score-entry-help";
	loserHelp.textContent = `Select only the losing team's points. The winner's score is calculated automatically using points to win (${pointsToWin}), win by two, and the score cap (${scoreCap}).`;
	const keypad = document.createElement("div");
	keypad.className = "score-entry-keypad";
	loserSection.append(loserHeading, loserHelp, keypad);

	const currentScoreA = score.a === null || score.a === undefined ? 0 : Number(score.a);
	const currentScoreB = score.b === null || score.b === undefined ? 0 : Number(score.b);
	const currentWinningScore = Math.max(currentScoreA, currentScoreB);
	const currentScoreDifference = Math.abs(currentScoreA - currentScoreB);
	const validCurrentScore =
		Number.isSafeInteger(currentScoreA) &&
		Number.isSafeInteger(currentScoreB) &&
		currentScoreA >= 0 &&
		currentScoreB >= 0 &&
		currentScoreA <= scoreCap &&
		currentScoreB <= scoreCap;
	const hasCurrentWinner =
		validCurrentScore &&
		currentScoreA !== currentScoreB &&
		currentWinningScore >= pointsToWin &&
		(currentScoreDifference >= 2 || currentWinningScore === scoreCap);
	let winningTeam = hasCurrentWinner ? (currentScoreA > currentScoreB ? "teamA" : "teamB") : null;
	const getExistingLoserScore = (team) => {
		const value = team === "teamA" ? score.b : score.a;
		const numericValue = value === null || value === undefined ? 0 : Number(value);
		return Number.isInteger(numericValue) && numericValue >= 0 && numericValue < scoreCap ? numericValue : null;
	};
	let selectedLoserScore = winningTeam ? getExistingLoserScore(winningTeam) : null;
	const scoreButtons = [];
	["teamA", "teamB"].forEach((team, index) => {
		const winnerButton = document.createElement("button");
		winnerButton.type = "button";
		winnerButton.className = "score-entry-team-choice";
		const isSelected = team === winningTeam;
		winnerButton.classList.toggle("selected", isSelected);
		winnerButton.setAttribute("aria-pressed", String(isSelected));
		const teamLabel = document.createElement("span");
		teamLabel.className = "score-entry-team-label";
		teamLabel.textContent = `Team ${index === 0 ? "A" : "B"}`;
		const teamPlayers = document.createElement("span");
		teamPlayers.className = "score-entry-team-players";
		teamPlayers.textContent = match[team].map((playerId) => getPlayerData(playerId).name).join(" + ");
		const actionLabel = document.createElement("span");
		actionLabel.className = "score-entry-team-action";
		actionLabel.textContent = isSelected ? "Selected winner" : "Select as winner";
		winnerButton.append(teamLabel, teamPlayers, actionLabel);
		winnerButton.addEventListener("click", () => {
			if (winningTeam !== team) selectedLoserScore = getExistingLoserScore(team);
			winningTeam = team;
			winnerChoices.querySelectorAll("button").forEach((button) => {
				const selected = button === winnerButton;
				button.classList.toggle("selected", selected);
				button.setAttribute("aria-pressed", String(selected));
				button.querySelector(".score-entry-team-action").textContent = selected ? "Selected winner" : "Select as winner";
			});
			scoreButtons.forEach((button) => {
				const selected = Number(button.dataset.loserScore) === selectedLoserScore;
				button.disabled = false;
				button.classList.toggle("selected", selected);
				button.setAttribute("aria-pressed", String(selected));
			});
		});
		winnerChoices.appendChild(winnerButton);
	});
	matchPreview.appendChild(winnerChoices);
	dialog.appendChild(matchPreview);
	dialog.appendChild(loserSection);

	for (let loserScore = 0; loserScore < scoreCap; loserScore += 1) {
		const scoreButton = document.createElement("button");
		scoreButton.type = "button";
		scoreButton.className = "score-entry-key";
		scoreButton.textContent = String(loserScore);
		scoreButton.dataset.loserScore = String(loserScore);
		scoreButton.disabled = winningTeam === null;
		scoreButton.classList.toggle("selected", loserScore === selectedLoserScore);
		scoreButton.setAttribute("aria-pressed", String(loserScore === selectedLoserScore));
		scoreButton.setAttribute("aria-label", `${loserScore} points for losing team`);
		scoreButton.addEventListener("click", () => {
			const winningScore = loserScore < pointsToWin - 1 ? pointsToWin : Math.min(scoreCap, loserScore + 2);
			const result = winningTeam === "teamA" ? { a: winningScore, b: loserScore } : { a: loserScore, b: winningScore };
			onScore(result);
			dialog.close();
		});
		keypad.appendChild(scoreButton);
		scoreButtons.push(scoreButton);
	}

	const actions = document.createElement("div");
	actions.className = "modal-actions";
	const cancelButton = document.createElement("button");
	cancelButton.type = "button";
	cancelButton.className = "discard-btn score-entry-cancel";
	cancelButton.textContent = "Cancel";
	cancelButton.addEventListener("click", () => dialog.close());
	actions.appendChild(cancelButton);
	dialog.appendChild(actions);
	dialog.addEventListener(
		"close",
		() => {
			dialog.remove();
			onClose?.();
		},
		{ once: true },
	);
	document.body.appendChild(dialog);
	dialog.showModal();
}

function getCourtLabelWidth(courtNames) {
	if (courtNames.length === 0) {
		return null;
	}

	const probe = document.createElement("p");
	probe.className = "gen-court-label";
	probe.style.position = "absolute";
	probe.style.visibility = "hidden";
	probe.style.width = "max-content";
	document.body.appendChild(probe);

	let widestLabel = 0;
	courtNames.forEach((courtName) => {
		probe.textContent = courtName;
		widestLabel = Math.max(widestLabel, probe.getBoundingClientRect().width);
	});
	probe.remove();

	const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
	return widestLabel > 0 && rootFontSize > 0 ? `${widestLabel / rootFontSize}rem` : null;
}

function createRoundBuilder({
	roundId,
	disabledScore = false,
	readOnlyScore = false,
	scoreCap = null,
	getPlayerData,
	getBenchPlayerData = getPlayerData,
	courtNames = [],
	bench = [],
}) {
	const roundEl = document.createElement("div");
	roundEl.className = "gen-round";
	roundEl.dataset.roundId = roundId;

	const roundHeader = document.createElement("div");
	roundHeader.className = "gen-round-header";
	const roundLabel = document.createElement("p");
	roundLabel.className = "gen-round-label";
	roundLabel.textContent = `Round ${roundId + 1}`;
	roundHeader.appendChild(roundLabel);
	roundEl.appendChild(roundHeader);

	const matchesRow = document.createElement("div");
	matchesRow.className = "gen-matches-row";
	const courtLabelWidth = getCourtLabelWidth(courtNames);
	if (courtLabelWidth) {
		matchesRow.style.setProperty("--court-label-width", courtLabelWidth);
	}
	roundEl.appendChild(matchesRow);

	return {
		addMatch(match, score, matchGetPlayerData = getPlayerData) {
			matchesRow.appendChild(buildMatchCard(match, score, roundId, matchGetPlayerData, disabledScore, readOnlyScore, scoreCap));
		},
		build() {
			const benchCard = buildBenchCard(bench, roundId, getBenchPlayerData);
			if (benchCard) {
				roundEl.appendChild(benchCard);
			}
			return roundEl;
		},
	};
}

function updateRoundBuilder(
	roundEl,
	{ disabledScore = false, readOnlyScore = false, getPlayerData, getBenchPlayerData = getPlayerData, courtNames = [], bench = [] },
) {
	const roundId = Number(roundEl.dataset.roundId);
	const roundLabel = roundEl.querySelector(".gen-round-label");
	if (roundLabel) {
		roundLabel.textContent = `Round ${roundId + 1}`;
	}

	const matchesRow = roundEl.querySelector(".gen-matches-row");
	if (matchesRow) {
		const courtLabelWidth = getCourtLabelWidth(courtNames);
		if (courtLabelWidth) {
			matchesRow.style.setProperty("--court-label-width", courtLabelWidth);
		} else {
			matchesRow.style.removeProperty("--court-label-width");
		}
	}

	roundEl.querySelectorAll(".gen-team").forEach((team) => {
		const slots = [...team.querySelectorAll(":scope > .gen-player-slot")];
		slots.forEach((slot, index) => {
			updatePlayerSlot(slot, getPlayerData, index === slots.length - 1, roundId);
		});
	});
	roundEl.querySelectorAll(".gen-score-input").forEach((input) => {
		input.disabled = disabledScore;
		input.readOnly = readOnlyScore;
	});

	const existingBench = roundEl.querySelector(":scope > .gen-bench");
	const existingBenchPlayers = existingBench ? [...existingBench.querySelectorAll(".bench-slot")].map((slot) => Number(slot.dataset.playerId)) : [];
	const sameBench =
		existingBenchPlayers.length === bench.length && existingBenchPlayers.every((playerId, index) => playerId === Number(bench[index]));

	if (bench.length === 0) {
		removeBenchCard(roundEl);
	} else if (sameBench) {
		const slots = [...existingBench.querySelectorAll(".bench-slot")];
		slots.forEach((slot, index) => {
			updatePlayerSlot(slot, getBenchPlayerData, index === slots.length - 1, roundId);
		});
	} else {
		removeBenchCard(roundEl);
		const benchCard = buildBenchCard(bench, roundId, getBenchPlayerData);
		if (benchCard) {
			roundEl.appendChild(benchCard);
		}
	}
}

function updatePlayerSlot(slot, getPlayerData, lastSlot, roundId) {
	const playerId = Number(slot.dataset.playerId);
	const replacement = buildPlayerSlot(roundId, playerId, lastSlot, getPlayerData);
	slot.dataset.roundId = roundId;
	slot.replaceChildren(...replacement.childNodes);
}

function buildBenchCard(bench, roundId, getPlayerData) {
	if (!bench || bench.length === 0) {
		return null;
	}
	const benchEl = document.createElement("div");
	benchEl.className = "gen-bench";
	benchEl.dataset.roundId = roundId;

	const bLabel = document.createElement("span");
	bLabel.className = "gen-bench-label";
	bLabel.textContent = "Bench:";
	benchEl.appendChild(bLabel);

	bench.forEach((pid, bi) => {
		const slot = buildPlayerSlot(roundId, pid, bi + 1 === bench.length, getPlayerData);
		slot.dataset.pos = bi;
		slot.dataset.bench = "true";
		slot.classList.add("bench-slot");
		benchEl.appendChild(slot);
	});

	return benchEl;
}

function removeBenchCard(roundEl) {
	const benchEl = roundEl.querySelector(".gen-bench");
	if (benchEl) {
		roundEl.removeChild(benchEl);
	}
}
