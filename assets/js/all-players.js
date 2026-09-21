// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

// ============================================================
// ALL PLAYERS
// ============================================================
const ALL_PLAYERS_KEY = "tournament-generator:allPlayers";
const ALL_PLAYERS_NEXT_ID_KEY = "tournament-generator:allPlayersNextId";

const GENDER_LABELS = {
	m: "Man",
	w: "Woman",
	x: "N/A",
};

const SKILL_LABELS = {
	1: "Beginner",
	2: "Intermediate",
	3: "Advanced",
	4: "Skilled",
};

let allPlayers = [];
let nextAllPlayerId = 1;

function genderLabel(gender) {
	return GENDER_LABELS[gender] || "N/A";
}

function skillLabel(skillId) {
	return SKILL_LABELS[skillId] || String(skillId) || "Unknown";
}

// DOM refs
const allPlayerForm = document.getElementById("all-player-form");
const apNameInput = document.getElementById("ap-name");
const apSkillInput = document.getElementById("ap-skill");
const apgenderInput = document.getElementById("ap-gender");
const apNameField = document.getElementById("ap-name-field");
const allPlayerTableBody = document.getElementById("all-player-table-body");
const allPlayersEmpty = document.getElementById("all-players-empty");
const allPlayerCount = document.getElementById("all-player-count");
const csvSkillCodes = document.getElementById("csv-skill-codes");

function renderGenderPillHtml(genderId, clickable = false) {
	return `<span class="gender-pill gender-${genderId || "x"} ${clickable ? "gender-pick" : ""}">${genderLabel(genderId)}</span>`;
}

function updateGenderPillElement(element, genderId, clickable = false) {
	element.className = `gender-pill gender-${genderId || "x"} ${clickable ? "gender-pick" : ""}`;
	element.textContent = genderLabel(genderId);
}

function renderSkillPillHtml(skillId, clickable = false) {
	return `<span class="skill-pill skill-${skillId} ${clickable ? "skill-pick" : ""}">${skillLabel(skillId)}</span>`;
}

function updateSkillPillElement(element, skillId, clickable = false) {
	element.className = `skill-pill skill-${skillId} ${clickable ? "skill-pick" : ""}`;
	element.textContent = skillLabel(skillId);
}

function populateAppSkillOptions() {
	const skillLabelsHtml = Object.entries(SKILL_LABELS)
		.map(([skillId, skillName]) => `<code>${skillId}</code> (${skillName})`)
		.join(", ");
	csvSkillCodes.innerHTML = `<code>skill</code> — ${skillLabelsHtml}`;
	Object.entries(SKILL_LABELS).forEach(([skillId, skillName]) => {
		const opt = document.createElement("option");
		opt.value = skillId;
		opt.textContent = `${skillId} — ${skillName}`;
		apSkillInput.appendChild(opt);
	});
}
function validateAllPlayerForm() {
	const ok = apNameInput.value.trim().length > 0;
	apNameField.classList.toggle("invalid", !ok);
	return ok;
}

apNameInput.addEventListener("input", () => {
	if (apNameField.classList.contains("invalid")) validateAllPlayerForm();
});

function renderAllPlayers() {
	allPlayerTableBody.innerHTML = "";

	getSorted(allPlayers, "all").forEach((p) => {
		const row = document.createElement("tr");
		row.innerHTML = `
		<td>${p.name}</td>
		<td>${renderGenderPillHtml(p.gender, true)}</td>
		<td>${renderSkillPillHtml(p.skill, true)}</td>
		<td><button type="button" class="remove-btn" data-id="${p.id}">Remove</button></td>`;
		allPlayerTableBody.appendChild(row);
	});

	allPlayerCount.textContent = `(${allPlayers.length})`;
	allPlayersEmpty.style.display = allPlayers.length === 0 ? "block" : "none";
	updateSortUI("all");
}

function addAllPlayer(name, skill, gender) {
	if (allPlayers.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
		return `Player "${name}" already exists.`;
	}
	const playerId = nextAllPlayerId++;
	allPlayers.push({
		id: playerId,
		name,
		skill,
		gender: gender || "x",
	});
	saveAllPlayersToStorage();
	PlayerEvents.emit(PlayerEvents.Type.ADD, playerId);
	return null;
}

