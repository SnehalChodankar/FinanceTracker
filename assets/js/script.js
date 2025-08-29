// ========== Core Setup ==========
const LS_KEY = 'finance_tracker_v_final';
let store = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
let viewDate = new Date();
viewDate.setDate(1);

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
let categoriesExpense = ['Food', 'Travel', 'Bills', 'Shopping', 'Entertainment'];
let categoriesIncome = ['Salary', 'Freelance', 'Bonus', 'Interest', 'Other'];

// category caches (for fast name<->id lookup)
let catIdToName = {};           // { id: 'Food' }
let expenseNameToId = {};       // { 'Food': 123 }
let incomeNameToId = {};       // { 'Salary': 456 }
let expenseList = [];          // [{id,name}, ...]
let incomeList = [];           // [{id,name}, ...]

const $ = id => document.getElementById(id);
const ensureMonth = k => { if (!store[k]) store[k] = { startingBalance: 0, budgets: {}, transactions: [] }; };
const saveStore = () => localStorage.setItem(LS_KEY, JSON.stringify(store));
const keyFor = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Chart instances
let pieChart = null, barChart = null;

var today = new Date;
document.getElementById('titleDate').innerHTML = today.toDateString();

// Set default date inputs
// Initialize date inputs to today
function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  $('incomeDate').value = today;
  $('expenseDate').value = today;
}
setDefaultDates();

// Load all categories for this user into caches
async function loadCategories() {
  const { data, error } = await supabaseClient
    .from('categories')
    .select('id,name,type')
    .order('id');

  if (error) {
    console.error("loadCategories error:", error);
    return;
  }

  catIdToName = {};
  expenseNameToId = {};
  incomeNameToId = {};
  expenseList = [];
  incomeList = [];

  categoriesExpense = [];
  categoriesIncome = [];

  for (const row of (data || [])) {
    const idKey = String(row.id);
    catIdToName[idKey] = row.name;
    if (row.type === 'expense') {
      expenseNameToId[row.name] = row.id;
      expenseList.push({ id: row.id, name: row.name });
      categoriesExpense.push(row.name);
    }
    if (row.type === 'income') {
      incomeNameToId[row.name] = row.id;
      incomeList.push({ id: row.id, name: row.name });
      categoriesIncome.push(row.name);
    }
  }

  console.log("Categories loaded:", catIdToName);
}

function populateCategories() {
  // Populate income/expense selects from DB if available, otherwise fallback to static list
  const incomeSel = $('incomeCategory');
  const expenseSel = $('expenseCategory');

  if (incomeSel) {
    if (incomeList.length > 0) {
      incomeSel.innerHTML = incomeList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } else {
      incomeSel.innerHTML = categoriesIncome.map(c => `<option>${c}</option>`).join('');
    }
  }

  if (expenseSel) {
    if (expenseList.length > 0) {
      expenseSel.innerHTML = expenseList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } else {
      expenseSel.innerHTML = categoriesExpense.map(c => `<option>${c}</option>`).join('');
    }
  }

  // Also populate budget inputs if you have a budgetInputs container with inputs having data-cat
  // If budget inputs are generated dynamically somewhere else, keep that logic; otherwise we keep existing markup.
}


// populate income/expense selects (ensures consistent categories)
const incomeSel = $('incomeCategory'), expenseSel = $('expenseCategory');
incomeSel.innerHTML = categoriesIncome.map(c => `<option>${c}</option>`).join('');
expenseSel.innerHTML = categoriesExpense.map(c => `<option>${c}</option>`).join('');

// hook up collapses to auto-hide others
//const collapses = ['incomeCollapse', 'expenseCollapse', 'startCollapse', 'budgetCollapse'].map(id => document.getElementById(id));
//collapses.forEach(c => {
//  c.addEventListener('show.bs.collapse', () => collapses.forEach(x => { if (x !== c) bootstrap.Collapse.getOrCreateInstance(x).hide(); }));
//});


