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
// SHARED CONSTANTS
// ============================================================
const skillLabels = { '1': 'Beginner', '2': 'Intermediate', '3': 'Advanced' };
const skillLabelsShort = { '1': 'Beg', '2': 'Int', '3': 'Adv' };

function renderSkillPillHtml(skill, short = false) {
	return `<span class="skill-pill skill-${skill}">${(short ? skillLabelsShort[skill] : skillLabels[skill]) || skill}</span>`;
  }
  
// ============================================================
// SORT UTILITIES
// ============================================================
const sortState = {
  all:    { field: 'name', dir: 'asc' },
  active: { field: 'name', dir: 'asc' }
};

function getSorted(arr, listKey) {
  const { field, dir } = sortState[listKey];
  return [...arr].sort((a, b) => {
    const va = field === 'skill' ? Number(a.skill) : a.name.toLowerCase();
    const vb = field === 'skill' ? Number(b.skill) : b.name.toLowerCase();
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ?  1 : -1;
    return 0;
  });
}

function updateSortUI(listKey) {
  const { field, dir } = sortState[listKey];
  const arrow = dir === 'asc' ? '↑' : '↓';

  document.querySelectorAll(`.sort-btn[data-list="${listKey}"]`).forEach(btn => {
    const active = btn.dataset.field === field;
    btn.classList.toggle('active-sort', active);
    const label = btn.dataset.field.charAt(0).toUpperCase() + btn.dataset.field.slice(1);
    btn.textContent = active ? `${label} ${arrow}` : label;
  });

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
  if (listKey === 'all') renderAllPlayers();
  else renderActivePlayers();
}

document.querySelectorAll('.sort-btn, th.sortable').forEach(el => {
  el.addEventListener('click', () => handleSort(el.dataset.list, el.dataset.field));
});
