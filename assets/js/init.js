// ============================================================
// DISCARD TOURNAMENT
// ============================================================
async function discardTournament() {
	const hasData = activePlayers.length > 0 || courtBlocks.length > 0 /*|| courtNames.length > 0*/;
	if (hasData && !confirm('Discard this tournament? Active players, courts, and availability will be removed. The All players list and the Court names are kept.')) {
		return;
	}

	clearGeneratedScheduleFromStorage();
	clearCourtsFromStorage();
	clearActivePlayersFromStorage();
}

async function discardLocalStorane() {
	const hasData = allPlayers.length > 0 || activePlayers.length > 0 || courtBlocks.length > 0 || courtNames.length > 0;
	if (hasData && !confirm('This will discard all data. Are you sure you want to proceed? To keep All players and Court names, use the "Discard Tournament" button instead.')) {
		return;
	}

	clearGeneratedScheduleFromStorage();
	clearCourtsFromStorage();
	clearCourtNamesFromStorage();
	clearActivePlayersFromStorage();
	clearAllPlayersFromStorage();
}

const STORAGE_KEYS = [
	ALL_PLAYERS_KEY,
	ALL_PLAYERS_NEXT_ID_KEY,
	ACTIVE_PLAYERS_KEY,
	ACTIVE_PLAYERS_NEXT_ID_KEY,
	COURT_NAMES_STORAGE_KEY,
	COURT_NAMES_NEXT_ID_KEY,
	COURTS_STORAGE_KEY,
	COURTS_NEXT_ID_KEY,
	SCHEDULE_KEY,
	SCORES_KEY
];

// Save selected localStorage keys to a JSON file (opens a save dialog)
async function saveLocalStorageToFile() {
	const data = {};
	for (const key of STORAGE_KEYS) {
		const value = localStorage.getItem(key);
		if (value !== null) {
			try {
				data[key] = JSON.parse(value); // store as parsed JSON if possible
			} catch {
				data[key] = value; // fallback to raw string
			}
		}
	}

	const jsonString = JSON.stringify(data, null, 2);

	// Use File System Access API if available (Chrome, Edge, etc.)
	if (window.showSaveFilePicker) {
		try {
			const handle = await window.showSaveFilePicker({
				suggestedName: 'tournament-full-backup.json',
				types: [{
					description: 'JSON File',
					accept: { 'application/json': ['.json'] }
				}]
			});
			const writable = await handle.createWritable();
			await writable.write(jsonString);
			await writable.close();
			return true;
		} catch (err) {
			if (err.name === 'AbortError') return false; // user cancelled
			console.error('Save failed:', err);
			throw err;
		}
	} else {
		// Fallback: trigger a normal browser download
		const blob = new Blob([jsonString], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'tournament-full-backup.json';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		return true;
	}
}

// Load a JSON file (opens a file picker) and write its keys back into localStorage
async function loadLocalStorageFromFile() {
	if (!confirm('This will discard all current data. Are you sure you want to proceed?')) {
		return;
	}
	let file;

	// Use File System Access API if available
	if (window.showOpenFilePicker) {
		try {
			const [handle] = await window.showOpenFilePicker({
				types: [{
					description: 'JSON File',
					accept: { 'application/json': ['.json'] }
				}],
				multiple: false
			});
			file = await handle.getFile();
		} catch (err) {
			if (err.name === 'AbortError') return false; // user cancelled
			console.error('Open failed:', err);
			throw err;
		}
	} else {
		// Fallback: use a hidden <input type="file">
		file = await new Promise((resolve, reject) => {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'application/json';
			input.onchange = () => resolve(input.files[0] || null);
			input.click();
		});
		if (!file) return false;
	}

	const text = await file.text();
	const data = JSON.parse(text);

	for (const key of STORAGE_KEYS) {
		if (key in data) {
			const value = data[key];
			const toStore = typeof value === 'string' ? value : JSON.stringify(value);
			localStorage.setItem(key, toStore);
		}
	}

	loadAllPlayersFromStorage();
	loadActivePlayersFromStorage();
	loadCourtNamesFromStorage();
	loadCourtsFromStorage();
	loadGeneratedScheduleFromStorage();

	return true;
}

document.getElementById('export-storage-btn').addEventListener('click', () => { saveLocalStorageToFile().catch(err => alert('Error saving file: ' + err.message)); });
document.getElementById('import-storage-btn').addEventListener('click', () => { loadLocalStorageFromFile().catch(err => alert('Error loading file: ' + err.message)); });
document.getElementById('discard-storage-btn').addEventListener('click', () => { discardLocalStorane(); });
document.getElementById('discard-tournament-btn').addEventListener('click', () => { discardTournament(); });

