// ============================================================
// COURT NAMES
// ============================================================
const COURT_NAMES_STORAGE_KEY = 'tournament-generator:courtNames';
const COURT_NAMES_NEXT_ID_KEY = 'tournament-generator:courtNamesNextId';

let courtNames      = [];
let nextCourtNameId = 1;

function loadCourtNamesFromStorage() {
	try {
		const saved   = localStorage.getItem(COURT_NAMES_STORAGE_KEY);
		const savedId = localStorage.getItem(COURT_NAMES_NEXT_ID_KEY);
		if (saved)   courtNames      = JSON.parse(saved);
		if (savedId) nextCourtNameId = Number(savedId) || 1;
	} catch (err) { courtNames = []; nextCourtNameId = 1; }

	renderCourtNames();
}

function saveCourtNamesToStorage() {
	try {
		localStorage.setItem(COURT_NAMES_STORAGE_KEY, JSON.stringify(courtNames));
		localStorage.setItem(COURT_NAMES_NEXT_ID_KEY, String(nextCourtNameId));
	} catch (err) {}
	
	renderCourtNames();
}

function clearCourtNamesFromStorage() {
	courtNames      = [];
	nextCourtNameId = 1;

	try {
		localStorage.removeItem(COURT_NAMES_STORAGE_KEY);
		localStorage.removeItem(COURT_NAMES_NEXT_ID_KEY);
	} catch (err) {}

	renderCourtNames();
}

// DOM refs
const courtNameForm     = document.getElementById('court-name-form');
const courtNameInput    = document.getElementById('court-name');
const courtNameField    = document.getElementById('court-name-field');
const courtNameList     = document.getElementById('court-name-list');
const courtNameCount    = document.getElementById('court-name-count');
const courtCheckboxList = document.getElementById('court-checkbox-list');
const noCourtsHint      = document.getElementById('no-courts-hint');

function renderCourtCheckboxes() {
	const previouslyChecked = new Set(
		Array.from(courtCheckboxList.querySelectorAll('input:checked')).map(i => i.value)
	);
	courtCheckboxList.innerHTML = '';
	if (courtNames.length === 0) { courtCheckboxList.appendChild(noCourtsHint); return; }
	courtNames.forEach(court => {
		const label     = document.createElement('label');
		label.className = 'checkbox-pill';
		const isChecked = previouslyChecked.has(court.name);
		if (isChecked) label.classList.add('checked');
		label.innerHTML = `<input type="checkbox" value="${court.name}" ${isChecked ? 'checked' : ''}> ${court.name}`;
		courtCheckboxList.appendChild(label);
	});
}

courtCheckboxList.addEventListener('change', e => {
	if (e.target.matches('input[type="checkbox"]')) {
		e.target.closest('.checkbox-pill').classList.toggle('checked', e.target.checked);
		if (courtSelectField.classList.contains('invalid')) validateCourtForm();
	}
});

function renderCourtNames() {
	courtNameList.innerHTML = '';
	courtNames.forEach(court => {
		const li     = document.createElement('li');
		li.className = 'chip';
		li.innerHTML = `${court.name} <button type="button" class="chip-remove" data-id="${court.id}" aria-label="Remove ${court.name}">&times;</button>`;
		courtNameList.appendChild(li);
	});
	courtNameCount.textContent = `(${courtNames.length})`;
	renderCourtCheckboxes();
}

function addCourtName(name) {
	courtNames.push({ id: nextCourtNameId++, name });
	saveCourtNamesToStorage();
}

function removeCourtName(id) {
	const removed = courtNames.find(c => c.id === id);
	if (removed && courtBlocks.some(b => b.courts.includes(removed.name))) {
		alert(`Cannot remove "${removed.name}" — it is used in one or more court availability blocks. Remove those blocks first.`);
		return;
	}
	courtNames = courtNames.filter(c => c.id !== id);
	saveCourtNamesToStorage();
}

courtNameList.addEventListener('click', e => {
	const btn = e.target.closest('.chip-remove');
	if (btn) removeCourtName(Number(btn.dataset.id));
});

function validateCourtNameForm() {
	const value    = courtNameInput.value.trim();
	const nameOk   = value.length > 0;
	const uniqueOk = !nameOk || !courtNames.some(c => c.name.toLowerCase() === value.toLowerCase());
	const isValid  = nameOk && uniqueOk;
	setCourtValid(courtNameField, isValid);
	return isValid ? value : null;
}

courtNameInput.addEventListener('input', () => {
  if (courtNameField.classList.contains('invalid')) validateCourtNameForm();
});

courtNameForm.addEventListener('submit', e => {
	e.preventDefault();
	const value = validateCourtNameForm();
	if (!value) return;
	addCourtName(value);
	courtNameForm.reset();
	courtNameField.classList.remove('invalid');
});

// ============================================================
// COURT SCHEDULE
// ============================================================
const COURTS_STORAGE_KEY = 'tournament-generator:courts';
const COURTS_NEXT_ID_KEY = 'tournament-generator:courtsNextId';

let courtBlocks = [];
let nextCourtId = 1;

function loadCourtsFromStorage() {
	try {
		const saved   = localStorage.getItem(COURTS_STORAGE_KEY);
		const savedId = localStorage.getItem(COURTS_NEXT_ID_KEY);
		if (saved)   courtBlocks = JSON.parse(saved);
		if (savedId) nextCourtId = Number(savedId) || 1;
	} catch (err) { courtBlocks = []; nextCourtId = 1; }

	renderCourts();
}

function saveCourtsToStorage() {
	try {
		localStorage.setItem(COURTS_STORAGE_KEY, JSON.stringify(courtBlocks));
		localStorage.setItem(COURTS_NEXT_ID_KEY, String(nextCourtId));
	} catch (err) {}

	renderCourts();
}

