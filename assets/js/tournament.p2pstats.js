// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

const genQualificationP2PStatsTableBody = document.getElementById("qualification-stats-p2p-table-body");
const genQualificationP2PFilterLabel = document.getElementById("qualification-p2p-filter-label");
const genQualificationP2PFilterList = document.getElementById("qualification-p2p-player-filter");
const genQualificationP2PFilterCount = document.getElementById("qualification-p2p-filter-count");
const genQualificationP2PFilterSearch = document.getElementById("qualification-p2p-filter-search");
const genQualificationP2PFilterAllBtn = document.getElementById("qualification-p2p-filter-all-btn");
const genQualificationP2PFilterNoneBtn = document.getElementById("qualification-p2p-filter-none-btn");
const genQualificationP2PFilterPlayoffCheckbox = document.getElementById("qualification-p2p-filter-show-playoff");

// Player ids hidden from the P2P stats table (session-only, not persisted).
const qualificationP2PExcluded = new Set();

function renderQualificationP2PFilter() {
	renderQualificationCheckboxFilter(genQualificationP2PFilterList, qualificationP2PExcluded, tournamentPlayers);
	renderQualificationFilterLabel(
		genQualificationP2PFilterLabel,
		genQualificationP2PFilterCount,
		qualificationP2PExcluded,
		tournamentPlayers,
		genQualificationP2PFilterPlayoffCheckbox.checked,
	);
	applyQualificationP2PFilterSearch();
}

function applyQualificationP2PFilterSearch() {
	const term = genQualificationP2PFilterSearch.value.trim().toLowerCase();
	genQualificationP2PFilterList.querySelectorAll(".checkbox-pill").forEach((label) => {
		label.classList.toggle("filter-hidden", term !== "" && !label.dataset.name.includes(term));
	});
}

genQualificationP2PFilterSearch.addEventListener("input", applyQualificationP2PFilterSearch);

genQualificationP2PFilterAllBtn.addEventListener("click", () => {
	qualificationP2PExcluded.clear();
	renderQualificationP2PFilter();
	renderQualificationP2PStats();
});

genQualificationP2PFilterNoneBtn.addEventListener("click", () => {
	tournamentPlayersMap.keys().forEach((playerId) => {
		qualificationP2PExcluded.add(playerId);
	});
	renderQualificationP2PFilter();
	renderQualificationP2PStats();
});

genQualificationP2PFilterPlayoffCheckbox.addEventListener("change", () => {
	renderQualificationFilterLabel(
		genQualificationP2PFilterLabel,
		genQualificationP2PFilterCount,
		qualificationP2PExcluded,
		tournamentPlayers,
		genQualificationP2PFilterPlayoffCheckbox.checked,
	);
	renderQualificationP2PStats();
});

genQualificationP2PFilterList.addEventListener("change", (e) => {
	const input = e.target.closest("input[type=checkbox]");
	if (!input) return;

	const playerId = Number(input.value);
	const label = input.closest(".checkbox-pill");

	if (input.checked) {
		qualificationP2PExcluded.delete(playerId);
		label.classList.add("checked");
	} else {
		qualificationP2PExcluded.add(playerId);
		label.classList.remove("checked");
	}

	renderQualificationP2PStats();
	renderQualificationFilterLabel(
		genQualificationP2PFilterLabel,
		genQualificationP2PFilterCount,
		qualificationP2PExcluded,
		tournamentPlayers,
		genQualificationP2PFilterPlayoffCheckbox.checked,
	);
});

function renderQualificationP2PStats() {
	const rows = tournamentPlayers
		.filter(
			(p) =>
				!qualificationP2PExcluded.has(Number(p.id)) &&
				(!genQualificationP2PFilterPlayoffCheckbox.checked || p.rank <= tournamentConfig.playoffPlayersCount),
		)
		.flatMap((p) => {
			const opponentsList = Object.entries(p.opponents || {}).filter(
				([opponentId, _]) =>
					!genQualificationP2PFilterPlayoffCheckbox.checked ||
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
	registerTableFitControl(document.getElementById("qualification-p2p-stats-table"), document.getElementById("qualification-p2p-stats-fit"));
	registerSortList("qualificationP2PStats", [{ field: "rank", dir: "asc" }], compareTournamentSortValues);
	registerSortRenderer("qualificationP2PStats", renderQualificationP2PStats);
	const tableHead = document.querySelector("#qualification-p2p-stats-table thead");
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
	registerSortableTable(tableHead);
}

function resetQualificationP2PStatsRenderer() {
	resetRegisteredTableFitControls();
	genQualificationP2PFilterPlayoffCheckbox.checked = false;
	qualificationP2PExcluded.clear();
}
