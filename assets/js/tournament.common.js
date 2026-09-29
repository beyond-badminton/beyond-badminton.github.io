// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

function renderQualificationCheckboxFilter(filterListElement, excludeSet, players) {
	filterListElement.innerHTML = "";
	players?.forEach((player) => {
		const isChecked = !excludeSet.has(Number(player.id));
		const label = document.createElement("label");
		label.className = `checkbox-pill${isChecked ? " checked" : ""}`;
		label.dataset.name = player.name.toLowerCase();
		label.innerHTML = `<input type="checkbox" value="${player.id}" ${isChecked ? "checked" : ""}> ${player.name}`;
		filterListElement.appendChild(label);
	});
}

function renderQualificationFilterLabel(filterLabel, countLabel, excludeSet, players, haveExtraExcludes = false) {
	if (excludeSet.size > 0 || haveExtraExcludes) {
		filterLabel.classList.add("gen-label-accent");
	} else {
		filterLabel.classList.remove("gen-label-accent");
	}

	countLabel.textContent = `${players.length - excludeSet.size}/${players.length}`;
}

const TOURNAMENT_NUMERIC_SORT_FIELDS = new Set(["pick", "rank", "played", "wins", "losses", "diff"]);

function compareTournamentSortValues(first, second, field, direction) {
	if (!TOURNAMENT_NUMERIC_SORT_FIELDS.has(field)) return undefined;

	const firstValue = first[field] || false;
	const secondValue = second[field] || false;
	if (firstValue < secondValue) return direction === "asc" ? -1 : 1;
	if (firstValue > secondValue) return direction === "asc" ? 1 : -1;
	return 0;
}
