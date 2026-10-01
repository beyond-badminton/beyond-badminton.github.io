// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

//------------------------------------------------------------
// Initialization
//------------------------------------------------------------

const genQualificationConfirmBtn = document.getElementById("gen-qualification-confirm-btn");
const genQualificationConfirmEmpty = document.getElementById("gen-qualification-confirm-empty");
const genQualificationStartBtn = document.getElementById("gen-qualification-start-btn");
const qualificationDrawSubmitButton = document.getElementById("submit-qualification-draw-btn");
const genClearTournamentBtn = document.getElementById("gen-clear-tournament-btn");
const qualificationDrawClearButton = document.getElementById("clear-qualification-draw-btn");
const genGenerateTournamentBtn = document.getElementById("gen-generate-tournament-btn");
const genLiveTournamentLink = document.querySelector('a[href="tournament-live.html"]');
const genQualificationDrawCard = document.getElementById("gen-qualification-draw-card");
const genQualificationRoundsCard = document.getElementById("gen-qualification-rounds-card");
const genQualificationStatsCard = document.getElementById("gen-qualification-stats-card");
const genQualificationP2PStatsCard = document.getElementById("qualification-p2p-stats-table").closest(".card");

function allMatchesComplete() {
	const scores = Object.values(qualificationScores);
	return scores.length === (tournamentConfig.matchesPerPlayer * tournamentPlayers.length) / 4 && scores.every((score) => score.a !== score.b);
}

function openWithdrawPlayerDialog(player) {
	return openDialog(
		`${player.withdrawn ? "Undo" : "Confirm"} Player Withdrawal`,
		player.withdrawn
			? null
			: "The withdrawn player will remain in qualification matches to keep generated results consistent. A replacement player must be assigned to take their place.",
		true,
		player.name,
	);
}

function renderQualificationDrawClearButton() {
	qualificationDrawClearButton.disabled = tournamentConfig.qualificationDrawConfirmed;
}

function renderQualificationDrawSubmitButton() {
	const disabled = tournamentConfig.qualificationDrawConfirmed || tournamentPlayers.some((player) => player.pick === 0);
	qualificationDrawSubmitButton.disabled = disabled;
	qualificationDrawSubmitButton.hidden = disabled;
}

function renderQualificationStartButton() {
	const manualEdit =
		tournamentConfig.qualificationDrawConfirmed && !tournamentConfig.qualificationStarted && tournamentConfig.twoMenVsTwoWomen === "manual";

	genQualificationStartBtn.hidden = !manualEdit;
	genQualificationStartBtn.disabled = !manualEdit;
}

function renderQualificationConfirmation() {
	const confirmButtonShow =
		tournamentConfig.qualificationStarted &&
		!tournamentConfig.qualificationFinished &&
		(tournamentConfig?.matchesPerPlayer || 0) > 0 &&
		allMatchesComplete();

	genQualificationConfirmEmpty.hidden = confirmButtonShow;
	genQualificationConfirmBtn.disabled = !confirmButtonShow;
	genQualificationConfirmBtn.hidden = !confirmButtonShow;
}

function renderTournamentStats() {
	renderQualificationConfirmation();
	renderQualificationPlayerStats();
	renderQualificationP2PStats();
}

function renderTournament() {
	const hasTournamentValue = hasTournament();

	//console.log("Rendering tournament, hasTournament:", hasTournamentValue);

	genClearTournamentBtn.hidden = !hasTournamentValue;
	genPrintTournamentBtn.hidden = !hasTournamentValue;
	genLiveTournamentLink.hidden = !hasTournamentValue;
	genExportTournamentBtn.hidden = !hasTournamentValue;
	genTournamentEmpty.hidden = hasTournamentValue;
	genQualificationDrawCard.hidden = !hasTournamentValue;
	genQualificationRoundsCard.hidden = !hasTournamentValue;
	genQualificationStatsCard.hidden = !tournamentConfig?.qualificationStarted;
	renderQualificationDrawClearButton();
	renderQualificationDrawSubmitButton();
	renderQualificationStartButton();

	if (!hasTournamentValue) {
		genTournamentDatePicker.valueAsDate = null;
		renderTournamentStats();
		return;
	}

	genTournamentDatePicker.valueAsDate = tournamentConfig.tournamentDate ? new Date(tournamentConfig.tournamentDate) : null;

	rankPlayers(tournamentPlayersMap);

	renderQualificationDraw();

	renderQualificationMatchFilter();

	renderQualificationRounds();

	renderQualificationP2PFilter();

	renderTournamentStats();
}