document.addEventListener('DOMContentLoaded', () => {
  const ids = ['incomeCollapse','expenseCollapse','startCollapse','budgetCollapse'];
  const els = ids.map(id => document.getElementById(id)).filter(Boolean);

  // Pre-init with toggle:false so nothing auto-opens
  els.forEach(el => {
    if (!bootstrap.Collapse.getInstance(el)) {
      new bootstrap.Collapse(el, { toggle: false });
    }
  });

  // On show, hide the others
  els.forEach(curr => {
    curr.addEventListener('show.bs.collapse', () => {
      els.forEach(other => {
        if (other !== curr) {
          const inst = bootstrap.Collapse.getInstance(other);
          if (inst) inst.hide();
        }
      });
    });
  });

  // Ensure all are closed initially after reload
  els.forEach(el => bootstrap.Collapse.getInstance(el)?.hide());
});



// ========== Forms Handling ==========
/* ========= Forms ========= */
$('incomeForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const date = $('incomeDate').value;
  const selected = $('incomeCategory').value;
  // Determine category_id: prefer option value as id (when categories loaded), otherwise try mapping by name
  let category_id = null;
  if (incomeList.length > 0) {
    category_id = selected; // value is id
  } else {
    category_id = incomeNameToId[selected] || null;
  }
  const amount = parseFloat($('incomeAmount').value) || 0;
  const note = $('incomeNote').value.trim();
  if (amount > 0) {
    const { error } = await supabaseClient.from('transactions').insert([
      { user_id: user.id, date, type: 'income', amount, notes: note, category_id: category_id }
    ]);
    if (error) { console.error("Insert income failed:", error); alert(error.message); }
  }
  bootstrap.Collapse.getOrCreateInstance(document.getElementById('incomeCollapse')).hide();
  e.target.reset(); setDefaultDates(); await renderAll();
});

$('expenseForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const date = $('expenseDate').value;
  const selected = $('expenseCategory').value;
  let category_id = null;
  if (expenseList.length > 0) {
    category_id = selected;
  } else {
    category_id = expenseNameToId[selected] || null;
  }
  const amount = parseFloat($('expenseAmount').value) || 0;
  const note = $('expenseNote').value.trim();
  if (amount > 0) {
    const { error } = await supabaseClient.from('transactions').insert([
      { user_id: user.id, date, type: 'expense', amount, notes: note, category_id: category_id }
    ]);
    if (error) { console.error("Insert expense failed:", error); alert(error.message); }
  }
  bootstrap.Collapse.getOrCreateInstance(document.getElementById('expenseCollapse')).hide();
  e.target.reset(); setDefaultDates(); await renderAll();
});

$('startForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const amount = parseFloat($('startAmount').value) || 0;
  const y = viewDate.getFullYear(), m = viewDate.getMonth() + 1;
  const { error } = await supabaseClient.from('balances').upsert(
    [{ user_id: user.id, year: y, month: m, starting_balance: amount }],
    { onConflict: 'user_id,year,month' }
  );
  if (error) { console.error("Balance upsert failed:", error); alert(error.message); }
  bootstrap.Collapse.getOrCreateInstance(document.getElementById('startCollapse')).hide();
  e.target.reset(); await renderAll();
});

// ========== Budget Sliders & Inputs ==========
function getStartingBalanceFor(monthKey) {
  return store[monthKey].startingBalance || 10000;
}

function createBudgetViews(monthKey) {
  const sliderCont = $('budgetSlidersContainer');
  const inputCont = $('budgetInputsContainer');
  sliderCont.innerHTML = '';
  inputCont.innerHTML = '';
  const maxAmt = getStartingBalanceFor(monthKey);

  // Build sliders & manual inputs
  categoriesExpense.forEach(cat => {
    const existing = store[monthKey].budgets[cat] || 0;

    // Slider
    const sw = document.createElement('div');
    sw.className = 'budget-slider-container';
    sw.innerHTML = `
      <div class="budget-slider-label">
        <span>${cat}</span>
        <span class="budget-value">₹${existing.toLocaleString('en-IN')}</span>
      </div>
      <input type="range"
             class="slider-input"
             min="0" max="${maxAmt}" step="100"
             value="${existing}"
             data-cat="${cat}">
      <div class="d-flex justify-content-between small text-muted mt-1">
        <span>₹0</span><span>₹${maxAmt.toLocaleString('en-IN')}</span>
      </div>`;
    sliderCont.appendChild(sw);
    const slider = sw.querySelector('input');
    const vs = sw.querySelector('.budget-value');
    slider.addEventListener('input', () => {
      const pct = (slider.value - slider.min) / (slider.max - slider.min) * 100;
      slider.style.setProperty('--slider-percent', pct + '%');
      vs.textContent = '₹' + Number(slider.value).toLocaleString('en-IN');
    });
    slider.dispatchEvent(new Event('input'));

    // Manual input
    const iw = document.createElement('div');
    iw.className = 'input-group input-group-sm mb-2';
    iw.innerHTML = `
      <span class="input-group-text">${cat} ₹</span>
      <input type="number"
             class="form-control manual-input"
             min="0" max="${maxAmt}" step="100"
             value="${existing}"
             data-cat="${cat}">`;
    inputCont.appendChild(iw);
  });
}

