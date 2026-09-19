// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";
function createEventBus(Type) {
	const callbacks = Object.fromEntries(Object.values(Type).map(t => [t, []]));

	function on(eventType, description, callback) {
		callbacks[eventType].push([callback, description]);
	}

	function emit(eventType, payload) {
		return callbacks[eventType].map(([cb]) => cb(payload));
	}

	function descriptions(eventType) {
		return callbacks[eventType].map(([, description]) => description).flat(); // in case description is an array
	}

	function description(eventType) {
		const desc = descriptions(eventType);
		if (desc.length === 0) return null;
		if (desc.length === 1) return `'${desc[0]}'`;
		return `'${desc.slice(0, -1).join("', '")}' and/or '${desc[desc.length - 1]}'`;
	}

	return { Type, on, emit, description, descriptions };
}

window.StorageEvents = createEventBus(Object.freeze({
	SAVE: 'save', // Emitted when data is saved to file, callback accepts no arguments, key-value object should be returned
	LOAD: 'load', // Emitted when data is loaded from file, key-value object is passed to the callback
	HAS_PERMANENT_DATA: 'has_permanent_data', // Emitted when checking if permanent data are present, callback accepts no arguments, callback should return a boolean
	HAS_EVENT_DATA: 'has_event_data', // Emitted when checking if event related data are present, callback accepts no arguments, callback should return a boolean
	DEL_PERMANENT_DATA: 'del_permanent_data', // Emitted when permanent data should be discarded, callback accepts no arguments
	DEL_EVENT_DATA: 'del_event_data' // Emitted when event data should be discarded, callback accepts no arguments
}));

const PLAYER_EVENTS = Object.freeze({
	ADD: 'add', // Emitted when new player is added, callback accepts new player ID as argument
	DEL: 'del', // Emitted when a player is deleted, callback accepts deleted player ID as argument
	HAS: 'has', // Emitted when checking if a player is present, callback accepts player ID as argument, callback should return a boolean, on true deletion can be performed
	MUST: 'must', // Emitted when checking if a player is present, callback accepts player ID as argument, callback should return a boolean, on true deletion must not be performed
	CLEAR: 'clear', // Emitted when all players are cleared, callback accepts no arguments
	UPDATE: 'update' // Emitted when a player is updated, callback accepts updated player ID as argument
});

window.PlayerEvents = createEventBus(PLAYER_EVENTS);
window.ActivePlayerEvents = createEventBus(PLAYER_EVENTS);