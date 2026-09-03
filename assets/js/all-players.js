// ============================================================
// ALL PLAYERS
// ============================================================
const ALL_PLAYERS_KEY         = 'tournament-generator:allPlayers';
const ALL_PLAYERS_NEXT_ID_KEY = 'tournament-generator:allPlayersNextId';

const SKILL_LABELS = { '1': 'Beginner', '2': 'Intermediate', '3': 'Advanced', '4': 'Skilled' };

let allPlayers = [];
let nextAllPlayerId = 1;

// DOM refs
const allPlayerForm      = document.getElementById('all-player-form');
const apNameInput        = document.getElementById('ap-name');
const apSkillInput       = document.getElementById('ap-skill');
const apNameField        = document.getElementById('ap-name-field');
const allPlayerList      = document.getElementById('all-player-list');
const allPlayerTableBody = document.getElementById('all-player-table-body');
const allPlayersEmpty    = document.getElementById('all-players-empty');
const allPlayerCount     = document.getElementById('all-player-count');
const csvSkillCodes       = document.getElementById('csv-skill-codes');

function renderSkillPillHtml(skillId, clickable = false) {
	return `<span class="skill-pill skill-${skillId} ${clickable ? 'skill-pick' : ''}">${SKILL_LABELS[skillId] || skillId}</span>`;
}

function updateSkillPillElement(element, skillId, clickable = false) {
	element.className = `skill-pill skill-${skillId} ${clickable ? 'skill-pick' : ''}`;
	element.textContent = SKILL_LABELS[skillId] || skillId;
}

function populateAppSkillOptions() {
	csvSkillCodes.innerHTML="<code>skill</code> — " + Object.entries(SKILL_LABELS).map(([skillId, skillName]) => `<code>${skillId}</code> (${skillName})`).join(', ');
	Object.entries(SKILL_LABELS).forEach(([skillId, skillName]) => {
		const opt = document.createElement('option');
		opt.value       = skillId;
		opt.textContent = `${skillId} — ${skillName}`;
		apSkillInput.appendChild(opt);
	});
}
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
		<td>` + renderSkillPillHtml(p.skill, true) +`</td>
		<td><button type="button" class="remove-btn" data-id="${p.id}">Remove</button></td>`;
		allPlayerTableBody.appendChild(row);
	});

	allPlayerCount.textContent = `(${allPlayers.length})`;
	allPlayersEmpty.style.display = allPlayers.length === 0 ? 'block' : 'none';
	updateSortUI('all');
}

function addAllPlayer(name, skill) {
	if (allPlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
		return `Player "${name}" already exists.`;
	}
	allPlayers.push({ id: nextAllPlayerId++, name, skill });
	saveAllPlayersToStorage();
	populateActivePlayerSelect();
	return null;
}

function removeAllPlayer(id) {
	const isActive = activePlayers.some(ap => ap.allPlayerId === id);
	if (isActive && !confirm('This player is currently active. Removing them will also remove them from the active players list. Proceed?')) {
		return;
	}
	allPlayers    = allPlayers.filter(p => p.id !== id);
	activePlayers = activePlayers.filter(ap => ap.allPlayerId !== id);
	saveAllPlayersToStorage();
	saveActivePlayersToStorage();
}

function loadAllPlayersFromStorage() {
	try {
		const saved   = localStorage.getItem(ALL_PLAYERS_KEY);
		const savedId = localStorage.getItem(ALL_PLAYERS_NEXT_ID_KEY);
		if (saved)   allPlayers      = JSON.parse(saved);
		if (savedId) nextAllPlayerId = Number(savedId) || 1;
	} catch (err) { allPlayers = []; nextAllPlayerId = 1; }
	renderAllPlayers();
}

function saveAllPlayersToStorage(render = true) {
	try {
		localStorage.setItem(ALL_PLAYERS_KEY,         JSON.stringify(allPlayers));
		localStorage.setItem(ALL_PLAYERS_NEXT_ID_KEY, String(nextAllPlayerId));
	} catch (err) {}

	if (render) renderAllPlayers();
}

function clearAllPlayersFromStorage() {
	allPlayers = [];
	nextAllPlayerId = 1;
	try {
		localStorage.removeItem(ALL_PLAYERS_KEY);
		localStorage.removeItem(ALL_PLAYERS_NEXT_ID_KEY);
	} catch (err) {}
	renderAllPlayers();
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
		clearAllPlayersFromStorage();
		clearActivePlayersFromStorage();
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
		const skillNumbers = Object.keys(SKILL_LABELS)
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


// skill change
let currentPopover = null;

// 2. Delegate click event to skill pills inside the table
allPlayerTableBody.addEventListener('click', (event) => {
	const targetPill = event.target.closest('.skill-pill');
	if (!targetPill || targetPill.closest('.skill-picker-popover')) return;

	event.stopPropagation();
	openSkillPicker(targetPill);
});

function openSkillPicker(targetPill) {
	closeSkillPicker();

	// Create popover element
	const popover = document.createElement('div');
	popover.className = 'skill-picker-popover';

	// Apply positioning styles
	Object.assign(popover.style, {
		position: 'absolute',
		backgroundColor: '#ffffff',
		border: '1px solid var(--accent-soft)',
		borderRadius: '6px',
		padding: '6px 8px',
		boxShadow: '0 4px 12px var(--accent-soft)',
		zIndex: '1000',
		display: 'flex',
		gap: '6px'
	});

	// Calculate position relative to clicked pill
	const rect = targetPill.getBoundingClientRect();
	popover.style.top = `${rect.bottom + window.scrollY + 4}px`;
	popover.style.left = `${rect.left + window.scrollX}px`;

	// Retrieve player ID from the row's remove button or dataset
	const row = targetPill.closest('tr');
	const playerId = targetPill.dataset.id || row.querySelector('.remove-btn')?.dataset.id;

	// Build skill option pills
	Object.keys(SKILL_LABELS).forEach(skillId => {
		const option = document.createElement('span');
		updateSkillPillElement(option, skillId, true);

		option.addEventListener('click', (e) => {
			e.stopPropagation();

			// Update target pill UI

			// Callback hook for backend/API update
			onSkillChanged(targetPill, playerId, skillId);

			closeSkillPicker();
		});

		popover.appendChild(option);
	});

	document.body.appendChild(popover);
	currentPopover = popover;
}

function closeSkillPicker() {
	if (currentPopover) {
		currentPopover.remove();
		currentPopover = null;
	}
}

// 3. Backend callback placeholder
function onSkillChanged(targetPillElement, playerId, skillId) {
	const player = allPlayers.find(p => p.id === Number(playerId));
	if (player) {
		player.skill = skillId;
		saveAllPlayersToStorage(false);

		// here we can avoid to render all players again, just update the pill text and class
		updateSkillPillElement(targetPillElement, skillId, true);
		
		renderActivePlayers();
		renderGeneratedSchedule();
	}
}

// 4. Close popover on Escape key
document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape') {
		closeSkillPicker();
	}
});

// 5. Close popover when clicking outside
document.addEventListener('click', (event) => {
	if (currentPopover && !currentPopover.contains(event.target)) {
		closeSkillPicker();
	}
});

// ============================================================
// INIT — initial render on page load
// ============================================================
populateAppSkillOptions();
loadAllPlayersFromStorage();