async function removeAllPlayer(id) {
	const mustBeActive = PlayerEvents.emit(PlayerEvents.Type.MUST, id).some(Boolean);

	if (mustBeActive) {
		alertDialog(`Player "${playerName(id)}" cannot be removed`, `Player is currently active in ${PlayerEvents.description(PlayerEvents.Type.MUST)}.`);
		return;
	}

	const isActive = PlayerEvents.emit(PlayerEvents.Type.HAS, id).some(Boolean);
	if (
		isActive &&
		!(await confirmDialog(
			`Player "${playerName(id)}" is currently active`,
			`Removing them will also remove them from ${PlayerEvents.description(PlayerEvents.Type.HAS)}. Proceed?`,
		))
	) {
		return;
	}

	allPlayers = allPlayers.filter((p) => p.id !== id);
	saveAllPlayersToStorage();
	PlayerEvents.emit(PlayerEvents.Type.DEL, id);
}

function loadAllPlayersFromStorage() {
	try {
		const saved = localStorage.getItem(ALL_PLAYERS_KEY);
		const savedId = localStorage.getItem(ALL_PLAYERS_NEXT_ID_KEY);
		if (saved) allPlayers = JSON.parse(saved);
		if (savedId) nextAllPlayerId = Number(savedId) || 1;
	} catch {
		allPlayers = [];
		nextAllPlayerId = 1;
	}
	renderAllPlayers();
}

function saveAllPlayersToStorage(render = true) {
	try {
		localStorage.setItem(ALL_PLAYERS_KEY, JSON.stringify(allPlayers));
		localStorage.setItem(ALL_PLAYERS_NEXT_ID_KEY, String(nextAllPlayerId));
	} catch {}

	if (render) renderAllPlayers();
}

function saveAllPlayersDataToStorage(data) {
	[ALL_PLAYERS_KEY, ALL_PLAYERS_NEXT_ID_KEY].forEach((key) => {
		if (key in data) {
			const value = data[key];
			const toStore = typeof value === "string" ? value : JSON.stringify(value);
			localStorage.setItem(key, toStore);
		}
	});
}

function getAllPlayersDataFromStorage() {
	const data = {};
	[ALL_PLAYERS_KEY, ALL_PLAYERS_NEXT_ID_KEY].forEach((key) => {
		const value = localStorage.getItem(key);
		if (value !== null) {
			data[key] = value;
		}
	});
	return data;
}

function clearAllPlayersFromStorage() {
	allPlayers = [];
	nextAllPlayerId = 1;
	try {
		localStorage.removeItem(ALL_PLAYERS_KEY);
		localStorage.removeItem(ALL_PLAYERS_NEXT_ID_KEY);
	} catch {}
	renderAllPlayers();
	PlayerEvents.emit(PlayerEvents.Type.CLEAR);
}

allPlayerTableBody.addEventListener("click", (e) => {
	const btn = e.target.closest(".remove-btn");
	if (btn) removeAllPlayer(Number(btn.dataset.id));
});

document.getElementById("clear-all-players-btn").addEventListener("click", async () => {
	if (allPlayers.length === 0) return;

	const canClear = !allPlayers.map((ap) => PlayerEvents.emit(PlayerEvents.Type.MUST, ap.id).some(Boolean)).some(Boolean);
	if (!canClear) {
		alertDialog("Cannot clear all players", `Some players are currently active in ${PlayerEvents.description(PlayerEvents.Type.MUST)}.`);
		return;
	}
	if (await confirmDialog("Remove all players?", "This will also clear active players.")) {
		PlayerEvents.emit(PlayerEvents.Type.CLEAR);
		clearAllPlayersFromStorage();
	}
});

allPlayerForm.addEventListener("submit", (e) => {
	e.preventDefault();
	if (!validateAllPlayerForm()) return;
	const error = addAllPlayer(apNameInput.value.trim(), apSkillInput.value, apgenderInput.value);
	if (error) {
		alertDialog("Failed to add a player", error);
		return;
	}
	allPlayerForm.reset();
	apNameField.classList.remove("invalid");
});

// ---- CSV Import ----
const allPlayersCsvInput = document.getElementById("all-players-csv-input");
const allPlayersImportResult = document.getElementById("all-players-import-result");

