// biome-ignore lint/suspicious/noRedundantUseStrict: required for global scripts loaded via <script> tags
"use strict";

// ---------------------------------------------------------------------------
// Shared schedule "view model" builder
// ---------------------------------------------------------------------------
// Both exports (Excel via downloadScheduleSpreadsheet, and print/PDF via
// printSchedule) turn a `schedule` into the same sequence of "round
// blocks": a round number, its matches (with a formatted score string and
// joined team names), its bench players, and whether the bench row should
// be shown at all - plus the optional synthetic "extra match" round
// appended at the end. Centralizing that computation here means the two
// renderers can't drift apart on scoring / extra-match / empty-bench
// behavior; only the actual rendering (HTML table vs. XLSX rows) differs.

function buildScheduleRoundViewModels(
	schedule,
	scores,
	printExtraMatch = true,
	printEmptyBench = false,
) {
	if (schedule == null || schedule.rounds == null) return [];

	function formatMatchScore(match, scores) {
		const matchScore = scores ? scores[match.matchId] || null : null;
		return matchScore?.a || matchScore?.b
			? `${matchScore.a || 0} : ${matchScore.b || 0}`
			: "";
	}

	const buildRound = (
		roundNumber,
		courtBlockStart,
		matches,
		bench,
		roundScores,
		forceShowBench,
		printCourtBlockStart,
	) => ({
		roundNumber,
		courtBlockStart,
		printCourtBlockStart,
		matches: matches.map((match) => ({
			court: match.court,
			teamAName: match.teamA.map((pid) => playerName(pid)).join(", "),
			teamBName: match.teamB.map((pid) => playerName(pid)).join(", "),
			scoreStr: formatMatchScore(match, roundScores),
		})),
		benchNames: bench.map((pid) => playerName(pid)),
		showBench: bench.length > 0 || forceShowBench,
	});

	let courtBlockStart = null;

	const roundVMs = schedule.rounds.map((round) => {
		const r = buildRound(
			round.roundId + 1,
			round.courtBlockStart,
			round.matches,
			round.bench,
			scores,
			printEmptyBench,
			round.courtBlockStart && courtBlockStart !== round.courtBlockStart,
		);
		courtBlockStart = round.courtBlockStart;
		return r;
	});

	if (schedule.rounds.length > 0 && printExtraMatch) {
		const lastRound = schedule.rounds[schedule.rounds.length - 1];
		roundVMs.push(
			buildRound(
				schedule.rounds.length + 1,
				"",
				lastRound.matches.map((match) => ({
					court: match.court,
					teamA: [],
					teamB: [],
				})),
				[],
				null,
				lastRound.bench.length > 0 || printEmptyBench,
				false,
			),
		);
	}

	console.log("Built schedule round view models:", roundVMs);
	return roundVMs;
}

