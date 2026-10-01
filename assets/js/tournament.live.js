// Read-only tournament view. The manager page remains the source of truth.
// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

const LIVE_STORAGE_KEYS = {
	config: "tournament-generator:tournamentConfig",
	rounds: "tournament-generator:qualificationRounds",
	scores: "tournament-generator:qualificationScores",
	players: "tournament-generator:tournamentPlayers",
};

const liveMatchesElement = document.getElementById("live-matches");
const liveStatsElement = document.getElementById("live-player-stats");
const liveMatchCountElement = document.getElementById("live-match-count");
const livePlayerCountElement = document.getElementById("live-player-count");
const liveUpdatedElement = document.getElementById("live-updated");
let lastLiveSnapshot = "";

function liveEscape(value) {
	return String(value ?? "").replace(/[&<>"']/g, (character) => {
		const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
		return entities[character];
	});
}

function readLiveStorage(key, fallback) {
	try {
		const value = localStorage.getItem(key);
		return value === null ? fallback : JSON.parse(value);
	} catch {
		return fallback;
	}
}

function readLiveTournament() {
	return {
		config: readLiveStorage(LIVE_STORAGE_KEYS.config, {}),
		rounds: readLiveStorage(LIVE_STORAGE_KEYS.rounds, []),
		scores: readLiveStorage(LIVE_STORAGE_KEYS.scores, {}),
		players: readLiveStorage(LIVE_STORAGE_KEYS.players, []),
	};
}

function livePlayerName(playerId, playersById) {
	const player = playersById.get(String(playerId));
	if (!player) return `Player ${liveEscape(playerId)}`;
	return `${player.withdrawn ? "(Withdrawn) " : ""}${liveEscape(player.name || `Player ${playerId}`)}`;
}

function liveScoreMarkup(score) {
	const scoreA = score?.a;
	const scoreB = score?.b;
	const hasScore = (scoreA !== null && scoreA !== undefined) || (scoreB !== null && scoreB !== undefined);
	const finished = scoreA !== null && scoreA !== undefined && scoreB !== null && scoreB !== undefined && scoreA !== scoreB;
	const aClass = finished && scoreA > scoreB ? "live-score-winner" : "";
	const bClass = finished && scoreB > scoreA ? "live-score-winner" : "";
	return `<div class="live-match-score${finished ? " is-final" : ""}" aria-label="${finished ? "Final score" : "Score"}">
		<span class="${aClass}">${hasScore && scoreA !== null && scoreA !== undefined ? liveEscape(scoreA) : "–"}</span>
		<span class="live-score-separator">:</span>
		<span class="${bClass}">${hasScore && scoreB !== null && scoreB !== undefined ? liveEscape(scoreB) : "–"}</span>
	</div>`;
}

function renderLiveMatches(rounds, scores, players) {
	const playersById = new Map(players.map((player) => [String(player.id), player]));
	const roundsWithMatches = rounds.filter((round) => Array.isArray(round.matches) && round.matches.length > 0);
	const matchCount = roundsWithMatches.reduce((total, round) => total + round.matches.length, 0);
	liveMatchCountElement.textContent = `${matchCount} ${matchCount === 1 ? "match" : "matches"}`;

	if (matchCount === 0) {
		liveMatchesElement.innerHTML = '<p class="tournament-live-empty">No tournament matches are available yet.</p>';
		return;
	}

	liveMatchesElement.innerHTML = roundsWithMatches
		.map((round, index) => {
			const roundNumber = Number.isInteger(round.roundId) ? round.roundId + 1 : index + 1;
			const matchMarkup = round.matches
				.map((match) => {
					const score = scores[match.matchId] || { a: null, b: null };
					const teamMarkup = (team) =>
						team.map((playerId) => `<span class="live-player-name">${livePlayerName(playerId, playersById)}</span>`).join("");
					return `<article class="live-match-card">
						<div class="live-match-meta"><span>${liveEscape(match.court || "Match")}</span><span>${liveEscape(match.matchId)}</span></div>
						<div class="live-match-teams">
							<div class="live-team">${teamMarkup(match.teamA || [])}</div>
							${liveScoreMarkup(score)}
							<div class="live-team">${teamMarkup(match.teamB || [])}</div>
						</div>
					</article>`;
				})
				.join("");
			const bench =
				Array.isArray(round.bench) && round.bench.length
					? `<p class="live-bench"><span>Bench</span> ${round.bench.map((playerId) => livePlayerName(playerId, playersById)).join(" · ")}</p>`
					: "";
			return `<section class="live-round">
				<h3>Round ${roundNumber}</h3>
				<div class="live-round-matches">${matchMarkup}</div>
				${bench}
			</section>`;
		})
		.join("");
}

function renderLiveStats(players) {
	const sortedPlayers = [...players].sort((first, second) => {
		const rankDifference = (Number(first.rank) || Number.MAX_SAFE_INTEGER) - (Number(second.rank) || Number.MAX_SAFE_INTEGER);
		return rankDifference || String(first.name || "").localeCompare(String(second.name || ""));
	});
	livePlayerCountElement.textContent = `${sortedPlayers.length} ${sortedPlayers.length === 1 ? "player" : "players"}`;

	if (sortedPlayers.length === 0) {
		liveStatsElement.innerHTML = '<tr><td colspan="6" class="tournament-live-empty-cell">Player standings will appear here.</td></tr>';
		return;
	}

	liveStatsElement.innerHTML = sortedPlayers
		.map(
			(player, index) => `<tr>
			<td class="live-rank">${Number(player.rank) || index + 1}</td>
			<td class="live-stat-player">${player.withdrawn ? '<span class="live-withdrawn">W</span> ' : ""}${liveEscape(player.name || `Player ${player.id}`)}</td>
			<td>${Number(player.played) || 0}</td>
			<td>${Number(player.wins) || 0}</td>
			<td>${Number(player.losses) || 0}</td>
			<td>${Number(player.diff) > 0 ? "+" : ""}${Number(player.diff) || 0}</td>
		</tr>`,
		)
		.join("");
}

function renderLiveTournament() {
	const tournament = readLiveTournament();
	const snapshot = JSON.stringify(tournament);
	if (snapshot === lastLiveSnapshot) return;
	lastLiveSnapshot = snapshot;

	const hasTournament = (Number(tournament.config.matchesPerPlayer) || 0) > 0;
	if (!hasTournament) {
		liveMatchCountElement.textContent = "";
		livePlayerCountElement.textContent = "";
		liveMatchesElement.innerHTML = '<p class="tournament-live-empty">No tournament is currently available.</p>';
		liveStatsElement.innerHTML =
			'<tr><td colspan="6" class="tournament-live-empty-cell">Standings will appear when a tournament is created.</td></tr>';
		liveUpdatedElement.textContent = "Waiting for tournament data";
		return;
	}

	renderLiveMatches(
		Array.isArray(tournament.rounds) ? tournament.rounds : [],
		tournament.scores || {},
		Array.isArray(tournament.players) ? tournament.players : [],
	);
	renderLiveStats(Array.isArray(tournament.players) ? tournament.players : []);
	const updatedTime = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
	liveUpdatedElement.textContent = `Live · updated ${updatedTime}`;
}

window.addEventListener("storage", (event) => {
	if (Object.values(LIVE_STORAGE_KEYS).includes(event.key) || event.key === null) renderLiveTournament();
});

window.addEventListener("focus", renderLiveTournament);
renderLiveTournament();
window.setInterval(renderLiveTournament, 1500);
