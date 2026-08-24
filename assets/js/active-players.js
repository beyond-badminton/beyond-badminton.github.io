// ============================================================
// ACTIVE PLAYERS
// ============================================================
const ACTIVE_PLAYERS_KEY         = 'tournament-generator:activePlayers';
const ACTIVE_PLAYERS_NEXT_ID_KEY = 'tournament-generator:activePlayersNextId';

let activePlayers = [];
let nextActivePlayerId = 1;

function loadActivePlayersFromStorage() {
  try {
    const saved   = localStorage.getItem(ACTIVE_PLAYERS_KEY);
    const savedId = localStorage.getItem(ACTIVE_PLAYERS_NEXT_ID_KEY);
    if (saved)   activePlayers      = JSON.parse(saved);
    if (savedId) nextActivePlayerId = Number(savedId) || 1;
  } catch (err) { activePlayers = []; nextActivePlayerId = 1; }
}

function saveActivePlayersToStorage() {
  try {
    localStorage.setItem(ACTIVE_PLAYERS_KEY,         JSON.stringify(activePlayers));
    localStorage.setItem(ACTIVE_PLAYERS_NEXT_ID_KEY, String(nextActivePlayerId));
  } catch (err) {}
}

function clearActivePlayersFromStorage() {
	activePlayers = [];
	nextActivePlayerId = 1;
	try {
		localStorage.removeItem(ACTIVE_PLAYERS_KEY);
		localStorage.removeItem(ACTIVE_PLAYERS_NEXT_ID_KEY);
	} catch (err) {}
}

