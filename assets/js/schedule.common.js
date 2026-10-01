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

function buildMatchCard(match, score, roundId, getPlayerData, disabledScore = false, scoreCap = null) {
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
			matchesRow.appendChild(buildMatchCard(match, score, roundId, matchGetPlayerData, disabledScore, scoreCap));
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

function updateRoundBuilder(roundEl, { disabledScore = false, getPlayerData, getBenchPlayerData = getPlayerData, courtNames = [], bench = [] }) {
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
