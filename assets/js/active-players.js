// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

// ============================================================
// ACTIVE PLAYERS
// ============================================================
const ACTIVE_PLAYERS_KEY = "tournament-generator:activePlayers";
const ACTIVE_PLAYERS_NEXT_ID_KEY = "tournament-generator:activePlayersNextId";

let activePlayers = [];
let nextActivePlayerId = 1;

// DOM refs
const activePlayerSelect = document.getElementById("active-player-select");
const activeArrivalInput = document.getElementById("active-arrival");
const activePlaytimeInput = document.getElementById("active-playtime");
const activePlayerField = document.getElementById("active-player-field");
const activeArrivalField = document.getElementById("active-arrival-field");
const activePlaytimeField = document.getElementById("active-playtime-field");
const activePlayerTableBody = document.getElementById("active-player-table-body");
const activePlayersEmpty = document.getElementById("active-players-empty");
const activePlayerCount = document.getElementById("active-player-count");

function populateActivePlayerSelect() {
	const activeIds = new Set(activePlayers.map((ap) => ap.allPlayerId));
	const currentSel = new Set(Array.from(activePlayerSelect.selectedOptions).map((opt) => opt.value));

	activePlayerSelect.innerHTML = "";
	[...allPlayers]
		.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
		.forEach((p) => {
			if (activeIds.has(p.id)) return;
			const opt = document.createElement("option");
			opt.value = String(p.id);
			opt.textContent = p.name;
			if (currentSel.has(opt.value)) opt.selected = true;
			activePlayerSelect.appendChild(opt);
		});

	const optionCount = activePlayerSelect.options.length;
	activePlayerSelect.size = Math.max(2, Math.min(optionCount, 15));
}

function validateActivePlayerForm() {
	const playerOk = activePlayerSelect.selectedOptions.length > 0;
	const arrivalOk = activeArrivalInput.value !== "";
	const playtimeOk = activePlaytimeInput.value !== "" && Number(activePlaytimeInput.value) > 0;
	activePlayerField.classList.toggle("invalid", !playerOk);
	activeArrivalField.classList.toggle("invalid", !arrivalOk);
	activePlaytimeField.classList.toggle("invalid", !playtimeOk);
	return playerOk && arrivalOk && playtimeOk;
}

activePlayerSelect.addEventListener("change", () => {
	if (activePlayerField.classList.contains("invalid")) validateActivePlayerForm();
});
activeArrivalInput.addEventListener("change", () => {
	if (activeArrivalField.classList.contains("invalid")) validateActivePlayerForm();
});
activePlaytimeInput.addEventListener("input", () => {
	if (activePlaytimeField.classList.contains("invalid")) validateActivePlayerForm();
});

function renderActivePlayers() {
	activePlayerTableBody.innerHTML = "";

	const enriched = activePlayers.map((ap) => {
		const p = allPlayers.find((p) => p.id === ap.allPlayerId);
		return { ...ap, name: p ? p.name : "(removed)", skill: p ? p.skill : "0" };
	});

	getSorted(enriched, "active").forEach((p) => {
		const row = document.createElement("tr");
		row.dataset.id = p.id;
		row.innerHTML = `
			<td>${p.name}</td>
			<td>${renderSkillPillHtml(p.skill)}</td>
			<td>${p.arrival}</td>
			<td>${p.playtime}h</td>
			<td><input type="checkbox" class="sit-1st-round"${p.sit1stRound ? " checked" : ""}></td>
			<td><button type="button" class="remove-btn">Remove</button></td>`;
		activePlayerTableBody.appendChild(row);
	});

	activePlayerCount.textContent = `(${activePlayers.length})`;
	activePlayersEmpty.style.display = activePlayers.length === 0 ? "block" : "none";
	updateSortUI("active");
	populateActivePlayerSelect();
}

function loadActivePlayersFromStorage() {
	try {
		const saved = localStorage.getItem(ACTIVE_PLAYERS_KEY);
		const savedId = localStorage.getItem(ACTIVE_PLAYERS_NEXT_ID_KEY);
		if (saved) activePlayers = JSON.parse(saved);
		if (savedId) nextActivePlayerId = Number(savedId) || 1;
	} catch {
		activePlayers = [];
		nextActivePlayerId = 1;
	}
	renderActivePlayers();
}

function saveActivePlayersToStorage(render = true) {
	try {
		localStorage.setItem(ACTIVE_PLAYERS_KEY, JSON.stringify(activePlayers));
		localStorage.setItem(ACTIVE_PLAYERS_NEXT_ID_KEY, String(nextActivePlayerId));
	} catch {}

	if (render) renderActivePlayers();
}

function clearActivePlayersFromStorage() {
	activePlayers = [];
	nextActivePlayerId = 1;
	try {
		localStorage.removeItem(ACTIVE_PLAYERS_KEY);
		localStorage.removeItem(ACTIVE_PLAYERS_NEXT_ID_KEY);
	} catch {}
	renderActivePlayers();
}

function saveActivePlayersDataToStorage(data) {
	[ACTIVE_PLAYERS_KEY, ACTIVE_PLAYERS_NEXT_ID_KEY].forEach((key) => {
		if (key in data) {
			const value = data[key];
			const toStore = typeof value === "string" ? value : JSON.stringify(value);
			localStorage.setItem(key, toStore);
		}
	});
}

function getActivePlayersDataFromStorage() {
	const data = {};
	[ACTIVE_PLAYERS_KEY, ACTIVE_PLAYERS_NEXT_ID_KEY].forEach((key) => {
		const value = localStorage.getItem(key);
		if (value !== null) {
			data[key] = value;
		}
	});
	return data;
}