// biome-ignore lint/correctness/noUnusedVariables: function is used in schedule.js
async function downloadScheduleSpreadsheet(
	schedule,
	scheduleDate,
	scores,
	printExtraMatch = true,
	printEmptyBench = false,
) {
	// 1. Initialize Workbook and Worksheet
	const workbook = new ExcelJS.Workbook();

	if (schedule != null && schedule.rounds != null) {
		const worksheet = workbook.addWorksheet("Matches");

		// 2. Define Columns with widths (to handle those long placeholder names)
		// (no `header` field here - we write the header row ourselves below so
		// row 1 can hold the title/date, mirroring the header in printSchedule)
		worksheet.columns = [
			{ key: "round", width: 8 },
			{ key: "court", width: 8 },
			{ key: "teamA", width: 30 },
			{ key: "score", width: 15 },
			{ key: "teamB", width: 30 },
		];

		// Title + date header row, mirroring the .header/.title/.date block
		// in printSchedule (title on the left, date on the right, with a
		// rule underneath standing in for the <hr>).
		const titleRow = worksheet.addRow(["Beyond Badminton"]);
		worksheet.mergeCells(`A${titleRow.number}:D${titleRow.number}`);
		titleRow.getCell(1).font = { bold: true };
		titleRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
		if (scheduleDate) {
			titleRow.getCell(5).value = scheduleDate.toLocaleDateString("sk-SK");
		}
		titleRow.getCell(5).font = { bold: true };
		titleRow.getCell(5).alignment = {
			vertical: "middle",
			horizontal: "right",
		};
		titleRow.eachCell({ includeEmpty: true }, (cell) => {
			cell.border = { ...(cell.border || {}), bottom: { style: "thin" } };
		});

		worksheet.addRow([]);

		// Column header row
		const headerRow = worksheet.addRow([
			"Round",
			"Court",
			"Team A",
			"Score",
			"Team B",
		]);
		headerRow.font = { bold: true };
		headerRow.alignment = { vertical: "middle", horizontal: "center" };

		headerRow.eachCell({ includeEmpty: true }, (cell) => {
			cell.border = { ...(cell.border || {}), bottom: { style: "medium" } };
		});

		worksheet.addRow([]);

		// Define the border style we want to apply
		const borderStyle = {
			top: { style: "thin" },
			left: { style: "thin" },
			bottom: { style: "thin" },
			right: { style: "thin" },
		};

		// 3. Process the Data - built once via the shared view-model builder so
		// scoring, the extra-match round, and empty-bench handling stay in
		// sync with printSchedule.
		const rounds = buildScheduleRoundViewModels(
			schedule,
			scores,
			printExtraMatch,
			printEmptyBench,
		);

		rounds.forEach((round) => {
			if (round.matches.length === 0) return;

			if (round.printCourtBlockStart) {
				const row = worksheet.addRow([round.courtBlockStart]);
				worksheet.mergeCells(`A${row.number}:E${row.number}`);
				row.getCell(1).font = { bold: true };
				row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
			}

			let firstMatch = true;
			const roundStartRow = worksheet.rowCount;

			round.matches.forEach((match) => {
				const row = worksheet.addRow([
					firstMatch ? round.roundNumber : "",
					match.court,
					match.teamAName,
					match.scoreStr,
					match.teamBName,
				]);

				if (firstMatch) {
					row.getCell(1).font = { bold: true };
				}

				row.getCell(2).font = { bold: true };
				row.getCell(3).font = { bold: true };
				// Bold to match printSchedule, where the score cell inherits the
				// page's bold body font (only the bench row is set non-bold there).
				row.getCell(4).font = { bold: true };
				row.getCell(5).font = { bold: true };

				// Apply borders and center alignment ONLY to cells that have data
				row.eachCell({ includeEmpty: false }, (cell) => {
					cell.border = borderStyle;
					cell.alignment = { vertical: "middle", horizontal: "center" };
				});
				firstMatch = false;
			});

			worksheet
				.getRow(roundStartRow + 1)
				.eachCell({ includeEmpty: false }, (cell) => {
					cell.border = { ...(cell.border || {}), top: { style: "medium" } };
				});

			worksheet
				.getRow(worksheet.rowCount)
				.eachCell({ includeEmpty: false }, (cell) => {
					cell.border = { ...(cell.border || {}), bottom: { style: "medium" } };
				});

			for (let i = roundStartRow + 1; i <= worksheet.rowCount; i++) {
				let cell = worksheet.getRow(i).getCell(1);
				let cellBorder = {
					...(cell.border || {}),
					left: { style: "medium" },
					right: { style: "medium" },
				};
				if (i === roundStartRow + 1) {
					cellBorder.top = { style: "medium" };
				} else if (i === worksheet.rowCount) {
					cellBorder.bottom = { style: "medium" };
				} else {
					cellBorder.bottom = { style: "thin" };
				}
				cell.border = cellBorder;

				cell = worksheet.getRow(i).getCell(2);
				cell.border = {
					...(cell.border || {}),
					left: { style: "medium" },
					right: { style: "medium" },
				};

				cell = worksheet.getRow(i).getCell(5);
				cellBorder = { ...(cell.border || {}), right: { style: "medium" } };
				if (i === roundStartRow + 1) {
					cellBorder.top = { style: "medium" };
				} else if (i === worksheet.rowCount) {
					cellBorder.bottom = { style: "medium" };
				} else {
					cellBorder.bottom = {};
				}
				cell.border = cellBorder;
			}

			if (round.showBench) {
				const row = worksheet.addRow([
					"",
					"Bench:",
					round.benchNames.join(", "),
					"",
					"",
				]);
				// Apply borders and center alignment ONLY to cells that have data
				for (let i = 1; i <= 5; i++) {
					const cell = row.getCell(i);
					cell.fill = {
						type: "pattern",
						pattern: "solid",
						fgColor: { argb: "FFEEEEEE" },
					};
					const cellBorder = {
						...(cell.border || {}),
						top: { style: "medium" },
						bottom: { style: "medium" },
					};
					if (i === 1) {
						cellBorder.left = { style: "medium" };
					} else if (i === 5) {
						cellBorder.right = { style: "medium" };
					}
					cell.border = cellBorder;
					cell.alignment = { vertical: "middle", horizontal: "left" };
				}
			}

			worksheet.addRow([]);
		});
	}

	// 4. Generate the File and Trigger Download
	const buffer = await workbook.xlsx.writeBuffer();
	const blob = new Blob([buffer], {
		type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	});

	// Create a temporary hidden link to download the blob
	const url = window.URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "tournament.xlsx";
	document.body.appendChild(a);
	a.click();

	// Cleanup
	document.body.removeChild(a);
	window.URL.revokeObjectURL(url);
}