// Toggle between slider/manual
$('budgetModeToggle').addEventListener('change', e => {
  const useManual = e.target.checked;
  $('budgetSlidersContainer').classList.toggle('d-none', useManual);
  $('budgetInputsContainer').classList.toggle('d-none', !useManual);
});

// Show budget view when opening collapse
document.querySelector('button[data-bs-target="#budgetCollapse"]').addEventListener('click', () => {
  const mk = keyFor(viewDate); ensureMonth(mk);
  createBudgetViews(mk);
});

// ========== Save Budgets DB Integration ========== 
$('saveBudgets').addEventListener('click', async () => {
  try {
    const mk = keyFor(viewDate); ensureMonth(mk);
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session?.user) { alert('Please log in to save budgets'); return; }
    const userId = session.user.id;
    const useManual = $('budgetModeToggle').checked;
    const selector = useManual ? '#budgetInputsContainer .manual-input' : '#budgetSlidersContainer .slider-input';
    const budgetEntries = [];
    const newB = { ...store[mk].budgets };
    document.querySelectorAll(selector).forEach(el => {
      const categoryName = el.dataset.cat;
      const amount = Number(el.value);
      if (amount > 0) {
        newB[categoryName] = amount;
        const categoryId = expenseNameToId[categoryName];
        if (categoryId) {
          budgetEntries.push({ user_id: userId, year_month: mk, category_id: categoryId, amount });
        }
      } else { delete newB[categoryName]; }
    });
    const { error: deleteError } = await supabaseClient.from('budgets').delete().eq('user_id', userId).eq('year_month', mk);
    if (deleteError) { console.error('Error deleting existing budgets:', deleteError); throw deleteError; }
    if (budgetEntries.length > 0) {
      const { error: insertError } = await supabaseClient.from('budgets').insert(budgetEntries);
      if (insertError) { console.error('Error inserting budgets:', insertError); throw insertError; }
    }
    store[mk].budgets = newB;
    saveStore();
    bootstrap.Collapse.getOrCreateInstance($('budgetCollapse')).hide();
    await renderAll();
  } catch (error) {
    console.error('Error saving budgets:', error);
    alert('Failed to save budgets. Please try again.');
  }
});

// Call renderAll when page is ready
window.addEventListener('DOMContentLoaded', renderAll);


// ========== DB-Integrated Budget Load ========== 
async function loadBudgetsFromDB(monthKey) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session?.user) return;
  const { data, error } = await supabaseClient
    .from('budgets')
    .select('category_id,amount,categories(name)')
    .eq('user_id', session.user.id)
    .eq('year_month', monthKey);
  if (error) { console.error('Error loading budgets:', error); return; }
  const budgets = {};
  (data || []).forEach(budget => {
    const categoryName = budget.categories.name;
    budgets[categoryName] = budget.amount;
  });
  ensureMonth(monthKey);
  store[monthKey].budgets = budgets;
  saveStore();
}




// ========== Navigation & Export ==========
$('prevMonthBtn').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() - 1); renderAll(); });
$('nextMonthBtn').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() + 1); renderAll(); });