allPlayersCsvInput.addEventListener("change", () => {
	const file = allPlayersCsvInput.files[0];
	if (!file) return;
	const reader = new FileReader();
	reader.onload = () => {
		const lines = reader.result
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter((l) => l.length > 0);
		if (lines.length === 0) {
			allPlayersImportResult.innerHTML = '<span class="summary">The file is empty.</span>';
			allPlayersImportResult.className = "import-result error";
			return;
		}
		const requiredHeaders = ["name", "skill", "gender"];
		const fileHeaders = lines[0].split(",").map((c) => c.trim().toLowerCase());
		const headersIndexes = requiredHeaders.map((header) => fileHeaders.indexOf(header));

		const rows = lines.slice(1);
		let added = 0;
		const errors = [];
		const skillNumbers = Object.keys(SKILL_LABELS);
		rows.forEach((line, i) => {
			const values = line.split(",");
			const [name, skill, gender] = headersIndexes.map((i) => values[i]?.trim() || "");
			if (!name) {
				errors.push(`Row ${i + 2}: missing name`);
				return;
			}

			if (!skillNumbers.includes(skill)) {
				errors.push(`Row ${i + 2}: Skill must be one of ${skillNumbers.join(", ")}`);
				return;
			}

			// gender is optional, can be missing, we accept undefined value which defaults to "X" (N/A)
			if (gender && !Object.keys(GENDER_LABELS).includes(gender.toLowerCase())) {
				errors.push(
					`Row ${i + 2}: Gender must be empty or one of ${Object.entries(GENDER_LABELS)
						.map(([key, value]) => `'${key}' (${value})`)
						.join(", ")}`,
				);
				return;
			}

			const error = addAllPlayer(name, skill, gender?.toLowerCase());
			if (error) {
				errors.push(`Row ${i + 2}: ${error}`);
				return;
			}
			added++;
		});
		const summary = `Imported ${added} player${added === 1 ? "" : "s"}.${errors.length ? ` Skipped ${errors.length} row${errors.length === 1 ? "" : "s"}:` : ""}`;
		if (errors.length) {
			allPlayersImportResult.innerHTML = `<span class="summary">${summary}</span><ul class="import-errors">${errors.map((e) => `<li>${e}</li>`).join("")}</ul>`;
			allPlayersImportResult.className = "import-result error";
		} else {
			allPlayersImportResult.innerHTML = `<span class="summary">${summary}</span>`;
			allPlayersImportResult.className = "import-result success";
		}
		allPlayersCsvInput.value = "";
	};
	reader.readAsText(file);
});

// ---- CSV Export ----
document.getElementById("export-all-players-btn").addEventListener("click", () => {
	if (allPlayers.length === 0) {
		alertDialog(null, "No players to export.");
		return;
	}
	const csv = ["name,skill,gender", ...allPlayers.map((p) => `${p.name},${p.skill},${p.gender || "x"}`)].join("\r\n");
	const a = document.createElement("a");
	a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
	a.download = "players.csv";
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(a.href);
});

// gender/skill change

// 1. define current popver variable to track the open picker
let currentPickerPopover = null;

// 2. Delegate click event to gender and skill pills inside the table
allPlayerTableBody.addEventListener("click", (event) => {
	const targetSkillPill = event.target.closest(".skill-pill");
	if (targetSkillPill && !targetSkillPill.closest(".skill-picker-popover")) {
		event.stopPropagation();
		openSkillPicker(targetSkillPill);
		return;
	}

	const targetGenderPill = event.target.closest(".gender-pill");
	if (targetGenderPill && !targetGenderPill.closest(".gender-picker-popover")) {
		event.stopPropagation();
		openGenderPicker(targetGenderPill);
		return;
	}
});

function createPickerPopover(targetPill) {
	// Create pickerPopover element
	const pickerPopover = document.createElement("div");
	pickerPopover.className = "gender-picker-popover";

	// Apply positioning styles
	Object.assign(pickerPopover.style, {
		position: "absolute",
		backgroundColor: "#ffffff",
		border: "1px solid var(--accent-soft)",
		borderRadius: "6px",
		padding: "6px 8px",
		boxShadow: "0 4px 12px var(--accent-soft)",
		zIndex: "1000",
		display: "flex",
		gap: "6px",
	});

	// Calculate position relative to clicked pill
	const rect = targetPill.getBoundingClientRect();
	pickerPopover.style.top = `${rect.bottom + window.scrollY + 4}px`;
	pickerPopover.style.left = `${rect.left + window.scrollX}px`;

	return pickerPopover;
}

function getPlayerIdFromPill(targetPill) {
	// Retrieve player ID from the row's remove button or dataset
	const row = targetPill.closest("tr");
	const playerId = targetPill.dataset.id || row.querySelector(".remove-btn")?.dataset.id;

	return playerId;
}

function openGenderPicker(targetPill) {
	closeCurrentPickerPopover();

	// Create pickerPopover element
	const pickerPopover = createPickerPopover(targetPill);

	// Retrieve player ID from the row's remove button or dataset
	const playerId = getPlayerIdFromPill(targetPill);

	// Build gender option pills
	Object.keys(GENDER_LABELS).forEach((genderId) => {
		const option = document.createElement("span");
		updateGenderPillElement(option, genderId, true);

		option.addEventListener("click", (e) => {
			e.stopPropagation();

			// Update target pill UI

			// Callback hook for backend/API update
			if (onGenderChanged(targetPill, playerId, genderId)) {
				// Reset sort UI since gender change may affect order, we do not wont to apply sort because
				// it would change the order of the list and confuse the user.
				// Instead we just update the pill and let the user sort manually if they want.
				cancelSortUI("all");
			}

			closeCurrentPickerPopover();
		});

		pickerPopover.appendChild(option);
	});

	document.body.appendChild(pickerPopover);
	currentPickerPopover = pickerPopover;
}