// DOM refs
const activePlayerSelect    = document.getElementById('active-player-select');
const activeArrivalInput    = document.getElementById('active-arrival');
const activePlaytimeInput   = document.getElementById('active-playtime');
const activePlayerField     = document.getElementById('active-player-field');
const activeArrivalField    = document.getElementById('active-arrival-field');
const activePlaytimeField   = document.getElementById('active-playtime-field');
const activePlayerList      = document.getElementById('active-player-list');
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
	allPlayers.forEach(p => {
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

// function populateActivePlayerSelect() {
//   const activeIds = new Set(activePlayers.map(ap => ap.allPlayerId));
//   const current   = activePlayerSelect.value;
//   activePlayerSelect.innerHTML = '<option value="">Select a player</option>';
//   allPlayers.forEach(p => {
//     if (activeIds.has(p.id)) return;
//     const opt = document.createElement('option');
//     opt.value       = String(p.id);
//     opt.textContent = `${p.name} — ${skillLabels[p.skill] || p.skill}`;
//     activePlayerSelect.appendChild(opt);
//   });
//   if (current && activePlayerSelect.querySelector(`option[value="${current}"]`)) {
//     activePlayerSelect.value = current;
//   }
// }
function validateActivePlayerForm() {
	const playerOk   = activePlayerSelect.selectedOptions.length > 0;
	const arrivalOk  = activeArrivalInput.value !== '';
	const playtimeOk = activePlaytimeInput.value !== '' && Number(activePlaytimeInput.value) > 0;
	activePlayerField.classList.toggle('invalid',   !playerOk);
	activeArrivalField.classList.toggle('invalid',  !arrivalOk);
	activePlaytimeField.classList.toggle('invalid', !playtimeOk);
	return playerOk && arrivalOk && playtimeOk;
}

// function validateActivePlayerForm() {
//   const playerOk   = activePlayerSelect.value !== '';
//   const arrivalOk  = activeArrivalInput.value !== '';
//   const playtimeOk = activePlaytimeInput.value !== '' && Number(activePlaytimeInput.value) > 0;
//   activePlayerField.classList.toggle('invalid',   !playerOk);
//   activeArrivalField.classList.toggle('invalid',  !arrivalOk);
//   activePlaytimeField.classList.toggle('invalid', !playtimeOk);
//   return playerOk && arrivalOk && playtimeOk;
// }

activePlayerSelect.addEventListener('change',  () => { if (activePlayerField.classList.contains('invalid'))   validateActivePlayerForm(); });
activeArrivalInput.addEventListener('change',  () => { if (activeArrivalField.classList.contains('invalid'))  validateActivePlayerForm(); });
activePlaytimeInput.addEventListener('input',  () => { if (activePlaytimeField.classList.contains('invalid')) validateActivePlayerForm(); });

function renderActivePlayers() {
	activePlayerList.innerHTML      = '';
	activePlayerTableBody.innerHTML = '';
  
	const enriched = activePlayers.map(ap => {
	  const p = allPlayers.find(p => p.id === ap.allPlayerId);
	  return { ...ap, name: p ? p.name : '(removed)', skill: p ? p.skill : '0' };
	});
  
	getSorted(enriched, 'active').forEach(p => {
  
	  const li = document.createElement('li');
	  li.innerHTML = `
		<div class="info">
		  <span class="name">${p.name}</span>
		  <span class="meta">` + renderSkillPillHtml(p.skill) + ` · ${p.arrival} · ${p.playtime}h</span>
		</div>
		<button type="button" class="remove-btn" data-id="${p.id}">Remove</button>`;
	  activePlayerList.appendChild(li);
  
	  const row = document.createElement('tr');
	  row.innerHTML = `
		<td>${p.name}</td>
		<td>` + renderSkillPillHtml(p.skill) + `</td>
		<td>${p.arrival}</td>
		<td>${p.playtime}h</td>
		<td><button type="button" class="remove-btn" data-id="${p.id}">Remove</button></td>`;
	  activePlayerTableBody.appendChild(row);
	});
  
	activePlayerCount.textContent = `(${activePlayers.length})`;
	activePlayersEmpty.style.display = activePlayers.length === 0 ? 'block' : 'none';
	updateSortUI('active');
	saveActivePlayersToStorage();
	populateActivePlayerSelect();
}

// function renderActivePlayers() {
//   activePlayerList.innerHTML      = '';
//   activePlayerTableBody.innerHTML = '';

//   const enriched = activePlayers.map(ap => {
//     const p = allPlayers.find(p => p.id === ap.allPlayerId);
//     return { ...ap, name: p ? p.name : '(removed)', skill: p ? p.skill : '0' };
//   });

//   getSorted(enriched, 'active').forEach(p => {

//     const li = document.createElement('li');
//     li.innerHTML = `
//       <div class="info">
//         <span class="name">${p.name}</span>
//         <span class="meta">` + renderSkillPillHtml(p.skill) + ` · ${p.arrival} · ${p.playtime}h</span>
//       </div>
//       <button type="button" class="remove-btn" data-id="${p.id}">Remove</button>`;
//     activePlayerList.appendChild(li);

//     const row = document.createElement('tr');
//     row.innerHTML = `
//       <td>${p.name}</td>
//       <td>` + renderSkillPillHtml(p.skill) + `</td>
//       <td>${p.arrival}</td>
//       <td>${p.playtime}h</td>
//       <td><button type="button" class="remove-btn" data-id="${p.id}">Remove</button></td>`;
//     activePlayerTableBody.appendChild(row);
//   });

//   activePlayerCount.textContent = `(${activePlayers.length})`;
//   activePlayersEmpty.style.display = activePlayers.length === 0 ? 'block' : 'none';
//   updateSortUI('active');
//   saveActivePlayersToStorage();
//   populateActivePlayerSelect();
// }

function addActivePlayer(allPlayerId, arrival, playtime) {
  activePlayers.push({ id: nextActivePlayerId++, allPlayerId: Number(allPlayerId), arrival, playtime });
  renderActivePlayers();
}

function removeActivePlayer(id) {
  activePlayers = activePlayers.filter(ap => ap.id !== id);
  renderActivePlayers();
}

activePlayerList.addEventListener('click', e => {
  const btn = e.target.closest('.remove-btn');
  if (btn) removeActivePlayer(Number(btn.dataset.id));
});
activePlayerTableBody.addEventListener('click', e => {
  const btn = e.target.closest('.remove-btn');
  if (btn) removeActivePlayer(Number(btn.dataset.id));
});

document.getElementById('clear-active-players-btn').addEventListener('click', () => {
  if (activePlayers.length === 0) return;
  if (confirm('Remove all active players from this tournament?')) {
    activePlayers      = [];
    nextActivePlayerId = 1;
    renderActivePlayers();
  }
});

// document.getElementById('active-player-form').addEventListener('submit', e => {
//   e.preventDefault();
//   if (!validateActivePlayerForm()) return;
//   addActivePlayer(activePlayerSelect.value, activeArrivalInput.value, activePlaytimeInput.value);
//   document.getElementById('active-player-form').reset();
//   [activePlayerField, activeArrivalField, activePlaytimeField].forEach(f => f.classList.remove('invalid'));
// });
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
renderActivePlayers();