// Hide/Show charts
$('toggleChartsBtn').addEventListener('click', () => {
  const el = $('chartsRow'); el.classList.toggle('d-none');
  $('toggleChartsBtn').textContent = el.classList.contains('d-none') ? 'Show Charts' : 'Hide Charts';
});

(function restoreTheme() {
  const t = localStorage.getItem('ft_theme');
  if (t === 'dark') {
    document.documentElement.setAttribute('data-bs-theme', 'dark');
    $('darkToggleBtn').textContent = '☀️ Light';
  } else {
    document.documentElement.setAttribute('data-bs-theme', 'light');
    $('darkToggleBtn').textContent = '🌙 Dark';
  }
})();
$('darkToggleBtn').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-bs-theme');
  if (cur === 'dark') {
    document.documentElement.setAttribute('data-bs-theme', 'light');
    localStorage.setItem('ft_theme', 'light');
    $('darkToggleBtn').textContent = '🌙 Dark';
  } else {
    document.documentElement.setAttribute('data-bs-theme', 'dark');
    localStorage.setItem('ft_theme', 'dark');
    $('darkToggleBtn').textContent = '☀️ Light';
  }
});


const SUPABASE_URL = "https://bchophlaojqnabbqydsk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaG9waGxhb2pxbmFiYnF5ZHNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMDM3MjksImV4cCI6MjA3MTc3OTcyOX0.Qeebuu4RqlNq01JkxMlMoyFolSDRIx61ReKZSm0axq0";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== Supabase Logout Handler =====
// If Supabase is used, ensure the client is initialized somewhere like:
// const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    // Already logged in → redirect
    //window.location.href = "../../index.html";
    return 1;
  }
  return 0;
}

/* ========= Auth ========= */
async function checkSessionForRedirect() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }
  user = session.user;
  setDefaultDates();

  // Load categories from DB (pre-seeded). Must load before populating selects / rendering.
  await loadCategories();

  populateCategories();
  await renderAll();
}
checkSessionForRedirect();


document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  try {

    // Check if Supabase client is available and session exists
    if (checkSession()) {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) {
        console.warn('Supabase session check error:', error.message);
      }
      const session = data?.session || null;

      if (session) {
        // Terminate Supabase session
        const { error: signOutError } = await supabaseClient.auth.signOut();
        if (signOutError) {
          console.error('Supabase sign-out failed:', signOutError.message);
          alert('Could not log out from Supabase. Please try again.');
          return;
        }
        // Optional: clear any local app state
        // localStorage.removeItem('finance_tracker_v_final');

        alert('Logged out from Supabase session.');
        // Navigate to login page
        window.location.href = 'login.html';
        return;
      }
    }

    // If no Supabase or no session, treat as local session
    alert('Local session detected (no Supabase auth).');
    // Temporary: navigate to login page
    //window.location.href = '../login.html';
  } catch (e) {
    console.error('Logout handler error:', e);
    alert('Unexpected error during logout.');
  }
});



