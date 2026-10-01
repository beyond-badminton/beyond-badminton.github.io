// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

const genQualificationP2PStatsTableBody = document.getElementById("qualification-stats-p2p-table-body");
const qualificationP2PFilterElements = registerQualificationP2PFilter(
	document.getElementById("qualification-p2p-stats-table"),
	"qualification-p2p-filter",
	renderQualificationP2PStats,
);
const qualificationP2PExcluded = qualificationP2PFilterElements.excluded;

document.addEventListener("keydown", (event) => {
	if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.key.toLowerCase() !== "p") return;
	if (!document.getElementById("tournament-section")?.classList.contains("active")) return;

	event.preventDefault();
	qualificationP2PFilterElements.playoffCheckbox.click();
});

function renderQualificationP2PStats() {
	const rows = tournamentPlayers
		.filter(
			(p) =>
				!qualificationP2PExcluded.has(Number(p.id)) &&
				(!qualificationP2PFilterElements.playoffCheckbox.checked || p.rank <= tournamentConfig.playoffPlayersCount),
		)
		.flatMap((p) => {
			const opponentsList = Object.entries(p.opponents || {}).filter(
				([opponentId, _]) =>
					!qualificationP2PFilterElements.playoffCheckbox.checked ||
					(tournamentPlayersMap.get(Number(opponentId)).rank || 0) <= tournamentConfig.playoffPlayersCount,
			);
			return opponentsList.map(([, opponentRecord], i) => {
				return {
					rank: p.rank,
					name: p.name,
					opponent: opponentRecord.name,
					firstOpponent: i === 0,
					lastOpponent: i === opponentsList.length - 1,
					played: opponentRecord.played,
					wins: opponentRecord.wins,
					losses: opponentRecord.losses,
					diff: opponentRecord.diff,
				};
			});
		});

	const lastPlayoffRank = rows.reduce((rank, item) => (item.rank > rank && item.rank <= tournamentConfig.playoffPlayersCount ? item.rank : rank), 0);

	genQualificationP2PStatsTableBody.innerHTML = getSorted(rows, "qualificationP2PStats")
		.map((row) => {
			const trClasses = [];
			const sortState = getSortState("qualificationP2PStats");
			const rankOrder = sortState && sortState.field === "rank" ? sortState.dir : null;
			if (((rankOrder === "asc" && row.lastOpponent) || (rankOrder === "desc" && row.firstOpponent)) && row.rank === lastPlayoffRank) {
				trClasses.push(`playoff-line-${rankOrder}`);
			}

			if (row.rank <= tournamentConfig.playoffPlayersCount) {
				trClasses.push("playoff-in");
			} else if (rankOrder) {
				trClasses.push("playoff-out");
			}

			return `<tr class="${trClasses.join(" ")}">
					<td>${row.rank}</td>
					<td>${row.name}</td>
					<td>${row.opponent}</td>
					<td>${row.played}</td>
					<td>${row.wins}</td>
					<td>${row.losses}</td>
					<td>${valueWithSign(row.diff)}</td>
				</tr>`;
		})
		.join("");
	updateSortUI("qualificationP2PStats");
	updateRegisteredTableFit("qualification-p2p-stats-table");
}

function initQualificationP2PStatsRenderer() {
	qualificationP2PFilterElements.initialize();
	const table = document.getElementById("qualification-p2p-stats-table");
	registerTableFitControl(table);
	const tableHead = table.querySelector("thead");
	tableHead.innerHTML = `
		<tr>
			<th><span class="sortable" data-list="qualificationP2PStats" data-field="rank">Rank <span class="sort-icon">↕</span></span></th>
			<th><span class="sortable" data-list="qualificationP2PStats" data-field="name">Player <span class="sort-icon">↕</span></span></th>
			<th><span class="sortable" data-list="qualificationP2PStats" data-field="opponent">Opponent <span class="sort-icon">↕</span></span></th>
			<th><span class="sortable" data-list="qualificationP2PStats" data-field="played">Played <span class="sort-icon">↕</span></span></th>
			<th><span class="sortable" data-list="qualificationP2PStats" data-field="wins">Wins <span class="sort-icon">↕</span></span></th>
			<th><span class="sortable" data-list="qualificationP2PStats" data-field="losses">Losses <span class="sort-icon">↕</span></span></th>
			<th><span class="sortable" data-list="qualificationP2PStats" data-field="diff">Diff <span class="sort-icon">↕</span></span></th>
		</tr>`;
	registerSortableTable(table, {
		listKey: "qualificationP2PStats",
		initialState: [{ field: "rank", dir: "asc" }],
		comparator: compareTournamentSortValues,
		renderer: renderQualificationP2PStats,
	});
}

function resetQualificationP2PStatsRenderer() {
	resetRegisteredTableFitControls();
	qualificationP2PFilterElements.reset();
}
