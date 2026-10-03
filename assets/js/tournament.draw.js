// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

function populateSelectElementWithKeyValue(selectEl, keyvals, firstValueHint) {
	selectEl.innerHTML = "";
	const opt = document.createElement("option");
	opt.value = "";
	opt.textContent = firstValueHint;
	selectEl.appendChild(opt);

	keyvals.forEach((item) => {
		const opt = document.createElement("option");
		opt.value = item.key;
		opt.textContent = item.value;
		selectEl.appendChild(opt);
	});
}

function populateSelectElementWithValues(selectEl, values, firstValueHint) {
	selectEl.innerHTML = "";
	const opt = document.createElement("option");
	opt.value = "";
	opt.textContent = firstValueHint;
	selectEl.appendChild(opt);

	values.forEach((value) => {
		const opt = document.createElement("option");
		opt.value = value;
		opt.textContent = String(value);
		selectEl.appendChild(opt);
	});
}

// ------------------------------------------------------------
// Qualification draw
// ------------------------------------------------------------

const genQualificationDrawTitle = document.getElementById("gen-qualification-draw-title");
const genQualificationDrawTableBody = document.getElementById("qualification-draw-table-body");

const qualificationDrawFormCard = document.getElementById("gen-qualification-draw-form-card");
const qualificationDrawPlayerField = document.getElementById("qualification-draw-player");
const qualificationDrawPickField = document.getElementById("qualification-draw-pick");
const qualificationDrawAutoAssignButton = document.getElementById("auto-assign-qualification-draw-btn");
const qualificationDrawPanelHeader = document.getElementById("qualification-draw-panel-header");

let currentDrawPlayerId = null;

function populateQualificationDrawPlayerField() {
	const playerOptions = tournamentPlayers
		.filter((p) => p.pick === 0)
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((p) => ({ key: p.id, value: p.name }));
	populateSelectElementWithKeyValue(qualificationDrawPlayerField, playerOptions, "Select a player");
	if (playerOptions.length === 0) {
		qualificationDrawPlayerField.disabled = true;
	} else {
		qualificationDrawPlayerField.disabled = false;
	}
}

function getAvailableQualificationDrawPicks(playerId) {
	let start = 1;
	let end = tournamentPlayers.length;

	if (tournamentConfig.twoMenVsTwoWomen === "disabled") {
		const womenCount = getWomenCount();
		if (playerIsWoman(playerId)) {
			end = womenCount;
		} else {
			start = 1 + womenCount;
		}
	}

	const values = [];
	for (let pick = start; pick <= end; pick++) {
		if (!tournamentPlayers.some((player) => player.pick === pick)) {
			values.push(pick);
		}
	}
	return values;
}

function populateQualificationDrawPickField() {
	const values = currentDrawPlayerId === null ? [] : getAvailableQualificationDrawPicks(currentDrawPlayerId);

	populateSelectElementWithValues(qualificationDrawPickField, values, "Select a pick");

	if (currentDrawPlayerId === null || values.length === 0) {
		qualificationDrawPickField.disabled = true;
	} else {
		qualificationDrawPickField.disabled = false;
	}
}

qualificationDrawPlayerField.addEventListener("change", (event) => {
	if (!event.target.value) return;

	currentDrawPlayerId = Number(event.target.value);

	//populateAvailableDraws();
	populateQualificationDrawPickField();

	// on pick change, reset the pick field and enable it
	qualificationDrawPickField.value = "";
	qualificationDrawPickField.disabled = false;
});

qualificationDrawPickField.addEventListener("change", (event) => {
	const drawNumber = event.target.value;
	if (!drawNumber) return;

	qualificationDrawPickField.value = "";
	qualificationDrawPickField.disabled = true;

	tournamentPlayersMap.get(currentDrawPlayerId).pick = Number(drawNumber);

	//console.log("Updated tournamentPlayersMap with pick for playerId:", currentDrawPlayerId);

	saveTournamentPlayers();

	renderQualificationDrawPlayers();
	currentDrawPlayerId = null;
	populateQualificationDrawPlayerField();
	renderQualificationDrawAutoAssignButton();
});

function shuffleQualificationDrawItems(items) {
	for (let index = items.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[items[index], items[swapIndex]] = [items[swapIndex], items[index]];
	}
	return items;
}

