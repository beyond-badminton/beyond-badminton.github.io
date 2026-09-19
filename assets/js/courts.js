// ============================================================
// COURT NAMES
// ============================================================
const COURT_NAMES_STORAGE_KEY = "tournament-generator:courtNames";
const COURT_NAMES_NEXT_ID_KEY = "tournament-generator:courtNamesNextId";

let courtNames = [];
let nextCourtNameId = 1;

function loadCourtNamesFromStorage() {
	try {
		const saved = localStorage.getItem(COURT_NAMES_STORAGE_KEY);
		const savedId = localStorage.getItem(COURT_NAMES_NEXT_ID_KEY);
		if (saved) courtNames = JSON.parse(saved);
		if (savedId) nextCourtNameId = Number(savedId) || 1;
	} catch {
		courtNames = [];
		nextCourtNameId = 1;
	}

	renderCourtNames();
}

function saveCourtNamesToStorage() {
	try {
		localStorage.setItem(COURT_NAMES_STORAGE_KEY, JSON.stringify(courtNames));
		localStorage.setItem(COURT_NAMES_NEXT_ID_KEY, String(nextCourtNameId));
	} catch {}

	renderCourtNames();
}

function clearCourtNamesFromStorage() {
	courtNames = [];
	nextCourtNameId = 1;

	try {
		localStorage.removeItem(COURT_NAMES_STORAGE_KEY);
		localStorage.removeItem(COURT_NAMES_NEXT_ID_KEY);
	} catch {}

	renderCourtNames();
}

// DOM refs
const courtNameForm = document.getElementById("court-name-form");
const courtNameInput = document.getElementById("court-name");
const courtNameField = document.getElementById("court-name-field");
const courtNameList = document.getElementById("court-name-list");
const courtNameCount = document.getElementById("court-name-count");
const noCourtsHint = document.getElementById("no-courts-hint");

function renderCourtCheckboxes() {
	const previouslyChecked = new Set(
		Array.from(courtCheckboxList.querySelectorAll("input:checked")).map(
			(i) => i.value,
		),
	);
	courtCheckboxList.innerHTML = "";
	if (courtNames.length === 0) {
		courtCheckboxList.appendChild(noCourtsHint);
		return;
	}
	courtNames.forEach((court) => {
		const label = document.createElement("label");
		label.className = "checkbox-pill";
		const isChecked = previouslyChecked.has(court.name);
		if (isChecked) label.classList.add("checked");
		label.innerHTML = `<input type="checkbox" value="${court.name}" ${isChecked ? "checked" : ""}> ${court.name}`;
		courtCheckboxList.appendChild(label);
	});
}

