// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

// ============================================================
// TAB NAVIGATION
// ============================================================
const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");
tabs.forEach((tab) => {
	tab.addEventListener("click", () => {
		tabs.forEach((t) => {
			t.classList.remove("active");
		});
		tabContents.forEach((c) => {
			c.classList.remove("active");
		});
		tab.classList.add("active");
		document.getElementById(tab.dataset.tab).classList.add("active");
	});
});

// ---- Sub-tab navigation ----
document.querySelectorAll(".sub-tabs").forEach((subTabGroup) => {
	subTabGroup.querySelectorAll(".sub-tab").forEach((btn) => {
		btn.addEventListener("click", () => {
			subTabGroup.querySelectorAll(".sub-tab").forEach((b) => {
				b.classList.remove("active");
			});
			btn.classList.add("active");
			const parent = subTabGroup.parentElement;
			parent.querySelectorAll(":scope > .sub-tab-content").forEach((c) => {
				c.classList.remove("active");
			});
			document.getElementById(btn.dataset.subtab).classList.add("active");
		});
	});
});

// ============================================================
// TIME UTILITIES
// ============================================================

function timeToMins(t) {
	console.assert(typeof t === "string" && t.includes(":"), "Invalid time format:", t);
	const [h, m] = t.split(":").map(Number);
	return h * 60 + m;
}

