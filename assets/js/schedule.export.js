'use strict';

async function downloadScheduleSpreadsheet() {
	// 1. Initialize Workbook and Worksheet
	const workbook = new ExcelJS.Workbook();

	if (schedule != null && schedule.rounds != null) {
		const worksheet = workbook.addWorksheet('Matches');

		worksheet.addRow([]);

		// 2. Define Columns with widths (to handle those long placeholder names)
		worksheet.columns = [
			{ header: 'Round', key: 'round', width: 8 },
			{ header: 'Court', key: 'court', width: 8 },
			{ header: 'Team A', key: 'teamA', width: 30 },
			{ header: 'Score', key: 'score', width: 15 },
			{ header: 'Team B', key: 'teamB', width: 30 }
		];

		// Format for the headers
		let firstRow = worksheet.getRow(1)
		firstRow.font = { bold: true };
		firstRow.alignment = { vertical: 'middle', horizontal: 'center' };
		
		// Define the border style we want to apply
		const borderStyle = {
			top: { style: 'thin' },
			left: { style: 'thin' },
			bottom: { style: 'thin' },
			right: { style: 'thin' }
		};

		// 3. Process the Data
		schedule.rounds.forEach(round => {
			let firstMatch = true;
			const roundStartRow = worksheet.rowCount;

			round.matches.forEach(match => {
				let row = worksheet.addRow([firstMatch ? round.roundId + 1 : '', match.court, match.teamA.map(pid => playerName(pid)).join(', '), '', match.teamB.map(pid => playerName(pid)).join(', ')]);

				if (firstMatch) {
					row.getCell(1).font = { bold: true };
				}

				row.getCell(2).font = { bold: true };
				row.getCell(3).font = { bold: true };
				row.getCell(5).font = { bold: true };

				// Apply borders and center alignment ONLY to cells that have data
				row.eachCell({ includeEmpty: false }, (cell) => {
					cell.border = borderStyle;
					cell.alignment = { vertical: 'middle', horizontal: 'center' };
				});
				firstMatch = false;
			});

			if (firstMatch) {
				// If there were no matches, skip
				return;
			}

			worksheet.getRow(roundStartRow + 1).eachCell({ includeEmpty: false }, (cell) => {
				cell.border = { ...(cell.border || {}), top: { style: 'medium' }};
			});


			worksheet.getRow(worksheet.rowCount).eachCell({ includeEmpty: false }, (cell) => {
				cell.border = { ...(cell.border || {}), bottom: { style: 'medium' }};
			});

			for (let i = roundStartRow + 1; i <= worksheet.rowCount; i++) {
				let cell = worksheet.getRow(i).getCell(1);
				let cellBorder = { ...(cell.border || {}), left: { style: 'medium' }, right: { style: 'medium' }};
				if (i === roundStartRow + 1) {
					cellBorder.top = { style: 'medium' };
				}
				else if (i === worksheet.rowCount) {
					cellBorder.bottom = { style: 'medium' };
				}
				else {
					cellBorder.bottom = { style: 'thin' };
				}
				cell.border = cellBorder;

				cell = worksheet.getRow(i).getCell(2);
				cell.border = { ...(cell.border || {}), left: { style: 'medium' }, right: { style: 'medium' }};

				cell = worksheet.getRow(i).getCell(5);
				cellBorder = { ...(cell.border || {}), right: { style: 'medium' }};
				if (i === roundStartRow + 1) {
					cellBorder.top = { style: 'medium' };
				}
				else if (i === worksheet.rowCount) {
					cellBorder.bottom = { style: 'medium' };
				}
				else {
					cellBorder.bottom = {};
				}
				cell.border = cellBorder;
			}

			let row = worksheet.addRow(['', 'Bench:', round.bench.map(pid => playerName(pid)).join(', '), '', '']);
			// Apply borders and center alignment ONLY to cells that have data
			for (let i = 1; i <= 5; i++) {
				let cell = row.getCell(i);
				cell.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: 'FFEEEEEE' }
				};
				let cellBorder = { ...(cell.border || {}), top: { style: 'medium' }, bottom: { style: 'medium' }};
				if (i === 1) {
					cellBorder.left = { style: 'medium' };
				}
				else if (i === 5) {
					cellBorder.right = { style: 'medium' };
				}
				cell.border = cellBorder;
				cell.alignment = { vertical: 'middle', horizontal: 'left' };
			}

			worksheet.addRow([]);
		});
	}


	// 4. Generate the File and Trigger Download
	const buffer = await workbook.xlsx.writeBuffer();
	const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
	
	// Create a temporary hidden link to download the blob
	const url = window.URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'tournament.xlsx';
	document.body.appendChild(a);
	a.click();
	
	// Cleanup
	document.body.removeChild(a);
	window.URL.revokeObjectURL(url);
}

function printScheduleRound(round, emptyTable = false) {
	if (round.matches.length === 0) return;

	let matchRows = round.matches.map((match, idx) => {
		const matchScore = scores[match.matchId] || null;
		const matchScoreStr = matchScore && matchScore['a'] && matchScore['b']  ? `${matchScore['a']} : ${matchScore['b']}` : '';
		const teamA = emptyTable ? '' : match.teamA.map(pid => playerName(pid)).join(', ');
		const teamB = emptyTable ? '' : match.teamB.map(pid => playerName(pid)).join(', ');
		const topCellClass = idx === 0 ? 'top-cell' : '';
		const roundCell = idx === 0
			? `<td class="round-cell left-cell right-cell top-cell bottom-cell ${topCellClass}" rowspan="${round.matches.length}">${round.roundId + 1}</td>`
			: '';
		
		return `
			<tr>
				${roundCell}
				<td class="court-cell ${topCellClass}">${match.court}</td>
				<td class="team-cell left-cell ${topCellClass}">${teamA}</td>
				<td class="score-cell ${topCellClass}">${matchScoreStr}</td>
				<td class="team-cell right-cell ${topCellClass}">${teamB}</td>
			</tr>`;
	}).join('');

	const benchRow = `
		<tr class="bench-row">
			<td class="colspan-cell left-cell top-cell bottom-cell"></td>
			<td class="bench-label colspan-cell top-cell bottom-cell">Bench:</td>
			<td class="bench-names colspan-cell right-cell top-cell bottom-cell" colspan="3">${emptyTable ? '' : round.bench.map(pid => playerName(pid)).join(', ')}</td>
		</tr>`;
	
	return `<tbody class="round-block">${matchRows}${benchRow}<tr><td colspan="5" class="round-spacer"></td></tr></tbody>`;

}

function printSchedule() {
	if (schedule == null || schedule.rounds == null) return;

	// 1. Build the HTML for the table, mirroring the Excel layout
	let rowsHtml = '';

	schedule.rounds.forEach(round => {
		rowsHtml += printScheduleRound(round);
	});

	if (schedule.rounds.length > 0 && document.getElementById('print-extra-match').checked) {
		rowsHtml += printScheduleRound(schedule.rounds[schedule.rounds.length - 1], true);
	}

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
					<tr>
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
	const iframe = document.createElement('iframe');
	iframe.style.position = 'fixed';
	iframe.style.right = '0';
	iframe.style.bottom = '0';
	iframe.style.width = '0';
	iframe.style.height = '0';
	iframe.style.border = '0';
	iframe.style.visibility = 'hidden';

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