function renderCourtNames() {
	courtNameList.innerHTML = "";
	courtNames.forEach((court) => {
		const li = document.createElement("li");
		li.className = "chip";
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
	const removed = courtNames.find((c) => c.id === id);
	if (removed && courtBlocks.some((b) => b.courts.includes(removed.name))) {
		alertDialog(
			`Cannot remove "${removed.name}" court`, "It is used in one or more court schedule blocks. Remove those scheduled blocks first.",
		);
		return;
	}
	courtNames = courtNames.filter((c) => c.id !== id);
	saveCourtNamesToStorage();
}

courtNameList.addEventListener("click", (e) => {
	const btn = e.target.closest(".chip-remove");
	if (btn) removeCourtName(Number(btn.dataset.id));
});

function validateCourtNameForm() {
	const value = courtNameInput.value.trim();
	const nameOk = value.length > 0;
	const uniqueOk =
		!nameOk ||
		!courtNames.some((c) => c.name.toLowerCase() === value.toLowerCase());
	const isValid = nameOk && uniqueOk;
	setCourtValid(courtNameField, isValid);

	return isValid ? value : null;
}

courtNameInput.addEventListener("input", () => {
	if (courtNameField.classList.contains("invalid")) validateCourtNameForm();
});

courtNameForm.addEventListener("submit", (e) => {
	e.preventDefault();
	const value = validateCourtNameForm();
	if (!value) return;
	addCourtName(value);
	courtNameForm.reset();
	courtNameField.classList.remove("invalid");
});

// ============================================================
// COURT SCHEDULE
// ============================================================
const COURTS_STORAGE_KEY = "tournament-generator:courts";
const COURTS_NEXT_ID_KEY = "tournament-generator:courtsNextId";

let courtBlocks = [];
let nextCourtId = 1;

function loadCourtsFromStorage() {
	try {
		const saved = localStorage.getItem(COURTS_STORAGE_KEY);
		const savedId = localStorage.getItem(COURTS_NEXT_ID_KEY);
		if (saved) courtBlocks = JSON.parse(saved);
		if (savedId) nextCourtId = Number(savedId) || 1;
	} catch {
		courtBlocks = [];
		nextCourtId = 1;
	}

	renderCourts();
}

function saveCourtsToStorage() {
	try {
		localStorage.setItem(COURTS_STORAGE_KEY, JSON.stringify(courtBlocks));
		localStorage.setItem(COURTS_NEXT_ID_KEY, String(nextCourtId));
	} catch {}

	renderCourts();
}

function clearCourtsFromStorage() {
	courtBlocks = [];
	nextCourtId = 1;

	try {
		localStorage.removeItem(COURTS_STORAGE_KEY);
		localStorage.removeItem(COURTS_NEXT_ID_KEY);
	} catch {}

	renderCourts();
}


function saveCourtsDataToStorage(data) {
	[
		COURTS_STORAGE_KEY,
		COURTS_NEXT_ID_KEY,
		COURT_NAMES_STORAGE_KEY,
		COURT_NAMES_NEXT_ID_KEY,
	].forEach((key) => {
		if (key in data) {
			const value = data[key];
			const toStore = typeof value === "string" ? value : JSON.stringify(value);
			localStorage.setItem(key, toStore);
		}
	});
}

function getCourtsDataFromStorage() {
	const data = {};
	[
		COURTS_STORAGE_KEY,
		COURTS_NEXT_ID_KEY,
		COURT_NAMES_STORAGE_KEY,
		COURT_NAMES_NEXT_ID_KEY
	].forEach((key) => {
		const value = localStorage.getItem(key);
		if (value !== null) {
			data[key] = value;
		}
	});
	return data;
}


// DOM refs
const courtForm = document.getElementById("court-form");
const courtTimeInput = document.getElementById("court-time");
const courtDurationInput = document.getElementById("court-duration");
const courtTimeField = document.getElementById("court-time-field");
const courtDurationField = document.getElementById("court-duration-field");
const courtSelectField = document.getElementById("court-select-field");
const courtCheckboxList = document.getElementById("court-checkbox-list");
const courtSubmitField = document.getElementById("court-submit-field");
const courtOverlapErrMsg = document.getElementById("court-overlap-errmsg");
const courtList = document.getElementById("court-list");
const courtTableBody = document.getElementById("court-table-body");
const courtsEmptyState = document.getElementById("courts-empty-state");
const courtBlockCount = document.getElementById("court-block-count");

function populateCourtDurationOptions() {
	for (let mins = 30; mins <= 8 * 60; mins += 30) {
		const opt = document.createElement("option");
		opt.value = String(mins);
		opt.textContent = formatDuration(mins);
		courtDurationInput.appendChild(opt);
	}
}

function setCourtValid(field, isValid) {
	field.classList.toggle("invalid", !isValid);
}

function getSelectedCourtNames() {
	return Array.from(courtCheckboxList.querySelectorAll("input:checked")).map(
		(i) => i.value,
	);
}

function validateCourtForm() {
	const timeOk = courtTimeInput.value !== "";
	const durationOk = courtDurationInput.value !== "";
	const selectedOk = getSelectedCourtNames().length > 0;

	setCourtValid(courtTimeField, timeOk);
	setCourtValid(courtDurationField, durationOk);
	setCourtValid(courtSelectField, selectedOk);
	return timeOk && durationOk && selectedOk;
}

function validateCourtAvailabilityForm() {
	const selectedCourts = getSelectedCourtNames();

	const timeOk = courtTimeInput.value !== "";
	const durationOk = courtDurationInput.value !== "";
	const selectedOk = selectedCourts.length > 0;

	if (!timeOk || !durationOk || !selectedOk) {
		setCourtValid(courtSubmitField, true);
		return true; // If any field is invalid, skip availability check
	}

	const startTime = courtTimeInput.value;
	const duration = Number(courtDurationInput.value);

	const failedCourts = courtBlocks.flatMap((block) => {
		const courtsInterection = selectedCourts.filter((name) =>
			block.courts.includes(name),
		);

		if (courtsInterection.length === 0) return [];

		const blockStart = timeToMins(block.start);
		const blockEnd = blockStart + block.duration;
		const newStart = timeToMins(startTime);
		const newEnd = newStart + duration;
		if (blockStart >= newEnd || blockEnd <= newStart) return [];
		return courtsInterection;
	});

	const orderedFailedCourts = [...new Set(failedCourts)].sort((a, b) =>
		a.localeCompare(b),
	);

	setCourtValid(courtSubmitField, failedCourts.length === 0);

	if (failedCourts.length > 0) {
		const failedCourtsList = orderedFailedCourts.join(", ");
		courtOverlapErrMsg.innerText = `${orderedFailedCourts.length > 1 ? "Courts" : "Court"} ${failedCourtsList} ${orderedFailedCourts.length > 1 ? "are" : "is"} already booked during this time`;
	}

	return failedCourts.length === 0;
}

courtTimeInput.addEventListener("change", () => {
	if (courtTimeField.classList.contains("invalid")) validateCourtForm();
	validateCourtAvailabilityForm();
});

courtDurationInput.addEventListener("change", () => {
	if (courtDurationField.classList.contains("invalid")) validateCourtForm();
	validateCourtAvailabilityForm();
});

courtCheckboxList.addEventListener("change", (e) => {
	if (e.target.matches('input[type="checkbox"]')) {
		e.target
			.closest(".checkbox-pill")
			.classList.toggle("checked", e.target.checked);
		if (courtSelectField.classList.contains("invalid")) validateCourtForm();
		validateCourtAvailabilityForm();
	}
});

courtForm.addEventListener("submit", (e) => {
	e.preventDefault();
	if (!validateCourtForm() || !validateCourtAvailabilityForm()) return;
	addCourtBlock(
		courtTimeInput.value,
		courtDurationInput.value,
		getSelectedCourtNames(),
	);
	courtForm.reset();
	renderCourtCheckboxes();
	[
		courtTimeField,
		courtDurationField,
		courtSelectField,
		courtSubmitField,
	].forEach((f) => {
		f.classList.remove("invalid");
	});
});

function updateCourtCount() {
	courtBlockCount.textContent = `(${courtBlocks.length})`;
	courtsEmptyState.style.display = courtBlocks.length === 0 ? "block" : "none";
}

function renderCourts() {
	courtList.innerHTML = "";
	courtTableBody.innerHTML = "";
	const sorted = [...courtBlocks].sort(
		(a, b) => a.start.localeCompare(b.start) || a.duration - b.duration,
	);
	sorted.forEach((block) => {
		const end = addMinsToTime(block.start, block.duration);
		const courtsLabel = block.courts.join(", ") || "—";
		const count = block.courts.length;

		const li = document.createElement("li");
		li.innerHTML = `
		<div class="info">
			<span class="name">${block.start} – ${end}</span>
			<span class="meta">${courtsLabel} · ${count} court${count === 1 ? "" : "s"}</span>
		</div>
		<button type="button" class="remove-btn" data-id="${block.id}">Remove</button>`;
		courtList.appendChild(li);

		const row = document.createElement("tr");
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
	courtBlocks.push({
		id: nextCourtId++,
		start,
		duration: Number(duration),
		courts,
	});
	saveCourtsToStorage();
}

function removeCourtBlock(id) {
	courtBlocks = courtBlocks.filter((b) => b.id !== id);
	saveCourtsToStorage();
}

courtList.addEventListener("click", (e) => {
	const btn = e.target.closest(".remove-btn");
	if (btn) removeCourtBlock(Number(btn.dataset.id));
});
courtTableBody.addEventListener("click", (e) => {
	const btn = e.target.closest(".remove-btn");
	if (btn) removeCourtBlock(Number(btn.dataset.id));
});

document.getElementById("clear-courts-btn").addEventListener("click", () => {
	if (courtBlocks.length === 0) return;
	if (confirm("Remove all court availability blocks?")) {
		clearCourtsFromStorage();
	}
});

// ============================================================
// INIT — initial render on page load
// ============================================================
loadCourtNamesFromStorage();
loadCourtsFromStorage();
populateTimeSelect(courtTimeInput);
populateCourtDurationOptions();


const courtsDataDesc = ["Court Names", "Court Schedule"];

window.StorageEvents.on(StorageEvents.Type.LOAD, courtsDataDesc, (data) => {
	saveCourtsDataToStorage(data);
	loadCourtNamesFromStorage();
	loadCourtsFromStorage();
});

window.StorageEvents.on(StorageEvents.Type.SAVE, courtsDataDesc, (data) => {
	return getCourtsDataFromStorage();
});

window.StorageEvents.on(StorageEvents.Type.HAS_PERMANENT_DATA, courtsDataDesc[0], (data) => {
	return courtNames.length > 0;
});

window.StorageEvents.on(StorageEvents.Type.DEL_PERMANENT_DATA, courtsDataDesc[0], (data) => {
	clearCourtNamesFromStorage();
});

window.StorageEvents.on(StorageEvents.Type.HAS_EVENT_DATA, courtsDataDesc[1], (data) => {
	return courtBlocks.length > 0;
});

window.StorageEvents.on(StorageEvents.Type.DEL_EVENT_DATA, courtsDataDesc[1], (data) => {
	clearCourtsFromStorage();
});