function clearCourtsFromStorage() {
	courtBlocks = [];
	nextCourtId = 1;

	try {
		localStorage.removeItem(COURTS_STORAGE_KEY);
		localStorage.removeItem(COURTS_NEXT_ID_KEY);
	} catch (err) {}
	
	renderCourts();
}

// DOM refs
const courtForm          = document.getElementById('court-form');
const courtTimeInput     = document.getElementById('court-time');
const courtDurationInput = document.getElementById('court-duration');
const courtTimeField     = document.getElementById('court-time-field');
const courtDurationField = document.getElementById('court-duration-field');
const courtSelectField   = document.getElementById('court-select-field');
const courtList          = document.getElementById('court-list');
const courtTableBody     = document.getElementById('court-table-body');
const courtsEmptyState   = document.getElementById('courts-empty-state');
const courtBlockCount    = document.getElementById('court-block-count');

// Populate time & duration dropdowns
(function populateCourtTimeOptions() {
	for (let mins = 8 * 60; mins <= 20 * 60; mins += 30) {
		const h = String(Math.floor(mins / 60)).padStart(2, '0');
		const m = String(mins % 60).padStart(2, '0');
		const opt = document.createElement('option');
		opt.value = opt.textContent = `${h}:${m}`;
		courtTimeInput.appendChild(opt);
	}
})();

function formatDuration(mins) {
	const h = Math.floor(mins / 60), m = mins % 60;
	if (h === 0) return `${m} min`;
	if (m === 0) return `${h}h`;
	return `${h}h ${m}m`;
}

(function populateCourtDurationOptions() {
	for (let mins = 30; mins <= 8 * 60; mins += 30) {
		const opt = document.createElement('option');
		opt.value       = String(mins);
		opt.textContent = formatDuration(mins);
		courtDurationInput.appendChild(opt);
	}
})();

function addMinutesToTime(time, minsToAdd) {
	const [h, m] = time.split(':').map(Number);
	const total  = h * 60 + m + minsToAdd;
	return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function setCourtValid(field, isValid) { field.classList.toggle('invalid', !isValid); }

function getSelectedCourtNames() {
	return Array.from(courtCheckboxList.querySelectorAll('input:checked')).map(i => i.value);
}

function validateCourtForm() {
	const timeOk     = courtTimeInput.value !== '';
	const durationOk = courtDurationInput.value !== '';
	const selectedOk = getSelectedCourtNames().length > 0;
	setCourtValid(courtTimeField,     timeOk);
	setCourtValid(courtDurationField, durationOk);
	setCourtValid(courtSelectField,   selectedOk);
	return timeOk && durationOk && selectedOk;
}

courtTimeInput.addEventListener('change',     () => { if (courtTimeField.classList.contains('invalid'))     validateCourtForm(); });
courtDurationInput.addEventListener('change', () => { if (courtDurationField.classList.contains('invalid')) validateCourtForm(); });

function updateCourtCount() {
	courtBlockCount.textContent    = `(${courtBlocks.length})`;
	courtsEmptyState.style.display = courtBlocks.length === 0 ? 'block' : 'none';
}

function renderCourts() {
	courtList.innerHTML      = '';
	courtTableBody.innerHTML = '';
	const sorted = [...courtBlocks].sort((a, b) => a.start.localeCompare(b.start));
	sorted.forEach(block => {
		const end         = addMinutesToTime(block.start, block.duration);
		const courtsLabel = block.courts.join(', ') || '—';
		const count       = block.courts.length;

		const li = document.createElement('li');
		li.innerHTML = `
		<div class="info">
			<span class="name">${block.start} – ${end}</span>
			<span class="meta">${courtsLabel} · ${count} court${count === 1 ? '' : 's'}</span>
		</div>
		<button type="button" class="remove-btn" data-id="${block.id}">Remove</button>`;
		courtList.appendChild(li);

		const row = document.createElement('tr');
		row.innerHTML = `
		<td>${block.start} – ${end}</td>
		<td>${courtsLabel}</td>
		<td>${count}</td>
		<td><button type="button" class="remove-btn" data-id="${block.id}">Remove</button></td>`;
		courtTableBody.appendChild(row);
	});
	updateCourtCount();
}

function addCourtBlock(start, duration, courts) {
	courtBlocks.push({ id: nextCourtId++, start, duration: Number(duration), courts });
	saveCourtsToStorage();
}

function removeCourtBlock(id) {
	courtBlocks = courtBlocks.filter(b => b.id !== id);
	saveCourtsToStorage();
}

courtList.addEventListener('click', e => {
	const btn = e.target.closest('.remove-btn');
	if (btn) removeCourtBlock(Number(btn.dataset.id));
});
courtTableBody.addEventListener('click', e => {
	const btn = e.target.closest('.remove-btn');
	if (btn) removeCourtBlock(Number(btn.dataset.id));
});

document.getElementById('clear-courts-btn').addEventListener('click', () => {
	if (courtBlocks.length === 0) return;
	if (confirm('Remove all court availability blocks?')) { clearCourtsFromStorage(); }
});

courtForm.addEventListener('submit', e => {
	e.preventDefault();
	if (!validateCourtForm()) return;
	addCourtBlock(courtTimeInput.value, courtDurationInput.value, getSelectedCourtNames());
	courtForm.reset();
	renderCourtCheckboxes();
	[courtTimeField, courtDurationField, courtSelectField].forEach(f => f.classList.remove('invalid'));
});


// ============================================================
// INIT — initial render on page load
// ============================================================
loadCourtNamesFromStorage();
loadCourtsFromStorage();