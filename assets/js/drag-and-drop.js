// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

// ── Drag & Drop ───────────────────────────────────────────────
let dragSrc = null; // { playerId, team, pos, matchId, roundId }

// onSwap func is called before actual swap occurs, it should return true if swap is allowed, false otherwise
// biome-ignore lint/correctness/noUnusedVariables: function is used
function attachDragHandlers(scheduleElement, onSwapFunc) {
	scheduleElement.querySelectorAll(".gen-player-slot-draggable").forEach((el) => {
		el.addEventListener("dragstart", onDragStart);
		el.addEventListener("dragover", onDragOver);
		el.addEventListener("dragleave", onDragLeave);
		el.addEventListener("dragend", (e) => onDragEnd(e, scheduleElement));
		el.addEventListener("drop", (e) => onDrop(e, onSwapFunc));
	});
}

function onDragStart(e) {
	const el = e.currentTarget;
	dragSrc = {
		playerId: Number(el.dataset.playerId),
		team: el.dataset.team || null,
		pos: Number(el.dataset.pos),
		matchId: el.dataset.matchId || null,
		bench: el.dataset.bench === "true",
		roundId: el.dataset.roundId != null ? Number(el.dataset.roundId) : null,
	};
	el.classList.add("dragging");
	e.dataTransfer.effectAllowed = "move";
}

function onDragOver(e) {
	e.preventDefault();
	e.dataTransfer.dropEffect = "move";
	e.currentTarget.classList.add("drag-over");
}

function onDragLeave(e) {
	e.preventDefault();
	e.dataTransfer.dropEffect = "move";
	e.currentTarget.classList.remove("drag-over");
}

function onDragEnd(e, scheduleElement) {
	e.currentTarget.classList.remove("dragging");
	scheduleElement.querySelectorAll(".drag-over").forEach((el) => {
		el.classList.remove("drag-over");
	});
}

function onDrop(e, onSwapFunc) {
	e.preventDefault();
	if (!dragSrc) return;
	const el = e.currentTarget;
	const dragDst = {
		playerId: Number(el.dataset.playerId),
		team: el.dataset.team || null,
		pos: Number(el.dataset.pos),
		matchId: el.dataset.matchId || null,
		bench: el.dataset.bench === "true",
		roundId: el.dataset.roundId != null ? Number(el.dataset.roundId) : null,
	};

	onSwapFunc(dragSrc, dragDst);

	dragSrc = null;
}