function addActivePlayer(allPlayerId, arrival, playtime) {
	activePlayers.push({
		id: nextActivePlayerId++,
		allPlayerId: Number(allPlayerId),
		arrival,
		playtime,
	});
	saveActivePlayersToStorage();
}

function removeActivePlayer(id) {
	if (ActivePlayerEvents.emit(ActivePlayerEvents.Type.MUST, id).some(Boolean)) {
		alertDialog(
			`Player '${activePlayerName(id)}' cannot be removed`,
			`Player is active in ${ActivePlayerEvents.description(ActivePlayerEvents.Type.MUST)}.`,
		);
		return;
	}
	activePlayers = activePlayers.filter((ap) => ap.id !== id);
	saveActivePlayersToStorage();
}

activePlayerTableBody.addEventListener("click", (e) => {
	const row = e.target.closest("tr");
	if (!row) return;

	const playerId = Number(row.dataset.id);

	// 1. Handle the Remove Button
	if (e.target.closest(".remove-btn")) {
		removeActivePlayer(playerId);
		return;
	}

	// 2. Handle a Checkbox click
	const checkbox = e.target.closest('input[type="checkbox"]');
	if (checkbox) {
		const isChecked = checkbox.checked; // true or false
		const player = activePlayers.find((p) => p.id === Number(playerId));
		player.sit1stRound = isChecked; // Update the property in the activePlayers array
		saveActivePlayersToStorage(false); // Save the updated array to localStorage
	}
});

document.getElementById("clear-active-players-btn").addEventListener("click", async () => {
	if (activePlayers.length === 0) return;
	const canClear = !activePlayers.map((ap) => ActivePlayerEvents.emit(ActivePlayerEvents.Type.MUST, ap.id).some(Boolean)).some(Boolean);
	if (!canClear) {
		alertDialog(
			"Cannot clear all active players",
			`Some players are currently active in ${ActivePlayerEvents.description(ActivePlayerEvents.Type.MUST)}.`,
		);
		return;
	}
	if (await confirmDialog("Remove all active players?")) {
		clearActivePlayersFromStorage();
	}
});

document.getElementById("active-player-form").addEventListener("submit", (e) => {
	e.preventDefault();
	if (!validateActivePlayerForm()) return;

	const selectedIds = Array.from(activePlayerSelect.selectedOptions).map((opt) => opt.value);
	selectedIds.forEach((id) => {
		addActivePlayer(id, activeArrivalInput.value, activePlaytimeInput.value);
	});

	document.getElementById("active-player-form").reset();
	[activePlayerField, activeArrivalField, activePlaytimeField].forEach((f) => {
		f.classList.remove("invalid");
	});
});

// ── Utility ───────────────────────────────────────────────────

function activePlayerAllId(activeId) {
	const ap = activePlayers.find((p) => p.id === activeId);
	return ap ? ap.allPlayerId : null;
}

function activePlayerName(activeId) {
	return playerName(activePlayerAllId(activeId) ?? null);
}

// biome-ignore lint/correctness/noUnusedVariables: function is used
function activePlayerSkill(activeId) {
	return playerSkill(activePlayerAllId(activeId) ?? null);
}

// biome-ignore lint/correctness/noUnusedVariables: function is used
function activePlayerGender(activeId) {
	return playerGender(activePlayerAllId(activeId) ?? null);
}

// biome-ignore lint/correctness/noUnusedVariables: function is used
function activePlayerIsWoman(activeId) {
	return playerIsWoman(activePlayerAllId(activeId) ?? null);
}

// ============================================================
// INIT — initial render on page load
// ============================================================
loadActivePlayersFromStorage();
populateActivePlayerSelect();
populateTimeSelect(activeArrivalInput);

const activePlayersDataDesc = "Active Players";

window.StorageEvents.on(StorageEvents.Type.LOAD, activePlayersDataDesc, (data) => {
	saveActivePlayersDataToStorage(data);
	loadActivePlayersFromStorage();
});

window.StorageEvents.on(StorageEvents.Type.SAVE, activePlayersDataDesc, () => {
	return getActivePlayersDataFromStorage();
});

window.StorageEvents.on(StorageEvents.Type.DEL_EVENT_DATA, activePlayersDataDesc, () => {
	clearActivePlayersFromStorage();
});

window.StorageEvents.on(StorageEvents.Type.HAS_EVENT_DATA, activePlayersDataDesc, () => {
	return activePlayers.length > 0;
});

window.PlayerEvents.on(PlayerEvents.Type.ADD, activePlayersDataDesc, () => {
	populateActivePlayerSelect();
});

window.PlayerEvents.on(PlayerEvents.Type.DEL, activePlayersDataDesc, (id) => {
	activePlayers = activePlayers.filter((ap) => ap.allPlayerId !== id);
	saveActivePlayersToStorage();
	populateActivePlayerSelect();
});

window.PlayerEvents.on(PlayerEvents.Type.HAS, activePlayersDataDesc, (id) => {
	return activePlayers.some((ap) => ap.allPlayerId === id);
});

window.PlayerEvents.on(PlayerEvents.Type.CLEAR, activePlayersDataDesc, () => {
	clearActivePlayersFromStorage();
	populateActivePlayerSelect();
});

window.PlayerEvents.on(PlayerEvents.Type.UPDATE, activePlayersDataDesc, () => {
	renderActivePlayers();
});
