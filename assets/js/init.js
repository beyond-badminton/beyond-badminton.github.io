// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

// ============================================================
// DISCARD ONGOING EVENTS
// ============================================================
async function discardEvents() {
	const hasData =
		StorageEvents.emit(StorageEvents.Type.HAS_EVENT_DATA, null).some(Boolean);
	if (
		hasData &&
		!await confirmDialog(
			`Discard all ongoing events?`,
			`This will discard ${StorageEvents.description(StorageEvents.Type.DEL_EVENT_DATA)}.`
		)
	) {
		return;
	}

	StorageEvents.emit(StorageEvents.Type.DEL_EVENT_DATA, null);
}

async function discardLocalStorage() {
	const hasData =
		StorageEvents.emit(StorageEvents.Type.HAS_PERMANENT_DATA, null).some(Boolean) ||
		StorageEvents.emit(StorageEvents.Type.HAS_EVENT_DATA, null).some(Boolean);

	if (!hasData) {
		return;
	}

	if (
		!await confirmDialog(
			`Discard all stored data?`,
			`To keep ${StorageEvents.description(StorageEvents.Type.DEL_PERMANENT_DATA)}, use the "Discard Events" button instead.`
		)
	) {
		return;
	}

	StorageEvents.emit(StorageEvents.Type.DEL_EVENT_DATA, null);
	StorageEvents.emit(StorageEvents.Type.DEL_PERMANENT_DATA, null);
}

// Save selected localStorage keys to a JSON file (opens a save dialog)
async function saveLocalStorageToFile() {
	const data = {};

	const dataFromEvents = StorageEvents.emit(StorageEvents.Type.SAVE, null);
	for (const eventData of dataFromEvents) {
		for (const [key, value] of Object.entries(eventData)) {
			data[key] = value; // merge event data into main data object
		}
	}

	const jsonString = JSON.stringify(data, null, 2);

	// Use File System Access API if available (Chrome, Edge, etc.)
	if (window.showSaveFilePicker) {
		try {
			const handle = await window.showSaveFilePicker({
				suggestedName: "storage-full-backup.json",
				types: [
					{
						description: "JSON File",
						accept: { "application/json": [".json"] },
					},
				],
			});
			const writable = await handle.createWritable();
			await writable.write(jsonString);
			await writable.close();
			return true;
		} catch (err) {
			if (err.name === "AbortError") return false; // user cancelled
			console.error("Save failed:", err);
			throw err;
		}
	} else {
		// Fallback: trigger a normal browser download
		const blob = new Blob([jsonString], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "storage-full-backup.json";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		return true;
	}
}

// Load a JSON file (opens a file picker) and write its keys back into localStorage
async function loadLocalStorageFromFile() {
	const hasData =
		StorageEvents.emit(StorageEvents.Type.HAS_PERMANENT_DATA, null).some(Boolean) ||
		StorageEvents.emit(StorageEvents.Type.HAS_EVENT_DATA, null).some(Boolean);
	if (
		hasData &&
		!await confirmDialog(
			"Load will replace all current data",
			"Are you sure you want to proceed?",
		)
	) {
		return;
	}
	let file;

	// Use File System Access API if available
	if (window.showOpenFilePicker) {
		try {
			const [handle] = await window.showOpenFilePicker({
				types: [
					{
						description: "JSON File",
						accept: { "application/json": [".json"] },
					},
				],
				multiple: false,
			});
			file = await handle.getFile();
		} catch (err) {
			if (err.name === "AbortError") return false; // user cancelled
			console.error("Open failed:", err);
			throw err;
		}
	} else {
		// Fallback: use a hidden <input type="file">
		file = await new Promise((resolve) => {
			const input = document.createElement("input");
			input.type = "file";
			input.accept = "application/json";
			input.onchange = () => resolve(input.files[0] || null);
			input.click();
		});
		if (!file) return false;
	}

	const text = await file.text();
	const data = JSON.parse(text);

	StorageEvents.emit(StorageEvents.Type.LOAD, data);

	return true;
}

document.getElementById("export-storage-btn").addEventListener("click", () => {
	saveLocalStorageToFile().catch((err) => {
		alertDialog("Failed to save file", err.message);
	});
});
document.getElementById("import-storage-btn").addEventListener("click", () => {
	loadLocalStorageFromFile().catch((err) => {
		alertDialog("Failed to load file", err.message);
	});
});
document.getElementById("discard-storage-btn").addEventListener("click", () => {
	discardLocalStorage();
});
document.getElementById("discard-event-btn").addEventListener("click", () => {
	discardEvents();
});