$('exportBtn').addEventListener('click', () => {
  const k = keyFor(viewDate); ensureMonth(k);
  let run = store[k].startingBalance || 0;
  const rows = store[k].transactions
    .slice().sort((a, b) => a.date.localeCompare(b.date))
    .map(t => {
      run += t.type === 'income' ? t.amount : -t.amount;
      return {
        Date: t.date, Type: t.type, Category: t.category,
        Amount: t.amount, Note: t.note || '', Balance: run
      };
    });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Finance_${k}`);
  XLSX.writeFile(wb, `Finance_${k}.xlsx`);
});

// ========== Rendering ==========
async function renderAll() {
  const k = keyFor(viewDate); ensureMonth(k);
  $('monthLabel').textContent =
    `${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  await loadCategories();
  await loadBudgetsFromDB(keyFor(viewDate));

  renderSummary();
  await renderBudgetProgress();
  renderCalendar();
  renderTable();
  renderCharts();
}

async function renderSummary() {
  const ym = keyFor(viewDate);
  $('monthLabel').textContent = `${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  const { data: { session } } = await supabaseClient.auth.getSession();
  const user = session.user;

  const { data: tx = [] } = await supabaseClient.from('transactions')
    .select('id,date,type,amount,notes,category_id')
    .eq('user_id', user.id)
    .gte('date', `${ym}-01`).lte('date', `${ym}-31`);

  const { data: bal } = await supabaseClient.from('balances').select('*')
    .eq('user_id', user.id)
    .eq('year', viewDate.getFullYear())
    .eq('month', viewDate.getMonth() + 1)
    .maybeSingle();

  const inc = tx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const exp = tx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  $('startBal').textContent = `₹${bal?.starting_balance || 0}`;
  $('sumIncome').textContent = `₹${inc}`;
  $('sumExpense').textContent = `₹${exp}`;
  $('sumBalance').textContent = `₹${(bal?.starting_balance || 0) + inc - exp}`;
}


async function renderBudgetProgress() {
  const ym = keyFor(viewDate);
  const { data: { session } } = await supabaseClient.auth.getSession();

  const user = session.user;

  const { data: bud = [] } = await supabaseClient.from('budgets')
    .select('id,amount,category_id')
    .eq('user_id', user.id)
    .eq('year_month', ym);


  const { data: tx = [] } = await supabaseClient.from('transactions')
    .select('id,date,type,amount,notes,category_id')
    .eq('user_id', user.id)
    .gte('date', `${ym}-01`).lte('date', `${ym}-31`);

  // spent per category id
  const spentById = {};
  tx.filter(t => t.type === 'expense').forEach(t => {
    const cid = String(t.category_id);
    spentById[cid] = (spentById[cid] || 0) + Number(t.amount);
  });

  if (!bud.length) {
    $('budgetProgress').innerHTML = '<div class="text-muted small">No budgets set for this month.</div>';
    return;
  }

  let html = '';
  bud.forEach(b => {
    const cid = String(b.category_id);
    const name = catIdToName[cid] || 'Other';
    const limit = +b.amount || 0;
    if (limit <= 0) return;
    const used = Math.round((spentById[cid] || 0) * 100) / 100;
    const pctRaw = (used / limit) * 100;
    const pctForBar = Math.max(0, Math.min(100, Math.round(pctRaw)));
    const color = pctRaw < 80 ? 'bg-success' : (pctRaw <= 100 ? 'bg-warning' : 'bg-danger');

    html += `
      <div class="mb-2">
        <div class="d-flex justify-content-between small"><div>${name}</div><div>₹${used} / ₹${limit}</div></div>
        <div class="progress mt-1"><div class="progress-bar ${color}" role="progressbar" style="width:${pctForBar}%"></div></div>
      </div>`;
  });

  $('budgetProgress').innerHTML = html || '<div class="text-muted small">No budgets set for this month.</div>';
}


async function renderCalendar() {
  const ym = keyFor(viewDate);
  $('monthLabel').textContent = `${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  const { data: { session } } = await supabaseClient.auth.getSession();
  const user = session.user;

  const { data: tx = [] } = await supabaseClient.from('transactions')
    .select('id,date,type,amount,notes,category_id')
    .eq('user_id', user.id)
    .gte('date', `${ym}-01`).lte('date', `${ym}-31`);


  $('calendar').innerHTML = '';
  const startDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const days = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  for (let i = 0; i < startDay; i++)$('calendar').appendChild(document.createElement('div'));
  for (let d = 1; d <= days; d++) {
    const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const todays = tx.filter(t => t.date === dateStr);
    const inc = todays.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const exp = todays.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const cell = document.createElement('div'); cell.className = 'calendar-day';
    const header = document.createElement('div'); header.className = 'header';
    const left = document.createElement('div'); left.className = 'date-num'; left.textContent = d;
    if (new Date().toISOString().slice(0, 10) === dateStr) left.style.color = '#10b981';
    const right = document.createElement('div'); right.className = 'small-note';
    right.innerHTML = `<span class="income">+₹${inc}</span> <span class="expense">-₹${exp}</span>`;
    header.appendChild(left); header.appendChild(right); cell.appendChild(header);
    $('calendar').appendChild(cell);

    // TOP 3 EXPENSE CATEGORIES (added)
    const byCatId = {};
    todays.forEach(t => {
      if (t.type === 'expense') {
        const cid = String(t.category_id);
        byCatId[cid] = (byCatId[cid] || 0) + Number(t.amount || 0);
      }
    });

    const topLines = Object.entries(byCatId)
      .map(([cid, total]) => {
        const name = catIdToName?.[cid] || 'Uncategorized';
        return [name, total];
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, total]) => `• ${name}: ₹${total}`);

    if (topLines.length) {
      const list = document.createElement('div');
      list.className = 'cat-list';
      list.innerHTML = topLines.join('<br>');
      cell.appendChild(list);
    }

    $('calendar').appendChild(cell);
  }
}


function calendarClear() { $('calendar').innerHTML = ''; }
function calendarAppend(el) { $('calendar').appendChild(el); }

async function renderTable() {
  const ym = keyFor(viewDate);
  $('monthLabel').textContent = `${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  const { data: { session } } = await supabaseClient.auth.getSession();
  const user = session.user;

  const { data: tx = [] } = await supabaseClient.from('transactions')
    .select('id,date,type,amount,notes,category_id')
    .eq('user_id', user.id)
    .gte('date', `${ym}-01`).lte('date', `${ym}-31`);


  const tbody = $('txBody'); tbody.innerHTML = '';
  tx.sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
    const catName = catIdToName[String(t.category_id)] || t.category || '';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.date}</td><td class="${t.type === 'income' ? 'text-success' : 'text-danger'}">${t.type}</td><td>${catName}</td><td class="text-end">₹${t.amount}</td><td>${t.notes || ''}</td><td class="text-end"><button class="btn btn-sm btn-outline-danger" data-id="${t.id}">Delete</button></td>`;
    tbody.appendChild(tr);
    tr.querySelector('button').onclick = async () => {
      if (confirm('Delete transaction?')) {
        const { error } = await supabaseClient.from('transactions').delete().eq('id', t.id);
        if (error) { console.error("Delete failed:", error); alert(error.message); }
        renderAll();
      }
    };
  });
}

