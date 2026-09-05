// ============================================================
// ACTIVE PLAYERS
// ============================================================
const ACTIVE_PLAYERS_KEY         = 'tournament-generator:activePlayers';
const ACTIVE_PLAYERS_NEXT_ID_KEY = 'tournament-generator:activePlayersNextId';

let activePlayers = [];
let nextActivePlayerId = 1;

// DOM refs
const activePlayerSelect    = document.getElementById('active-player-select');
const activeArrivalInput    = document.getElementById('active-arrival');
const activePlaytimeInput   = document.getElementById('active-playtime');
const activePlayerField     = document.getElementById('active-player-field');
const activeArrivalField    = document.getElementById('active-arrival-field');
const activePlaytimeField   = document.getElementById('active-playtime-field');
const activePlayerTableBody = document.getElementById('active-player-table-body');
const activePlayersEmpty    = document.getElementById('active-players-empty');
const activePlayerCount     = document.getElementById('active-player-count');

// Populate arrival dropdown (08:00 – 20:00 in 30-min steps)
(function() {
	for (let mins = 8 * 60; mins <= 20 * 60; mins += 30) {
		const h = String(Math.floor(mins / 60)).padStart(2, '0');
		const m = String(mins % 60).padStart(2, '0');
		const opt = document.createElement('option');
		opt.value = opt.textContent = `${h}:${m}`;
		activeArrivalInput.appendChild(opt);
	}
})();

function populateActivePlayerSelect() {
	const activeIds  = new Set(activePlayers.map(ap => ap.allPlayerId));
	const currentSel = new Set(Array.from(activePlayerSelect.selectedOptions).map(opt => opt.value));

	activePlayerSelect.innerHTML = '';
	[...allPlayers].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())).forEach(p => {
		if (activeIds.has(p.id)) return;
		const opt = document.createElement('option');
		opt.value       = String(p.id);
		opt.textContent = p.name;
		if (currentSel.has(opt.value)) opt.selected = true;
		activePlayerSelect.appendChild(opt);
	});

	const optionCount = activePlayerSelect.options.length;
	activePlayerSelect.size = Math.max(2, Math.min(optionCount, 15));
}

function validateActivePlayerForm() {
	const playerOk   = activePlayerSelect.selectedOptions.length > 0;
	const arrivalOk  = activeArrivalInput.value !== '';
	const playtimeOk = activePlaytimeInput.value !== '' && Number(activePlaytimeInput.value) > 0;
	activePlayerField.classList.toggle('invalid',   !playerOk);
	activeArrivalField.classList.toggle('invalid',  !arrivalOk);
	activePlaytimeField.classList.toggle('invalid', !playtimeOk);
	return playerOk && arrivalOk && playtimeOk;
}

activePlayerSelect.addEventListener('change',  () => { if (activePlayerField.classList.contains('invalid'))   validateActivePlayerForm(); });
activeArrivalInput.addEventListener('change',  () => { if (activeArrivalField.classList.contains('invalid'))  validateActivePlayerForm(); });
activePlaytimeInput.addEventListener('input',  () => { if (activePlaytimeField.classList.contains('invalid')) validateActivePlayerForm(); });

function renderActivePlayers() {
	activePlayerTableBody.innerHTML = '';

	const enriched = activePlayers.map(ap => {
		const p = allPlayers.find(p => p.id === ap.allPlayerId);
		return { ...ap, name: p ? p.name : '(removed)', skill: p ? p.skill : '0' };
	});

	getSorted(enriched, 'active').forEach(p => {
		const row = document.createElement('tr');
		row.dataset.id=p.id;
		row.innerHTML = `
			<td>${p.name}</td>
			<td>` + renderSkillPillHtml(p.skill) + `</td>
			<td>${p.arrival}</td>
			<td>${p.playtime}h</td>
			<td><input type="checkbox" class="sit-1st-round"${p.sit1stRound ? ' checked' : ''}></td>
			<td><button type="button" class="remove-btn">Remove</button></td>`;
		activePlayerTableBody.appendChild(row);
	});

	activePlayerCount.textContent = `(${activePlayers.length})`;
	activePlayersEmpty.style.display = activePlayers.length === 0 ? 'block' : 'none';
	updateSortUI('active');
	populateActivePlayerSelect();
}

function loadActivePlayersFromStorage() {
	try {
		const saved   = localStorage.getItem(ACTIVE_PLAYERS_KEY);
		const savedId = localStorage.getItem(ACTIVE_PLAYERS_NEXT_ID_KEY);
		if (saved)   activePlayers      = JSON.parse(saved);
		if (savedId) nextActivePlayerId = Number(savedId) || 1;
	} catch (err) { activePlayers = []; nextActivePlayerId = 1; }
	renderActivePlayers();
}

function saveActivePlayersToStorage(render = true) {
	try {
		localStorage.setItem(ACTIVE_PLAYERS_KEY,         JSON.stringify(activePlayers));
		localStorage.setItem(ACTIVE_PLAYERS_NEXT_ID_KEY, String(nextActivePlayerId));
	} catch (err) {}

	if (render) renderActivePlayers();
}

function clearActivePlayersFromStorage() {
	activePlayers = [];
	nextActivePlayerId = 1;
	try {
		localStorage.removeItem(ACTIVE_PLAYERS_KEY);
		localStorage.removeItem(ACTIVE_PLAYERS_NEXT_ID_KEY);
	} catch (err) {}
	renderActivePlayers();
}

function addActivePlayer(allPlayerId, arrival, playtime) {
	activePlayers.push({ id: nextActivePlayerId++, allPlayerId: Number(allPlayerId), arrival, playtime });
	saveActivePlayersToStorage();
}

function removeActivePlayer(id) {
	activePlayers = activePlayers.filter(ap => ap.id !== id);
	saveActivePlayersToStorage();
}

activePlayerTableBody.addEventListener('click', e => {
	const row = e.target.closest('tr');
	if (!row) return;

	const playerId = Number(row.dataset.id);

	// 1. Handle the Remove Button
	if (e.target.closest('.remove-btn')) {
		removeActivePlayer(playerId);
		return
	} 

	// 2. Handle a Checkbox click
	const checkbox = e.target.closest('input[type="checkbox"]');
	if (checkbox) {
		const isChecked = checkbox.checked; // true or false
		const player = activePlayers.find(p => p.id === Number(playerId));
		player.sit1stRound = isChecked; // Update the property in the activePlayers array
		saveActivePlayersToStorage(false); // Save the updated array to localStorage
	}
});

document.getElementById('clear-active-players-btn').addEventListener('click', () => {
	if (activePlayers.length === 0) return;
	if (confirm('Remove all active players from this tournament?')) {
		clearActivePlayersFromStorage();
	}
});

document.getElementById('active-player-form').addEventListener('submit', e => {
	e.preventDefault();
	if (!validateActivePlayerForm()) return;

	const selectedIds = Array.from(activePlayerSelect.selectedOptions).map(opt => opt.value);
	selectedIds.forEach(id => addActivePlayer(id, activeArrivalInput.value, activePlaytimeInput.value));

	document.getElementById('active-player-form').reset();
	[activePlayerField, activeArrivalField, activePlaytimeField].forEach(f => f.classList.remove('invalid'));
});

// ============================================================
// INIT — initial render on page load
// ============================================================
loadActivePlayersFromStorage();
populateActivePlayerSelect();
