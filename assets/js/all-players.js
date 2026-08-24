// ============================================================
// ALL PLAYERS
// ============================================================
const ALL_PLAYERS_KEY         = 'tournament-generator:allPlayers';
const ALL_PLAYERS_NEXT_ID_KEY = 'tournament-generator:allPlayersNextId';

let allPlayers = [];
let nextAllPlayerId = 1;

function loadAllPlayersFromStorage() {
  try {
    const saved   = localStorage.getItem(ALL_PLAYERS_KEY);
    const savedId = localStorage.getItem(ALL_PLAYERS_NEXT_ID_KEY);
    if (saved)   allPlayers      = JSON.parse(saved);
    if (savedId) nextAllPlayerId = Number(savedId) || 1;
  } catch (err) { allPlayers = []; nextAllPlayerId = 1; }
}

function saveAllPlayersToStorage() {
  try {
    localStorage.setItem(ALL_PLAYERS_KEY,         JSON.stringify(allPlayers));
    localStorage.setItem(ALL_PLAYERS_NEXT_ID_KEY, String(nextAllPlayerId));
  } catch (err) {}
}

function clearAllPlayersFromStorage() {
	allPlayers = [];
	nextAllPlayerId = 1;
	try {
		localStorage.removeItem(ALL_PLAYERS_KEY);
		localStorage.removeItem(ALL_PLAYERS_NEXT_ID_KEY);
	} catch (err) {}
}

// DOM refs
const allPlayerForm      = document.getElementById('all-player-form');
const apNameInput        = document.getElementById('ap-name');
const apSkillInput       = document.getElementById('ap-skill');
const apNameField        = document.getElementById('ap-name-field');
const allPlayerList      = document.getElementById('all-player-list');
const allPlayerTableBody = document.getElementById('all-player-table-body');
const allPlayersEmpty    = document.getElementById('all-players-empty');
const allPlayerCount     = document.getElementById('all-player-count');

function validateAllPlayerForm() {
  const ok = apNameInput.value.trim().length > 0;
  apNameField.classList.toggle('invalid', !ok);
  return ok;
}

apNameInput.addEventListener('input', () => {
  if (apNameField.classList.contains('invalid')) validateAllPlayerForm();
});

function renderAllPlayers() {
  allPlayerList.innerHTML      = '';
  allPlayerTableBody.innerHTML = '';

  getSorted(allPlayers, 'all').forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="info">
        <span class="name">${p.name}</span>
        <span class="meta">` + renderSkillPillHtml(p.skill) + `</span>
      </div>
      <button type="button" class="remove-btn" data-id="${p.id}">Remove</button>`;
    allPlayerList.appendChild(li);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${p.name}</td>
      <td>` + renderSkillPillHtml(p.skill) +`</td>
      <td><button type="button" class="remove-btn" data-id="${p.id}">Remove</button></td>`;
    allPlayerTableBody.appendChild(row);
  });

  allPlayerCount.textContent = `(${allPlayers.length})`;
  allPlayersEmpty.style.display = allPlayers.length === 0 ? 'block' : 'none';
  updateSortUI('all');
  saveAllPlayersToStorage();
}

function addAllPlayer(name, skill) {
  if (allPlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
	return `Player "${name}" already exists.`;
  }
  allPlayers.push({ id: nextAllPlayerId++, name, skill });
  renderAllPlayers();
  populateActivePlayerSelect();
  return null;
}

function removeAllPlayer(id) {
  allPlayers    = allPlayers.filter(p => p.id !== id);
  activePlayers = activePlayers.filter(ap => ap.allPlayerId !== id);
  renderAllPlayers();
  populateActivePlayerSelect();
  renderActivePlayers();
  saveActivePlayersToStorage();
}

allPlayerList.addEventListener('click', e => {
  const btn = e.target.closest('.remove-btn');
  if (btn) removeAllPlayer(Number(btn.dataset.id));
});
allPlayerTableBody.addEventListener('click', e => {
  const btn = e.target.closest('.remove-btn');
  if (btn) removeAllPlayer(Number(btn.dataset.id));
});

document.getElementById('clear-all-players-btn').addEventListener('click', () => {
  if (allPlayers.length === 0) return;
  if (confirm('Remove all players? This will also clear active players.')) {
    allPlayers    = [];
    activePlayers = [];
    renderAllPlayers();
	populateActivePlayerSelect();
    renderActivePlayers();
    saveActivePlayersToStorage();
  }
});

allPlayerForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!validateAllPlayerForm()) return;
  const error = addAllPlayer(apNameInput.value.trim(), apSkillInput.value);
  if (error) {
	alert(error);
	return;
  }
  allPlayerForm.reset();
  apNameField.classList.remove('invalid');
});

// ---- CSV Import ----
const allPlayersCsvInput     = document.getElementById('all-players-csv-input');
const allPlayersImportResult = document.getElementById('all-players-import-result');

allPlayersCsvInput.addEventListener('change', () => {
  const file = allPlayersCsvInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const lines = reader.result.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      allPlayersImportResult.innerHTML = '<span class="summary">The file is empty.</span>';
      allPlayersImportResult.className = 'import-result error';
      return;
    }
    const rows = lines.slice(1);
    let added = 0;
    const errors = [];
    const skillNumbers = Object.keys(skillLabels)
    rows.forEach((line, i) => {
      const [name, skill] = line.split(',').map(c => c.trim());
      if (!name) { errors.push(`Row ${i + 2}: missing name`); return; }
      
      if (!skillNumbers.includes(skill)) { errors.push(`Row ${i + 2}: Skill must be one of ${skillNumbers.join(', ')}`); return; }
      const error = addAllPlayer(name, skill);
	  if (error) { errors.push(`Row ${i + 2}: ${error}`); return;}
      added++;
    });
    const summary = `Imported ${added} player${added === 1 ? '' : 's'}.` +
      (errors.length ? ` Skipped ${errors.length} row${errors.length === 1 ? '' : 's'}:` : '');
    if (errors.length) {
      allPlayersImportResult.innerHTML = `<span class="summary">${summary}</span><ul class="import-errors">${errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
      allPlayersImportResult.className = 'import-result error';
    } else {
      allPlayersImportResult.innerHTML = `<span class="summary">${summary}</span>`;
      allPlayersImportResult.className = 'import-result success';
    }
    allPlayersCsvInput.value = '';
  };
  reader.readAsText(file);
});

// ---- CSV Export ----
document.getElementById('export-all-players-btn').addEventListener('click', () => {
  if (allPlayers.length === 0) { alert('No players to export.'); return; }
  const csv = ['name,skill', ...allPlayers.map(p => `${p.name},${p.skill}`)].join('\r\n');
  const a   = document.createElement('a');
  a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'players.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
});


// ============================================================
// INIT — initial render on page load
// ============================================================
loadAllPlayersFromStorage();
renderAllPlayers();
