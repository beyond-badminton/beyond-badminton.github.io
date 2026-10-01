// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

// Qualification player stats
//------------------------------------------------------------

const genQualificationStatsTableBody = document.getElementById("qualification-stats-table-body");

function renderQualificationPlayerStats() {
	if (!tournamentConfig.qualificationStarted) {
		genQualificationStatsTableBody.innerHTML = "";
		updateSortUI("qualificationPlayerStats");
		updateRegisteredTableFit("qualification-stats-table");
		return;
	}

	genQualificationStatsTableBody.innerHTML = getSorted(tournamentPlayers, "qualificationPlayerStats")
		.map((stat) => {
			const trClasses = [];
			const sortState = getSortState("qualificationPlayerStats");
			const rankOrder = sortState && sortState.field === "rank" ? sortState.dir : null;
			if (rankOrder) {
				if (stat.rank === tournamentConfig.playoffPlayersCount) {
					trClasses.push(`playoff-line-${rankOrder}`);
				} else if (stat.rank < tournamentConfig.playoffPlayersCount && stat.rank % 4 === 0) {
					trClasses.push(`quartet-line-${rankOrder}`);
				}
			}

			if (stat.rank <= tournamentConfig.playoffPlayersCount) {
				trClasses.push("playoff-in");
			} else if (rankOrder) {
				trClasses.push("playoff-out");
			}

			return `<tr class="${trClasses.join(" ")}">
			<td>${stat.rank}</td>
			<td>${stat.name}</td>
			<td>${stat.played}</td>
			<td>${stat.wins}</td>
			<td>${stat.losses}</td>
			<td>${valueWithSign(stat.diff)}</td>
			<td>${stat.decidedBy ?? ""}</td>
		</tr>`;
		})
		.join("");
	updateSortUI("qualificationPlayerStats");
	updateRegisteredTableFit("qualification-stats-table");
}

function initQualificationPlayerStatsRenderer(autoResize = false) {
	const table = document.getElementById("qualification-stats-table");
	registerTableFitControl(table, autoResize);
	const tableHead = table.querySelector("thead");
	tableHead.innerHTML = `
		<tr>
			<th><span class="sortable" data-list="qualificationPlayerStats" data-field="rank">Rank <span class="sort-icon">↕</span></span></th>
			<th><span class="sortable" data-list="qualificationPlayerStats" data-field="name">Player <span class="sort-icon">↕</span></span></th>
			<th><span class="sortable" data-list="qualificationPlayerStats" data-field="played">Played <span class="sort-icon">↕</span></span></th>
			<th><span class="sortable" data-list="qualificationPlayerStats" data-field="wins">Wins <span class="sort-icon">↕</span></span></th>
			<th><span class="sortable" data-list="qualificationPlayerStats" data-field="losses">Losses <span class="sort-icon">↕</span></span></th>
			<th><span class="sortable" data-list="qualificationPlayerStats" data-field="diff">Diff <span class="sort-icon">↕</span></span></th>
			<th>Rule<span class="help-icon" title="The rule that set the player's final position, whether decisive on its own or used to break a tie.">?</span></th>
		</tr>`;
	registerSortableTable(table, {
		listKey: "qualificationPlayerStats",
		initialState: [{ field: "rank", dir: "asc" }],
		comparator: compareTournamentSortValues,
		renderer: renderQualificationPlayerStats,
	});
}
