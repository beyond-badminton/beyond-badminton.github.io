// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

const PLAYER_SLOT = Object.freeze({
	DRAGGABLE: 1, // Draggable player slot, displayed as a pill
	PILL: 2, // Non-draggable player slot, displayed as a pill
	CSV: 3, // Player slot represented in CSV format, no pill
});

function buildPlayerSlot(roundId, playerId, playerCard = PLAYER_SLOT.DRAGGABLE, lastSlot, buildPlayerSlotFunc, accentColor) {
	const slot = document.createElement("div");
	slot.className = "gen-player-slot";
	if (playerCard !== PLAYER_SLOT.CSV) {
		slot.classList.add("gen-player-slot-pill");
	}
	if (playerCard === PLAYER_SLOT.DRAGGABLE) {
		slot.classList.add("gen-player-slot-draggable");
		slot.draggable = true;
	}
	if (accentColor) {
		slot.classList.add("gen-player-slot-accent");
	}
	slot.dataset.roundId = roundId;
	slot.dataset.playerId = playerId;
	const playerSlot = buildPlayerSlotFunc(playerId);
	if (playerCard === PLAYER_SLOT.CSV) {
		slot.innerHTML = `${playerSlot}${!lastSlot ? " ," : ""}`;
	} else {
		slot.innerHTML = playerSlot;
	}
	return slot;
}

function buildMatchCard(
	match,
	score,
	roundId,
	playerCard = PLAYER_SLOT.DRAGGABLE,
	disabledScore = false,
	buildPlayerSlotFunc = buildPlayerSlotInnerHtml,
	accentColor = false,
) {
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
			const slot = buildPlayerSlot(roundId, pid, playerCard, pi + 1 === match[teamKey].length, buildPlayerSlotFunc, accentColor);
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

function buildBenchCard(bench, roundId, playerCard = PLAYER_SLOT.DRAGGABLE, buildPlayerSlotFunc = buildPlayerSlotInnerHtml, accentColor = false) {
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
		const slot = buildPlayerSlot(roundId, pid, playerCard, bi + 1 === bench.length, buildPlayerSlotFunc, accentColor);
		slot.dataset.pos = bi;
		slot.dataset.bench = "true";
		slot.classList.add("bench-slot");
		benchEl.appendChild(slot);
	});

	return benchEl;
}
