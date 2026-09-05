// ============================================================
// TAB NAVIGATION
// ============================================================
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// ---- Sub-tab navigation ----
document.querySelectorAll('.sub-tabs').forEach(subTabGroup => {
  subTabGroup.querySelectorAll('.sub-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      subTabGroup.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const parent = subTabGroup.parentElement;
      parent.querySelectorAll(':scope > .sub-tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(btn.dataset.subtab).classList.add('active');
    });
  });
});

// ============================================================
// SORT UTILITIES
// ============================================================
const sortState = {
	all:    { field: 'name', dir: 'asc' },
	active: { field: 'name', dir: 'asc' },
	stats:  { field: 'name', dir: 'asc' }
};

function getSorted(arr, listKey) {
	const { field, dir } = sortState[listKey];
	return [...arr].sort((a, b) => {
		if (field === 'arrival') {
			const va = a[field].split(':').map(Number).reduce((h, m) => h * 60 + m, 0);
			const vb = b[field].split(':').map(Number).reduce((h, m) => h * 60 + m, 0);
			if (va < vb) return dir === 'asc' ? -1 : 1;
			if (va > vb) return dir === 'asc' ?  1 : -1;
			return 0;
		}
		if (field === 'playtime' || field === 'matches' || field === 'bench' || field === 'sit1stRound') {
			const va = a[field] || false;
			const vb = b[field] || false;
			console.log(`Sorting by ${field}:`, a.name, va, b.name, vb);
			if (va < vb) return dir === 'asc' ? -1 : 1;
			if (va > vb) return dir === 'asc' ?  1 : -1;
			return 0;
		}
		if (field === 'skill') {
			const va = Number(a.skill);
			const vb = Number(b.skill);
			if (va < vb) return dir === 'asc' ? -1 : 1;
			if (va > vb) return dir === 'asc' ?  1 : -1;
			return 0;
		}
		if (field === 'partners' || field === 'opponents') {
			const va = a[field].size;
			const vb = b[field].size;
			if (va < vb) return dir === 'asc' ? -1 : 1;
			if (va > vb) return dir === 'asc' ?  1 : -1;
			return 0;
		}

		const ret = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
		if (ret < 0) return dir === 'asc' ? -1 : 1;
		if (ret > 0) return dir === 'asc' ?  1 : -1;
		return 0;
	});
}

function updateSortUI(listKey) {
	const { field, dir } = sortState[listKey];
	const arrow = dir === 'asc' ? '↑' : '↓';

	document.querySelectorAll(`th.sortable[data-list="${listKey}"]`).forEach(th => {
		const active = th.dataset.field === field;
		th.classList.toggle('sort-active', active);
		const icon = th.querySelector('.sort-icon');
		if (icon) icon.textContent = active ? arrow : '↕';
	});
}

function handleSort(listKey, field) {
	if (sortState[listKey].field === field) {
		sortState[listKey].dir = sortState[listKey].dir === 'asc' ? 'desc' : 'asc';
	} else {
		sortState[listKey].field = field;
		sortState[listKey].dir = 'asc';
	}
	//console.log(`Sorting ${listKey} by ${field} (${sortState[listKey].dir})`);
	if (listKey === 'all') renderAllPlayers();
	else if (listKey === 'active') renderActivePlayers();
	else renderStatsTable();
}

document.querySelectorAll('th.sortable').forEach(el => {
	el.addEventListener('click', () => handleSort(el.dataset.list, el.dataset.field));
});
