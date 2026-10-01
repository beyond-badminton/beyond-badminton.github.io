// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

function registerQualificationMatchFilter(tableElement, filterName, onChange = () => {}) {
	if (!tableElement) return null;

	const filterMarkup = `
	<div class="gen-collapsible gen-collapsed" id="${filterName}-wrap">
		<div class="gen-table-label gen-card-toggle" id="${filterName}-label">
			<span class="gen-collapse-arrow">&#9662;</span>
			Filter players &amp; matches (<span id="${filterName}-count"></span>)
		</div>
		<div class="filter-controls">
			<input type="search" id="${filterName}-search" placeholder="Search player...">
			<button type="button" id="${filterName}-all-btn" class="select-btn">Select all</button>
			<button type="button" id="${filterName}-none-btn" class="clear-btn">Clear all</button>
			<div class="align-top">
				<div class="checkbox-group">
					<label class="gen-checkbox-label" for="${filterName}-active-window">
						<input type="checkbox" id="${filterName}-active-window">
						<span id="${filterName}-active-window-label">Show active 4-round window</span>
					</label>
					<span class="help-icon" title="Shows the last finished round, current round, and next two rounds. Active window is shifted 5 seconds after all score inputs lose focus. Keyboard shortcut: Alt + A.">?</span>
				</div>
				<div class="checkbox-group">
					<label class="gen-checkbox-label" for="${filterName}-drawn-numbers">
						<input type="checkbox" id="${filterName}-drawn-numbers">
						Show drawn numbers
					</label>
					<span class="help-icon" title="Shows each player's draw number before their name. Keyboard shortcut: Alt + N.">?</span>
				</div>
			</div>
			<div class="align-top">
				<div class="checkbox-group">
					<label class="gen-checkbox-label" for="${filterName}-no-bench">
						<input type="checkbox" id="${filterName}-no-bench">
						Hide bench for all rounds
					</label>
					<span class="help-icon" title="Hides benched players. Keyboard shortcut: Alt + Shift + B.">?</span>
				</div>
				<div class="checkbox-group">
					<label class="gen-checkbox-label" for="${filterName}-hide-bench-finished">
						<input type="checkbox" id="${filterName}-hide-bench-finished">
						Hide bench for finished rounds
					</label>
					<span class="help-icon" title="Hides benched players only after every match in a round has been played. Keyboard shortcut: Alt + B.">?</span>
				</div>
			</div>
		</div>
		<div id="${filterName}-player-filter" class="checkbox-list checkbox-filter-list"></div>
	</div>`;

	tableElement.insertAdjacentHTML("beforebegin", filterMarkup);
	const wrap = document.getElementById(`${filterName}-wrap`);
	const elements = {
		wrap,
		label: document.getElementById(`${filterName}-label`),
		list: document.getElementById(`${filterName}-player-filter`),
		count: document.getElementById(`${filterName}-count`),
		search: document.getElementById(`${filterName}-search`),
		allButton: document.getElementById(`${filterName}-all-btn`),
		noneButton: document.getElementById(`${filterName}-none-btn`),
		activeWindow: document.getElementById(`${filterName}-active-window`),
		activeWindowLabel: document.getElementById(`${filterName}-active-window-label`),
		activeWindowHint: wrap.querySelector(`#${filterName}-active-window`)?.closest(".checkbox-group")?.querySelector(".help-icon"),
		noBench: document.getElementById(`${filterName}-no-bench`),
		hideBenchFinished: document.getElementById(`${filterName}-hide-bench-finished`),
		drawnNumbers: document.getElementById(`${filterName}-drawn-numbers`),
	};
	const excluded = new Set();
	let players = [];

	function hasOptions() {
		return elements.activeWindow.checked || elements.drawnNumbers.checked || elements.noBench.checked || elements.hideBenchFinished.checked;
	}

	function applySearch() {
		const term = elements.search.value.trim().toLowerCase();
		elements.list.querySelectorAll(".checkbox-pill").forEach((label) => {
			label.classList.toggle("filter-hidden", term !== "" && !label.dataset.name.includes(term));
		});
	}

	function render(nextPlayers) {
		players = nextPlayers;
		renderQualificationCheckboxFilter(elements.list, excluded, players);
		renderQualificationFilterLabel(elements.label, elements.count, excluded, players, hasOptions());
		applySearch();
	}

	function initialize({ offset = 1, size = 4, matchFilters = {} } = {}) {
		if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(size) || size < 1 || offset >= size) {
			throw new RangeError("The active round window requires an offset >= 0 and a size greater than the offset.");
		}

		elements.activeWindow.checked = matchFilters.activeWindow ?? elements.activeWindow.checked;
		elements.drawnNumbers.checked = matchFilters.drawnNumbers ?? elements.drawnNumbers.checked;
		elements.noBench.checked = matchFilters.noBench ?? elements.noBench.checked;
		elements.hideBenchFinished.checked = matchFilters.hideBenchFinished ?? elements.hideBenchFinished.checked;
		elements.activeWindowLabel.textContent = `Show active ${size}-round window`;

		const previousRounds = offset === 1 ? "the last finished round" : `the last ${offset} finished rounds`;
		const nextRoundCount = size - offset - 1;
		const nextRounds = nextRoundCount === 1 ? "the next round" : `the next ${nextRoundCount} rounds`;
		const windowDescription = [offset > 0 ? previousRounds : null, "the current round", nextRoundCount > 0 ? nextRounds : null]
			.filter(Boolean)
			.join(", ");

		elements.activeWindowHint.title = `Shows ${windowDescription}. Active window is shifted 5 seconds after all score inputs lose focus. Keyboard shortcut: Alt + A.`;
	}

	function reset() {
		elements.activeWindow.checked = false;
		elements.drawnNumbers.checked = false;
		elements.noBench.checked = false;
		elements.hideBenchFinished.checked = false;
		excluded.clear();
	}

	elements.search.addEventListener("input", applySearch);
	elements.allButton.addEventListener("click", () => {
		excluded.clear();
		render(players);
		onChange("players");
	});
	elements.noneButton.addEventListener("click", () => {
		players.forEach((player) => {
			excluded.add(Number(player.id));
		});
		render(players);
		onChange("players");
	});
	elements.list.addEventListener("change", (event) => {
		const input = event.target.closest('input[type="checkbox"]');
		if (!input) return;

		const playerId = Number(input.value);
		const label = input.closest(".checkbox-pill");
		if (input.checked) {
			excluded.delete(playerId);
			label.classList.add("checked");
		} else {
			excluded.add(playerId);
			label.classList.remove("checked");
		}
		renderQualificationFilterLabel(elements.label, elements.count, excluded, players, hasOptions());
		onChange("players");
	});
	elements.activeWindow.addEventListener("change", () => {
		renderQualificationFilterLabel(elements.label, elements.count, excluded, players, hasOptions());
		onChange("activeWindow");
	});
	elements.drawnNumbers.addEventListener("change", () => {
		renderQualificationFilterLabel(elements.label, elements.count, excluded, players, hasOptions());
		onChange("roundDisplay");
	});
	elements.noBench.addEventListener("change", () => {
		if (elements.noBench.checked) elements.hideBenchFinished.checked = false;
		renderQualificationFilterLabel(elements.label, elements.count, excluded, players, hasOptions());
		onChange("roundDisplay");
	});
	elements.hideBenchFinished.addEventListener("change", () => {
		if (elements.hideBenchFinished.checked) elements.noBench.checked = false;
		renderQualificationFilterLabel(elements.label, elements.count, excluded, players, hasOptions());
		onChange("roundDisplay");
	});

	wrap.querySelector(".gen-card-toggle")?.addEventListener("click", (event) => {
		if (event.target.closest(".help-icon")) return;
		wrap.classList.toggle("gen-collapsed");
	});
	return Object.assign(elements, { excluded, initialize, reset, hasOptions, render, applySearch });
}