// biome-ignore lint/correctness/noUnusedVariables: function is used in schedule.js
function printSchedule(
	schedule,
	scheduleDate,
	scores,
	printExtraMatch = true,
	printEmptyBench = false,
) {
	function printScheduleRound(round) {
		const matches = round.matches;
		if (matches.length === 0) return "";

		const matchRows = matches
			.map((match, idx) => {
				const topCellClass = idx === 0 ? "top-cell" : "";
				const bottomCellClass = idx === matches.length - 1 ? "bottom-cell" : "";
				const roundCell =
					idx === 0
						? `<td class="round-cell left-cell right-cell top-cell bottom-cell ${topCellClass}" rowspan="${matches.length}">${round.roundNumber}</td>`
						: "";

				return `
				<tr>
					${roundCell}
					<td class="court-cell ${topCellClass} ${bottomCellClass}">${match.court}</td>
					<td class="team-cell left-cell ${topCellClass} ${bottomCellClass}">${match.teamAName}</td>
					<td class="score-cell ${topCellClass} ${bottomCellClass}">${match.scoreStr}</td>
					<td class="team-cell right-cell ${topCellClass} ${bottomCellClass}">${match.teamBName}</td>
				</tr>`;
			})
			.join("");

		const benchRow = !round.showBench
			? ""
			: `
			<tr class="bench-row">
				<td class="colspan-cell left-cell top-cell bottom-cell"></td>
				<td class="bench-label colspan-cell top-cell bottom-cell">Bench:</td>
				<td class="bench-names colspan-cell right-cell top-cell bottom-cell" colspan="3">${round.benchNames.join(", ")}</td>
			</tr>`;

		const blockStart = round.printCourtBlockStart
			? `<tr><td colspan="5" class="block-start">${round.courtBlockStart}</td></tr>`
			: "";

		return `<tbody class="round-block"><tr><td colspan="5" class="round-spacer"></td></tr>${blockStart}${matchRows}${benchRow}</tbody>`;
	}

	if (schedule == null || schedule.rounds == null) return;

	// 1. Build the HTML for the table, mirroring the Excel layout. The round
	// data (scores, the extra-match round, empty-bench handling) comes from
	// the same shared builder downloadScheduleSpreadsheet uses, so the two
	// exports can't drift apart on that logic.
	const rounds = buildScheduleRoundViewModels(
		schedule,
		scores,
		printExtraMatch,
		printEmptyBench,
	);

	let rowsHtml = "";
	rounds.forEach((round) => {
		rowsHtml += printScheduleRound(round);
	});

	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<title>Tournament Schedule</title>
			<style>
				@page { size: auto; margin: 12mm; }
				* { box-sizing: border-box; }
				body {
					font-family: Arial, Helvetica, sans-serif;
					font-size: 12pt;
					font-weight: bold;
					color: #000;
					margin: 0;
					-webkit-print-color-adjust: exact;
					print-color-adjust: exact;
					color-adjust: exact; /* older Firefox */
				}
				.header {
					width: 100%;
					display: flex;
					justify-content: space-between;
					align-items: center;
					box-sizing: border-box;
				}
				table {
					width: 100%;
					border-collapse: collapse;
				}
				th {
					border: 0px solid #000;
					padding: 4px 4px;
					font-weight: bold;
					text-align: center;
					background: #fff;
				}
				td {
					border: 1px solid #999;
					padding: 4px 4px;
					text-align: center;
					vertical-align: middle;
				}
				.block-start {
					font-weight: bold;
					text-align: center;
					border: 0px solid #000;
				}
				.round-block {
					page-break-inside: avoid;
				}
				.round-spacer {
					height: 11pt;
					border: 0px;
				}
				.left-cell {
					border-left: 2px solid #000 !important;
				}
				.right-cell {
					border-right: 2px solid #000 !important;
				}
				.top-cell {
					border-top: 2px solid #000 !important;
				}
				.bottom-cell {
					border-bottom: 2px solid #000 !important;
				}
				.colspan-cell {
					border-left: 0px;
					border-right: 0px;
				}
				.round-cell {
					font-weight: bold;
				}
				.court-cell {
					font-weight: bold;
				}
				.team-cell {
					width: 35%;
					font-weight: bold;
				}
				.score-cell {
					width: 12%;
				}
				.bench-row td {
					background: #eeeeee !important;
				}
				.bench-label {
					font-weight: normal;
				}
				.bench-names {
					text-align: left;
					font-weight: normal;
				}
			</style>
		</head>
		<body>
			<div class="header">
				<div class="title">Beyond Badminton</div>
				<div class="date">${scheduleDate.toLocaleDateString("sk-SK")}</div>
			</div>
			<hr>
			<table>
				<thead>
					<tr class="bottom-cell">
						<th>Round</th>
						<th>Court</th>
						<th>Team A</th>
						<th>Score</th>
						<th>Team B</th>
					</tr>
				</thead>
				${rowsHtml}
			</table>
		</body>
		</html>`;

	//console.log("Printing schedule HTML:", html);
	// 2. Create a hidden iframe
	const iframe = document.createElement("iframe");
	iframe.style.position = "fixed";
	iframe.style.right = "0";
	iframe.style.bottom = "0";
	iframe.style.width = "0";
	iframe.style.height = "0";
	iframe.style.border = "0";
	iframe.style.visibility = "hidden";

	document.body.appendChild(iframe);

	const doc = iframe.contentWindow.document;
	doc.open();
	doc.writeln(html);
	doc.close();

	// 3. Wait for content/styles to be ready, then print
	iframe.onload = () => {
		let cleaned = false;
		const cleanup = () => {
			if (cleaned) return;
			cleaned = true;
			document.body.removeChild(iframe);
		};

		iframe.contentWindow.onafterprint = cleanup;
		iframe.contentWindow.focus();
		iframe.contentWindow.print();

		setTimeout(cleanup, 10000); // generous safety net, shouldn't normally fire
	};
}