function initTournament() {
	initQualificationRoundsRenderer({ offset: 1, size: 4 });
	initQualificationDrawRenderer();
	initQualificationPlayerStatsRenderer();
	initQualificationP2PStatsRenderer();
	loadTournamentFromStorage();
	renderTournament();

	genGenerateTournamentBtn.addEventListener("click", async () => {
		if (hasTournament() && !(await confirmDialog("Replace the ongoing tournament with a new one?"))) return;
		if (!genqualificationRoundsNum.value || Number.isNaN(genqualificationRoundsNum.value) || genqualificationRoundsNum.value <= 0) {
			alertDialog(null, "Please enter the number of qualification rounds.");
			return;
		}

		if ((activePlayers.length || 0) < 4) {
			alertDialog(null, "There must be at least 4 active players.");
			return;
		}

		if (genDTwoMenVsTwoWomenSelect.value !== "enabled") {
			const playersWithoutGender = activePlayers.filter((player) => playerGender(player.allPlayerId) === "x");
			if (playersWithoutGender.length > 0) {
				alertDialog("Players missing gender", [
					`To '${genDTwoMenVsTwoWomenSelect.options[genDTwoMenVsTwoWomenSelect.selectedIndex].text}', all players must have a specified gender.`,
					`Update players: ${playersWithoutGender.map((player) => playerName(player.allPlayerId)).join(", ")}`,
				]);
				return;
			}
		}

		if ((genqualificationRoundsNum.value * activePlayers.length) % 4 > 0) {
			alertDialog(
				"The total number of matches must be divisible by 4",
				"Please adjust the number of qualification rounds or the number of active players accordingly.",
			);
			return;
		}

		resetQualificationRoundsRenderer();
		resetQualificationP2PStatsRenderer();

		generateTournament(activePlayers, courtBlocks);
		renderTournament();
	});
	genPrintTournamentBtn.addEventListener("click", () => {
		const tournamentSchedule = { rounds: qualificationRounds };
		printSchedule(
			"Tournament",
			tournamentSchedule,
			new Date(tournamentConfig.tournamentDate),
			qualificationScores,
			false,
			false,
			tournamentPlayerName,
		);
	});
	genExportTournamentBtn.addEventListener("click", () => {
		const tournamentSchedule = { rounds: qualificationRounds };
		downloadScheduleSpreadsheet(
			"Tournament",
			tournamentSchedule,
			new Date(tournamentConfig.tournamentDate),
			qualificationScores,
			false,
			false,
			tournamentPlayerName,
		);
	});

	qualificationDrawPickField.addEventListener("change", renderQualificationDrawSubmitButton);
	genClearTournamentBtn.addEventListener("click", async () => {
		if (!(await confirmDialog("Discard the ongoing tournament?"))) return;
		clearGeneratedTournamentFromStorage();
		renderTournament();
	});
	qualificationDrawClearButton.addEventListener("click", async () => {
		if (!(await confirmDialog("Clear these drawn numbers?"))) return;

		tournamentPlayers.forEach((player) => {
			player.pick = 0;
		});
		currentDrawPlayerId = null;
		saveTournamentPlayers();
		renderQualificationDraw();
		renderQualificationDrawSubmitButton();
	});
	genQualificationDrawTableBody.addEventListener("click", async (event) => {
		if (!event.target.closest(".remove-btn")) return;

		const player = tournamentPlayersMap.get(Number(event.target.dataset.id));
		if (!player) return;

		if (tournamentConfig.qualificationDrawConfirmed) {
			if (await openWithdrawPlayerDialog(player)) {
				player.withdrawn = !(player.withdrawn || false);
				saveTournamentPlayers();
				renderTournament();
			}
			return;
		}

		player.pick = 0;
		saveTournamentPlayers();
		renderQualificationDraw();
		renderQualificationDrawSubmitButton();
	});

	genQualificationStartBtn.addEventListener("click", async () => {
		if (await confirmDialog("Start qualification with these matchups?", "This action cannot be undone.")) {
			tournamentConfig.qualificationStarted = true;
			saveTournamentConfig();
			renderTournament();
		}
	});

	qualificationDrawSubmitButton.addEventListener("click", async () => {
		if (tournamentPlayers.some((player) => player.pick === 0)) {
			alertDialog(null, "Please complete the qualification draw for all players before confirming");
			return;
		}

		if (!(await confirmDialog("Confirm these drawn numbers?", "This action cannot be undone."))) return;

		reassignQualificationMatches();
		tournamentConfig.qualificationDrawConfirmed = true;
		tournamentConfig.qualificationStarted = tournamentConfig.twoMenVsTwoWomen !== "manual";
		saveTournamentConfig();

		if (tournamentConfig.twoMenVsTwoWomen === "manual") {
			let menVsWomenMatchFound = false;
			for (const round of qualificationRounds) {
				for (const match of round.matches) {
					if (!allManVsAllWomanMatch(match)) continue;
					menVsWomenMatchFound = true;
					match.editable = true;
				}
			}

			if (!menVsWomenMatchFound) {
				alertDialog("Qualification started", "No '2 Men vs 2 Women' matches found. No edit mode required.");
				tournamentConfig.qualificationStarted = true;
				saveTournamentConfig();
			} else {
				saveQualificationRounds();
				alertDialog("Entering edit mode", "A '2 Men vs 2 Women' match was found. Check the matches before starting the qualification.");
			}
		}

		renderTournament();
	});

	genQualificationConfirmBtn.addEventListener("click", async () => {
		if (await confirmDialog("Confirm qualification results and proceed to the playoffs?", "This action cannot be undone.")) {
			tournamentConfig.qualificationFinished = true;
			saveTournamentConfig();
			renderTournament();
		}
	});

	genQualificationOut.addEventListener("change", (event) => {
		const input = event.target.closest(".gen-score-input");
		if (!input) return;

		const value = input.value === "" ? null : Number(input.value);
		if (value !== null && value < 0) {
			input.value = "";
			return;
		}

		const { matchId, side } = input.dataset;
		const match = findQualificationMatch(matchId);
		const previousScore = qualificationScores[matchId] || { a: null, b: null };

		if (match) revertMatchScore(tournamentPlayersMap, match, previousScore);
		if (!qualificationScores[matchId]) qualificationScores[matchId] = { a: null, b: null };

		qualificationScores[matchId][side] = value;
		if (match) applyMatchScore(tournamentPlayersMap, match, qualificationScores[matchId]);

		saveTournamentPlayers();
		saveQualificationScores();
		updateScoreUI(qualificationScores[matchId], input);
		renderTournamentStats();
	});

	const tournamentDataDesc = "Tournament";

	window.StorageEvents.on(StorageEvents.Type.LOAD, tournamentDataDesc, (data) => {
		saveTournamentDataToStorage(data);
		loadTournamentFromStorage();
		renderTournament();
	});

	window.StorageEvents.on(StorageEvents.Type.SAVE, tournamentDataDesc, () => {
		return getTournamentDataFromStorage();
	});

	window.StorageEvents.on(StorageEvents.Type.DEL_EVENT_DATA, tournamentDataDesc, () => {
		clearGeneratedTournamentFromStorage();
		renderTournament();
	});

	window.StorageEvents.on(StorageEvents.Type.HAS_EVENT_DATA, tournamentDataDesc, () => {
		return (tournamentConfig?.matchesPerPlayer || 0) > 0;
	});

	window.PlayerEvents.on(PlayerEvents.Type.MUST, tournamentDataDesc, (id) => {
		return tournamentPlayersMap.has(id);
	});

	document.getElementById("tournament-section").addEventListener("keydown", (event) => {
		if (event.key !== "Escape") return;

		const focusedControl = document.activeElement;
		if (focusedControl instanceof HTMLElement && focusedControl.matches("input, select, textarea")) {
			focusedControl.blur();
		}
	});

	document.addEventListener("keydown", (event) => {
		if (
			!document.getElementById("tournament-section").classList.contains("active") ||
			!event.altKey ||
			event.ctrlKey ||
			event.metaKey ||
			(event.shiftKey && event.key.toLowerCase() !== "s")
		) {
			return;
		}

		const shortcuts = {
			p: genQualificationP2PFilterPlayoffCheckbox,
			b: genQualificationMatchFilterNoBench,
			n: genQualificationMatchFilterDrawnNumbers,
			a: genQualificationMatchFilterActiveWindow,
		};
		const destinations = {
			d: genQualificationDrawCard,
			r: genQualificationRoundsCard,
			s: genQualificationStatsCard,
			"shift+s": genQualificationP2PStatsCard,
		};
		const shortcut = event.shiftKey ? `shift+${event.key.toLowerCase()}` : event.key.toLowerCase();
		const destination = destinations[shortcut];
		if (destination) {
			event.preventDefault();
			destination.scrollIntoView({ behavior: "smooth", block: "start" });
			return;
		}

		const checkbox = shortcuts[event.key.toLowerCase()];
		if (!checkbox) return;

		event.preventDefault();
		checkbox.click();
	});
}

initTournament();