function registerQualificationP2PFilter(tableElement, filterName, onChange = () => {}) {
	if (!tableElement) return null;

	const filterMarkup = `
		<div class="gen-collapsible gen-collapsed" id="${filterName}-wrap">
			<div class="gen-table-label gen-card-toggle" id="${filterName}-label">
				<span class="gen-collapse-arrow">&#9662;</span>
				Filter players (<span id="${filterName}-count"></span>)
			</div>
			<div class="filter-controls">
				<input type="search" id="${filterName}-search" placeholder="Search player...">
				<button type="button" id="${filterName}-all-btn" class="select-btn">Select all</button>
				<button type="button" id="${filterName}-none-btn" class="clear-btn">Clear all</button>
				<div class="checkbox-group">
					<label class="gen-checkbox-label" for="${filterName}-show-playoff">
						<input type="checkbox" id="${filterName}-show-playoff">
						Show playoff players only
					</label>
					<span class="help-icon" title="When enabled, only matchups between playoff players are shown. Keyboard shortcut: Alt + P.">?</span>
				</div>
			</div>
			<div id="${filterName}-player-filter" class="checkbox-list checkbox-filter-list"></div>
		</div>`;

	const insertionTarget = tableElement.closest(".gen-table-wrap") ?? tableElement;
	insertionTarget.insertAdjacentHTML("beforebegin", filterMarkup);
	const wrap = document.getElementById(`${filterName}-wrap`);
	const elements = {
		wrap,
		label: document.getElementById(`${filterName}-label`),
		list: document.getElementById(`${filterName}-player-filter`),
		count: document.getElementById(`${filterName}-count`),
		search: document.getElementById(`${filterName}-search`),
		allButton: document.getElementById(`${filterName}-all-btn`),
		noneButton: document.getElementById(`${filterName}-none-btn`),
		playoffCheckbox: document.getElementById(`${filterName}-show-playoff`),
	};
	const excluded = new Set();
	let players = [];

	function applySearch() {
		const term = elements.search.value.trim().toLowerCase();
		elements.list.querySelectorAll(".checkbox-pill").forEach((label) => {
			label.classList.toggle("filter-hidden", term !== "" && !label.dataset.name.includes(term));
		});
	}

	function render(nextPlayers) {
		players = nextPlayers;
		renderQualificationCheckboxFilter(elements.list, excluded, players);
		renderQualificationFilterLabel(elements.label, elements.count, excluded, players, elements.playoffCheckbox.checked);
		applySearch();
	}

	function initialize({ showPlayoffPlayersOnly = false } = {}) {
		elements.playoffCheckbox.checked = showPlayoffPlayersOnly;
		excluded.clear();
	}

	function reset() {
		initialize();
	}

	elements.search.addEventListener("input", applySearch);
	elements.allButton.addEventListener("click", () => {
		excluded.clear();
		render(players);
		onChange();
	});
	elements.noneButton.addEventListener("click", () => {
		players.forEach((player) => {
			excluded.add(Number(player.id));
		});
		render(players);
		onChange();
	});
	elements.playoffCheckbox.addEventListener("change", () => {
		renderQualificationFilterLabel(elements.label, elements.count, excluded, players, elements.playoffCheckbox.checked);
		onChange();
	});
	elements.list.addEventListener("change", (event) => {
		const input = event.target.closest('input[type="checkbox"]');
		if (!input) return;

		const playerId = Number(input.value);
		const label = input.closest(".checkbox-pill");
		if (input.checked) {
			excluded.delete(playerId);
			label.classList.add("checked");
		} else {
			excluded.add(playerId);
			label.classList.remove("checked");
		}
		renderQualificationFilterLabel(elements.label, elements.count, excluded, players, elements.playoffCheckbox.checked);
		onChange();
	});

	wrap.querySelector(".gen-card-toggle")?.addEventListener("click", (event) => {
		if (event.target.closest(".help-icon")) return;
		wrap.classList.toggle("gen-collapsed");
	});
	return Object.assign(elements, { excluded, initialize, reset, render, applySearch });
}