function openSkillPicker(targetPill) {
	closeCurrentPickerPopover();

	// Create pickerPopover element
	const pickerPopover = createPickerPopover(targetPill);

	// Retrieve player ID from the row's remove button or dataset
	const playerId = getPlayerIdFromPill(targetPill);

	// Build skill option pills
	Object.keys(SKILL_LABELS).forEach((skillId) => {
		const option = document.createElement("span");
		updateSkillPillElement(option, skillId, true);

		option.addEventListener("click", (e) => {
			e.stopPropagation();

			// Update target pill UI

			// Callback hook for backend/API update
			if (onSkillChanged(targetPill, playerId, skillId)) {
				// Reset sort UI since skill change may affect order, we do not wont to apply sort because
				// it would change the order of the list and confuse the user.
				// Instead we just update the pill and let the user sort manually if they want.
				cancelSortUI("all");
			}

			closeCurrentPickerPopover();
		});

		pickerPopover.appendChild(option);
	});

	document.body.appendChild(pickerPopover);
	currentPickerPopover = pickerPopover;
}

function closeCurrentPickerPopover() {
	if (currentPickerPopover) {
		currentPickerPopover.remove();
		currentPickerPopover = null;
	}
}

// 3. Backend callback placeholders

function onGenderChanged(targetPillElement, playerId, genderId) {
	const player = allPlayers.find((p) => p.id === Number(playerId));
	if (player && player.gender !== genderId) {
		player.gender = genderId;
		saveAllPlayersToStorage(false);

		// here we can avoid to render all players again, just update the pill text and class
		updateGenderPillElement(targetPillElement, genderId, true);

		return true;
	}

	return false;
}

function onSkillChanged(targetPillElement, playerId, skillId) {
	const player = allPlayers.find((p) => p.id === Number(playerId));
	if (player && player.skill !== skillId) {
		player.skill = skillId;
		saveAllPlayersToStorage(false);

		// here we can avoid to render all players again, just update the pill text and class
		updateSkillPillElement(targetPillElement, skillId, true);

		PlayerEvents.emit(PlayerEvents.Type.UPDATE, player.id);
		renderGeneratedSchedule();

		return true;
	}

	return false;
}

// 4. Close pickerPopover on Escape key
document.addEventListener("keydown", (event) => {
	if (event.key === "Escape") {
		closeCurrentPickerPopover();
	}
});

// 5. Close pickerPopover when clicking outside
document.addEventListener("click", (event) => {
	if (currentPickerPopover && !currentPickerPopover.contains(event.target)) {
		closeCurrentPickerPopover();
	}
});

// ── Utility ───────────────────────────────────────────────────

function playerName(allPlayerId) {
	const p = allPlayers.find((p) => Number(p.id) === Number(allPlayerId));
	return p ? p.name : "?";
}

// biome-ignore lint/correctness/noUnusedVariables: function is used
function playerSkill(allPlayerId) {
	const p = allPlayers.find((p) => p.id === allPlayerId);
	return p ? p.skill : "?";
}

function playerGender(allPlayerId) {
	const p = allPlayers.find((p) => p.id === allPlayerId);
	return p?.gender || "x";
}

// biome-ignore lint/correctness/noUnusedVariables: function is used
function playerIsWoman(allPlayerId) {
	return playerGender(allPlayerId) === "w";
}

// ============================================================
// INIT — initial render on page load
// ============================================================
populateAppSkillOptions();
loadAllPlayersFromStorage();

const allPlayersDataDesc = "All Players";

window.StorageEvents.on(StorageEvents.Type.LOAD, allPlayersDataDesc, (data) => {
	saveAllPlayersDataToStorage(data);
	loadAllPlayersFromStorage();
});

window.StorageEvents.on(StorageEvents.Type.SAVE, allPlayersDataDesc, () => {
	return getAllPlayersDataFromStorage();
});

window.StorageEvents.on(StorageEvents.Type.DEL_PERMANENT_DATA, allPlayersDataDesc, () => {
	clearAllPlayersFromStorage();
});

window.StorageEvents.on(StorageEvents.Type.HAS_PERMANENT_DATA, allPlayersDataDesc, () => {
	return allPlayers.length > 0;
});