async function renderCharts() {
  const ym = keyFor(viewDate);
  $('monthLabel').textContent = `${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  const { data: { session } } = await supabaseClient.auth.getSession();
  const user = session.user;

  const { data: tx = [] } = await supabaseClient.from('transactions')
    .select('id,date,type,amount,notes,category_id')
    .eq('user_id', user.id)
    .gte('date', `${ym}-01`).lte('date', `${ym}-31`);


  const catTotals = {};
  tx.filter(t => t.type === 'expense').forEach(t => {
    const name = catIdToName[String(t.category_id)] || 'Other';
    catTotals[name] = (catTotals[name] || 0) + Number(t.amount);
  });
  const labels = Object.keys(catTotals), data = Object.values(catTotals);
  const weeks = [0, 0, 0, 0, 0];
  tx.filter(t => t.type === 'expense').forEach(t => {
    const day = +t.date.split('-')[2];
    weeks[Math.min(4, Math.floor((day - 1) / 7))] += Number(t.amount);
  });
  try { if (pieChart) pieChart.destroy(); } catch (e) { }
  try { if (barChart) barChart.destroy(); } catch (e) { }
  pieChart = new Chart($('pieChart').getContext('2d'), { type: 'pie', data: { labels, datasets: [{ data, backgroundColor: ['#ff7b7b', '#7db8ff', '#7ee4b7', '#ffd27a', '#bda1ff', '#9be7ff', '#ffc9de'] }] }, options: { plugins: { legend: { position: 'bottom' } }, maintainAspectRatio: false } });
  barChart = new Chart($('barChart').getContext('2d'), { type: 'bar', data: { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'], datasets: [{ label: 'Expense', data: weeks, backgroundColor: '#4f46e5' }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } }, maintainAspectRatio: false } });
}

// boot
(function boot() {
  ensureMonth(keyFor(viewDate));
  // Restore theme
  const theme = localStorage.getItem('ft_theme'); if (theme === 'dark') { document.documentElement.setAttribute('data-bs-theme', 'dark'); $('darkToggleBtn').textContent = '☀️ Light'; } else { document.documentElement.setAttribute('data-bs-theme', 'light'); $('darkToggleBtn').textContent = '🌙 Dark'; }

  renderAll();
})();