function minsToTime(total) {
	return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// biome-ignore lint/correctness/noUnusedVariables: function is used
function addMinsToTime(time, minsToAdd) {
	return minsToTime(timeToMins(time) + minsToAdd);
}

// biome-ignore lint/correctness/noUnusedVariables: function is used
function formatDuration(mins) {
	const h = Math.floor(mins / 60),
		m = mins % 60;
	if (h === 0) return `${m} min`;
	if (m === 0) return `${h}h`;
	return `${h}h ${m}m`;
}

// ============================================================
// SELECT UTILITIES
// ============================================================

// Populate time dropdown (07:00 – 20:00 in 30-min steps)
// biome-ignore lint/correctness/noUnusedVariables: function is used
function populateTimeSelect(selectEl) {
	for (let mins = 7 * 60; mins <= 20 * 60; mins += 30) {
		const h = String(Math.floor(mins / 60)).padStart(2, "0");
		const m = String(mins % 60).padStart(2, "0");
		const opt = document.createElement("option");
		opt.value = opt.textContent = `${h}:${m}`;
		selectEl.appendChild(opt);
	}
}

// ============================================================
// SORT UTILITIES
// ============================================================

// biome-ignore lint/correctness/noUnusedVariables: function is used
function shuffle(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

// remember all sort keys
const sortState = {
	all: [{ field: "name", dir: "asc" }],
	active: [{ field: "name", dir: "asc" }],
	stats: [{ field: "name", dir: "asc" }],
	qualificationDraw: [{ field: "name", dir: "asc" }],
	qualificationPlayerStats: [{ field: "rank", dir: "asc" }],
	qualificationP2PStats: [{ field: "name", dir: "asc" }],
};

// biome-ignore lint/correctness/noUnusedVariables: function is used
function getSorted(arr, listKey) {
	const sortFunc = (a, b, field, dir) => {
		if (field === "arrival") {
			const va = timeToMins(a[field]);
			const vb = timeToMins(b[field]);
			if (va < vb) return dir === "asc" ? -1 : 1;
			if (va > vb) return dir === "asc" ? 1 : -1;
			return 0;
		}
		if (
			field === "playtime" ||
			field === "matches" ||
			field === "bench" ||
			field === "sit1stRound" ||
			field === "pick" ||
			field === "played" ||
			field === "wins" ||
			field === "losses" ||
			field === "winrate" ||
			field === "diff" ||
			field === "rank"
		) {
			const va = a[field] || false;
			const vb = b[field] || false;
			if (va < vb) return dir === "asc" ? -1 : 1;
			if (va > vb) return dir === "asc" ? 1 : -1;
			return 0;
		}
		if (field === "playrate") {
			const va = a.matches / (a.matches + a.bench);
			const vb = b.matches / (b.matches + b.bench);
			if (va < vb) return dir === "asc" ? -1 : 1;
			if (va > vb) return dir === "asc" ? 1 : -1;
			return 0;
		}
		if (field === "skill") {
			const va = Number(a.skill);
			const vb = Number(b.skill);
			if (va < vb) return dir === "asc" ? -1 : 1;
			if (va > vb) return dir === "asc" ? 1 : -1;
			return 0;
		}
		if (field === "partners" || field === "opponents") {
			const va = a[field].size;
			const vb = b[field].size;
			if (va < vb) return dir === "asc" ? -1 : 1;
			if (va > vb) return dir === "asc" ? 1 : -1;
			return 0;
		}
		if (field === "gender") {
			const va = a[field] || "x";
			const vb = b[field] || "x";
			if (va < vb) return dir === "asc" ? -1 : 1;
			if (va > vb) return dir === "asc" ? 1 : -1;
			return 0;
		}

		// player name alphabetical sort as fallback
		const ret = a[field].toLowerCase().localeCompare(b[field].toLowerCase());
		if (ret < 0) return dir === "asc" ? -1 : 1;
		if (ret > 0) return dir === "asc" ? 1 : -1;
		return 0;
	};

	return [...arr].sort((a, b) => {
		for (const { field, dir } of sortState[listKey]) {
			const result = sortFunc(a, b, field, dir);
			if (result !== 0) return result;
		}
		return 0; // If all criteria are equal, maintain original order
	});
}

// biome-ignore lint/correctness/noUnusedVariables: function is used
function updateSortUI(listKey) {
	const { field, dir } = sortState[listKey][0];
	const arrow = dir === "asc" ? "↑" : "↓";

	document.querySelectorAll(`span.sortable[data-list="${listKey}"]`).forEach((span) => {
		const active = span.dataset.field === field;
		span.classList.toggle("sort-active", active);
		const icon = span.querySelector(".sort-icon");
		if (icon) icon.textContent = active ? arrow : "↕";
	});
}

// biome-ignore lint/correctness/noUnusedVariables: function is used
function cancelSortUI(listKey) {
	document.querySelectorAll(`span.sortable[data-list="${listKey}"]`).forEach((span) => {
		span.classList.remove("sort-active");
		const icon = span.querySelector(".sort-icon");
		if (icon) icon.textContent = "↕";
	});
}

function handleSort(listKey, field) {
	if (sortState[listKey][0].field === field) {
		sortState[listKey][0].dir = sortState[listKey][0].dir === "asc" ? "desc" : "asc";
	} else {
		// find field in current list key and move it to position 0 (most recent sort)
		const currentList = sortState[listKey];
		const index = currentList.findIndex((s) => s.field === field);
		if (index > 0) {
			sortState[listKey] = [currentList[index], ...currentList.slice(0, index), ...currentList.slice(index + 1)];
		} else {
			// field not found in current list, add it to the beginning
			sortState[listKey] = [{ field, dir: "asc" }, ...currentList];
		}
	}
	console.log(`Updated sort state for ${listKey}:`, sortState[listKey]);
	//console.log(`Sorting ${listKey} by ${field} (${sortState[listKey].dir})`);
	if (listKey === "all") renderAllPlayers();
	else if (listKey === "active") renderActivePlayers();
	else if (listKey === "stats") renderStatsTable();
	else if (listKey === "qualificationDraw") renderQualificationDrawPlayers();
	else if (listKey === "qualificationPlayerStats") renderQualificationStats();
	else if (listKey === "qualificationP2PStats") renderQualificationP2PStats();
}

document.querySelectorAll("span.sortable").forEach((el) => {
	el.addEventListener("click", () => handleSort(el.dataset.list, el.dataset.field));
});

document.querySelectorAll(".gen-card-toggle").forEach((header) => {
	header.addEventListener("click", () => {
		const container = header.closest(".gen-collapsible");
		if (!container) return;
		container.classList.toggle("gen-collapsed");
	});
});

// ============================================================
// ADDITIONAL UTILITIES
// ============================================================

// biome-ignore lint/correctness/noUnusedVariables: function is used
function valueWithSign(val) {
	if (val > 0) return `+${val}`;
	return val;
}

/**
 * Opens a confirmation dialog with optional input verification.
 * @param {string|null} title - The title of the dialog.
 * @param {string|string[]|null} note - An optional note to display in the dialog. Can contain a string or an array of additional information.
 * @param {boolean} confirmation - Whether this is a Confirm/Cancel dialog. If false, acts as an Alert (OK only).
 * @param {string|null} confirmationMatch - The exact text the user must type to enable the confirm button.
 */
function openDialog(title, note = null, confirmation = false, confirmationMatch = null) {
	return new Promise((resolve) => {
		const confirmDialog = document.createElement("dialog");
		confirmDialog.className = "confirm-modal";

		// Only show input field if a match string is actually provided
		const requireInput = typeof confirmationMatch === "string" && confirmationMatch.trim() !== "";

		confirmDialog.innerHTML = `
			${title ? `<h3>${title}</h3>` : ""}
			
			${
				requireInput
					? `
			<p>To confirm your intention, please type <strong>${confirmationMatch}</strong> below:</p>
			<input type="text" id="modal-input" autocomplete="off" placeholder="Type here">
			`
					: ""
			}
			
			${note ? (Array.isArray(note) ? note.map((n) => `<p class="modal-note">${n}</p>`).join("") : `<p class="modal-note">${note}</p>`) : ""}

			<div class="modal-actions">
				${confirmation ? `<button type="button" id="cancel-btn" class="discard-btn">Cancel</button>` : ""}
				<button type="button" id="confirm-btn" class="gen-primary-btn">${confirmation ? "Confirm" : "OK"}</button>
			</div>`;

		document.body.appendChild(confirmDialog);

		const destroyModal = () => {
			confirmDialog.close();
			confirmDialog.remove(); // Safely clean up DOM
		};

		const input = confirmDialog.querySelector("#modal-input");
		const cancelBtn = confirmDialog.querySelector("#cancel-btn");
		const confirmBtn = confirmDialog.querySelector("#confirm-btn");

		// Handle Cancel button click
		if (cancelBtn) {
			cancelBtn.addEventListener("click", () => {
				destroyModal();
				resolve(false);
			});
		}

		// Handle native 'Escape' key closing the dialog
		confirmDialog.addEventListener("cancel", () => {
			destroyModal();
			resolve(false);
		});

		// Disable button only if a text match is required
		confirmBtn.disabled = requireInput;

		// Handle Confirm button click
		confirmBtn.addEventListener("click", () => {
			destroyModal();
			resolve(true);
		});

		// Handle text input matching
		if (requireInput && input) {
			input.addEventListener("input", (e) => {
				confirmBtn.disabled = e.target.value !== confirmationMatch;
			});

			input.addEventListener("keydown", (e) => {
				if (e.key === "Enter" && !confirmBtn.disabled) {
					e.preventDefault(); // Prevents accidental form submission
					confirmBtn.click();
				}
			});
		}

		confirmDialog.showModal();
	});
}

// Helper Wrappers (Can simply return the Promise directly)
// biome-ignore lint/correctness/noUnusedVariables: function is used
function alertDialog(title, note = null) {
	return openDialog(title, note, false, null);
}

// biome-ignore lint/correctness/noUnusedVariables: function is used
function confirmDialog(title, note = null) {
	return openDialog(title, note, true, null);
}