function renderQualificationDrawAutoAssignButton() {
	qualificationDrawAutoAssignButton.hidden = tournamentConfig.qualificationDrawConfirmed || !tournamentPlayers.some((player) => player.pick === 0);
}

qualificationDrawAutoAssignButton.addEventListener("click", () => {
	const unassignedPlayers = tournamentPlayers.filter((player) => player.pick === 0);
	if (unassignedPlayers.length === 0) return;

	const groups =
		tournamentConfig.twoMenVsTwoWomen === "disabled"
			? [unassignedPlayers.filter((player) => playerIsWoman(player.id)), unassignedPlayers.filter((player) => !playerIsWoman(player.id))]
			: [unassignedPlayers];

	groups.forEach((players) => {
		if (players.length === 0) return;

		const availablePicks = getAvailableQualificationDrawPicks(players[0].id);
		shuffleQualificationDrawItems(players);
		shuffleQualificationDrawItems(availablePicks);
		players.forEach((player, index) => {
			if (availablePicks[index] !== undefined) player.pick = availablePicks[index];
		});
	});

	currentDrawPlayerId = null;
	saveTournamentPlayers();
	renderQualificationDraw();
	renderQualificationDrawSubmitButton();
});

function renderQualificationDrawPlayers() {
	genQualificationDrawTableBody.innerHTML = "";
	//console.log("Rendering qualification draw players:", tournamentPlayers.filter((p) => p.pick !== 0));
	getSorted(
		tournamentPlayers.filter((p) => p.pick !== 0),
		"qualificationDraw",
	).forEach((p) => {
		const row = document.createElement("tr");
		let removeBtnHtml = "";

		// withdrawal is not allowed after the qualification is finished
		if (!tournamentConfig.qualificationFinished) {
			let buttonTitle = "Remove";
			if (tournamentConfig.qualificationDrawConfirmed) {
				if (p.withdrawn) {
					buttonTitle = "Undo Withdrawal";
				} else {
					buttonTitle = "Withdraw";
				}
			}
			removeBtnHtml = `<button type="button" class="remove-btn" data-id="${p.id}">${buttonTitle}</button>`;
		}

		row.innerHTML = `
		<td>${p.name}</td>
		<td>${p.pick}</td>
		<td>${removeBtnHtml}</td>`;
		genQualificationDrawTableBody.appendChild(row);
	});

	updateSortUI("qualificationDraw");
	updateRegisteredTableFit("qualification-draw-table");
}

function renderQualificationDraw() {
	qualificationDrawFormCard.hidden = tournamentConfig.qualificationDrawConfirmed;
	genQualificationDrawTitle.innerText = tournamentConfig.qualificationDrawConfirmed ? "Qualification draw" : "Enter qualification draw results";

	if (!tournamentConfig.qualificationDrawConfirmed) {
		const hint = qualificationDrawFormCard.querySelector("p.section-hint");
		if (tournamentConfig.twoMenVsTwoWomen === "enabled") {
			hint.innerText = "2 Men vs. 2 Women matches are allowed. Men and women share the same draw pool.";
		} else if (tournamentConfig.twoMenVsTwoWomen === "disabled") {
			hint.innerHTML = `2 Men vs. 2 Women matches are blocked. Men and women draw from separate pools: <ul class="section-hint-list"><li>Women: 1–${tournamentWomenCount}</li><li>Men: ${tournamentWomenCount + 1}–${tournamentPlayers.length}</li></ul>`;
		} else if (tournamentConfig.twoMenVsTwoWomen === "manual") {
			hint.innerText =
				"2 Men vs. 2 Women matches are allowed but flagged for organizer review using a shared draw pool. If any are created, confirming draws opens edit mode automatically.";
		}
	}
	qualificationDrawPanelHeader.hidden = tournamentConfig.qualificationDrawConfirmed;

	if (!tournamentConfig.qualificationDrawConfirmed) {
		populateQualificationDrawPlayerField();
		populateQualificationDrawPickField();
	}
	renderQualificationDrawAutoAssignButton();

	renderQualificationDrawPlayers();
}

function initQualificationDrawRenderer() {
	const table = document.getElementById("qualification-draw-table");
	registerTableFitControl(table, document.getElementById("qualification-draw-fit"));
	registerSortableTable(table, {
		listKey: "qualificationDraw",
		initialState: [{ field: "name", dir: "asc" }],
		comparator: compareTournamentSortValues,
		renderer: renderQualificationDrawPlayers,
	});
}
