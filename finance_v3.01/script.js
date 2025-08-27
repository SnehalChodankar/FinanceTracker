// ========== Core Setup ==========
const LS_KEY = 'finance_tracker_v_final';
let store = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
let viewDate = new Date();
viewDate.setDate(1);

const monthNames = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const categoriesExpense = ['Food','Travel','Bills','Shopping','Entertainment'];
const categoriesIncome = ['Salary','Freelance','Bonus','Interest','Other'];

const $ = id => document.getElementById(id);
const ensureMonth = k => { if (!store[k]) store[k] = { startingBalance: 0, budgets: {}, transactions: [] }; };
const saveStore = () => localStorage.setItem(LS_KEY, JSON.stringify(store));
const keyFor = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

// Chart instances
let pieChart = null, barChart = null;

var today = new Date;
    document.getElementById('titleDate').innerHTML= today.toDateString();

// Set default date inputs
// Initialize date inputs to today
function setDefaultDates(){
  const today = new Date().toISOString().slice(0,10);
  $('incomeDate').value = today;
  $('expenseDate').value = today;
}
setDefaultDates();

// populate income/expense selects (ensures consistent categories)
const incomeSel = $('incomeCategory'), expenseSel = $('expenseCategory');
incomeSel.innerHTML = categoriesIncome.map(c=>`<option>${c}</option>`).join('');
expenseSel.innerHTML = categoriesExpense.map(c=>`<option>${c}</option>`).join('');

// hook up collapses to auto-hide others
const collapses = ['incomeCollapse','expenseCollapse','startCollapse','budgetCollapse'].map(id=>document.getElementById(id));
collapses.forEach(c=>{
  c.addEventListener('show.bs.collapse', ()=> collapses.forEach(x=>{ if(x!==c) bootstrap.Collapse.getOrCreateInstance(x).hide(); }) );
});

// ========== Forms Handling ==========
document.getElementById('incomeForm').addEventListener('submit', e=>{
  e.preventDefault();
  const k = keyFor(viewDate); ensureMonth(k);
  const date = $('incomeDate').value;
  const category = $('incomeCategory').value || 'Income';
  const amount = parseFloat($('incomeAmount').value) || 0;
  const note = $('incomeNote').value.trim();
  if(amount>0){ store[k].transactions.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`, date, type:'income', category, amount, note }); saveStore(); }
  bootstrap.Collapse.getOrCreateInstance(document.getElementById('incomeCollapse')).hide();
  e.target.reset(); setDefaultDates(); renderAll();
});

document.getElementById('expenseForm').addEventListener('submit', e=>{
  e.preventDefault();
  const k = keyFor(viewDate); ensureMonth(k);
  const date = $('expenseDate').value;
  const category = $('expenseCategory').value || 'Expense';
  const amount = parseFloat($('expenseAmount').value) || 0;
  const note = $('expenseNote').value.trim();
  if(amount>0){ store[k].transactions.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`, date, type:'expense', category, amount, note }); saveStore(); }
  bootstrap.Collapse.getOrCreateInstance(document.getElementById('expenseCollapse')).hide();
  e.target.reset(); setDefaultDates(); renderAll();
});

document.getElementById('startForm').addEventListener('submit', e=>{
  e.preventDefault();
  const k = keyFor(viewDate); ensureMonth(k);
  const amount = parseFloat($('startAmount').value) || 0;
  store[k].startingBalance = amount; saveStore();
  bootstrap.Collapse.getOrCreateInstance(document.getElementById('startCollapse')).hide();
  e.target.reset(); renderAll();
});

// ========== Budget Sliders & Inputs ==========
function getStartingBalanceFor(monthKey) {
  return store[monthKey].startingBalance || 10000;
}

function createBudgetViews(monthKey) {
  const sliderCont = $('budgetSlidersContainer');
  const inputCont  = $('budgetInputsContainer');
  sliderCont.innerHTML = '';
  inputCont.innerHTML  = '';
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

// Save budgets
$('saveBudgets').addEventListener('click', () => {
  const mk = keyFor(viewDate); ensureMonth(mk);
  const useManual = $('budgetModeToggle').checked;
  const selector = useManual
    ? '#budgetInputsContainer .manual-input'
    : '#budgetSlidersContainer .slider-input';

  const newB = { ...store[mk].budgets };
  document.querySelectorAll(selector).forEach(el => {
    const cat = el.dataset.cat; const amt = Number(el.value);
    if (amt > 0) newB[cat] = amt; else delete newB[cat];
  });

  store[mk].budgets = newB;
  saveStore();
  bootstrap.Collapse.getOrCreateInstance($('budgetCollapse')).hide();
  renderAll();
});

// ========== Navigation & Export ==========
$('prevMonthBtn').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth()-1); renderAll(); });
$('nextMonthBtn').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth()+1); renderAll(); });

// Hide/Show charts
$('toggleChartsBtn').addEventListener('click', ()=>{
  const el = $('chartsRow'); el.classList.toggle('d-none');
  $('toggleChartsBtn').textContent = el.classList.contains('d-none') ? 'Show Charts' : 'Hide Charts';
});

(function restoreTheme(){
  const t = localStorage.getItem('ft_theme');
  if (t==='dark') {
    document.documentElement.setAttribute('data-bs-theme','dark');
    $('darkToggleBtn').textContent='☀️ Light';
  } else {
    document.documentElement.setAttribute('data-bs-theme','light');
    $('darkToggleBtn').textContent='🌙 Dark';
  }
})();
$('darkToggleBtn').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-bs-theme');
  if (cur==='dark') {
    document.documentElement.setAttribute('data-bs-theme','light');
    localStorage.setItem('ft_theme','light');
    $('darkToggleBtn').textContent='🌙 Dark';
  } else {
    document.documentElement.setAttribute('data-bs-theme','dark');
    localStorage.setItem('ft_theme','dark');
    $('darkToggleBtn').textContent='☀️ Light';
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
      //window.location.href = "./finance_v3.01/index.html";
      return 1;
    }
    return 0;
  }


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
        window.location.href = '../login.html';
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
  let run = store[k].startingBalance||0;
  const rows = store[k].transactions
    .slice().sort((a,b)=>a.date.localeCompare(b.date))
    .map(t => {
      run += t.type==='income'?t.amount:-t.amount;
      return { Date:t.date, Type:t.type, Category:t.category,
               Amount:t.amount, Note:t.note||'', Balance:run };
    });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Finance_${k}`);
  XLSX.writeFile(wb, `Finance_${k}.xlsx`);
});

// ========== Rendering ==========
function renderAll() {
  const k = keyFor(viewDate); ensureMonth(k);
  $('monthLabel').textContent =
    `${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  renderSummary();
  renderBudgetProgress();
  renderCalendar();
  renderTable();
  renderCharts();
}

function renderSummary() {
  const k = keyFor(viewDate); const m = store[k];
  const inc = m.transactions.filter(t=>t.type==='income')
               .reduce((s,t)=>s+t.amount,0);
  const exp = m.transactions.filter(t=>t.type==='expense')
               .reduce((s,t)=>s+t.amount,0);
  $('startBal').textContent = `₹${m.startingBalance||0}`;
  $('sumIncome').textContent = `₹${inc}`;
  $('sumExpense').textContent = `₹${exp}`;
  $('sumBalance').textContent = `₹${(m.startingBalance||0)+inc-exp}`;
}

function renderBudgetProgress(){
  const k = keyFor(viewDate); ensureMonth(k);
  const month = store[k];
  const budgets = month.budgets || {};
  const spent = {};
  (month.transactions || []).filter(t=>t.type==='expense').forEach(t => { spent[t.category] = (spent[t.category]||0) + t.amount; });

  const cats = Object.keys(budgets);
  if(cats.length===0){
    $('budgetProgress').innerHTML = '<div class="text-muted small">No budgets set for this month.</div>';
    return;
  }

  let html = '';
  cats.forEach(cat => {
    const limit = budgets[cat] || 0;
    if(limit <= 0) return;

    const used = Math.round((spent[cat] || 0) * 100) / 100;            // spent amount (rounded)
    const pctRaw = (used / limit) * 100;                               // raw percent (can be >100)
    const pctForBar = Math.max(0, Math.min(100, Math.round(pctRaw)));  // capped to 0..100 for bar width

    // Decide color based on raw percent (so overspend hits danger)
    const color = pctRaw < 80 ? 'bg-success' : (pctRaw <= 100 ? 'bg-warning' : 'bg-danger');

    html += `
      <div class="mb-2">
        <div class="d-flex justify-content-between small"><div>${cat}</div><div>₹${used} / ₹${limit}</div></div>
        <div class="progress mt-1"><div class="progress-bar ${color}" role="progressbar" style="width:${pctForBar}%"></div></div>
      </div>`;
  });

  $('budgetProgress').innerHTML = html || '<div class="text-muted small">No budgets set for this month.</div>';
}

function renderCalendar(){
  const k = keyFor(viewDate); ensureMonth(k);
  const monthData = store[k];
  calendarClear();
  const startDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const days = new Date(viewDate.getFullYear(), viewDate.getMonth()+1, 0).getDate();

  // blanks
  for(let i=0;i<startDay;i++){
    const blank = document.createElement('div');
    calendarAppend(blank);
  }

  for(let d=1; d<=days; d++){
    const DD = String(d).padStart(2,'0');
    const MM = String(viewDate.getMonth()+1).padStart(2,'0');
    const YYYY = viewDate.getFullYear();
    const dateStr = `${YYYY}-${MM}-${DD}`;
    const todays = (monthData.transactions || []).filter(t=>t.date === dateStr);

    const inc = todays.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp = todays.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

    const cell = document.createElement('div'); cell.className='calendar-day';
    const isToday = (() => {
      const now = new Date(); return now.getFullYear()===YYYY && now.getMonth()===viewDate.getMonth() && now.getDate()===d;
    })();

    // header
    const header = document.createElement('div'); header.className='header';
    const left = document.createElement('div'); left.className='date-num'; left.textContent = d;
    if(isToday) left.style.color = '#10b981';
    const right = document.createElement('div'); right.className='small-note';
    right.innerHTML = `<span class="income">+₹${inc}</span> <span class="expense">-₹${exp}</span>`;
    header.appendChild(left); header.appendChild(right);
    cell.appendChild(header);

    // top expense categories
    const byCat = {};
    todays.forEach(t => { if(t.type==='expense') byCat[t.category] = (byCat[t.category]||0) + t.amount; });
    const lines = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([c,a])=>`• ${c}: ₹${a}`);
    if(lines.length){
      const list = document.createElement('div'); list.className='cat-list';
      list.innerHTML = lines.join('<br>');
      cell.appendChild(list);
    }

    calendarAppend(cell);
  }
}


function calendarClear(){ $('calendar').innerHTML=''; }
function calendarAppend(el){ $('calendar').appendChild(el); }

function renderTable() {
  const k = keyFor(viewDate); const txs=store[k].transactions.slice()
    .sort((a,b)=>(a.date-b.date)||a.id.localeCompare(b.id));
  const tb = $('txBody'); tb.innerHTML='';
  txs.forEach(t=> {
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${t.date}</td>
      <td class="${t.type==='income'?'text-success':'text-danger'}">${t.type}</td>
      <td>${t.category}</td>
      <td class="text-end">₹${t.amount}</td>
      <td>${t.note||''}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${t.id}">Delete</button>
      </td>`;
    tb.appendChild(tr);
  });
  document.querySelectorAll('.btn-delete').forEach(b=>{
    b.onclick=()=>{
      const id=b.dataset.id; const idx=store[keyFor(viewDate)].transactions
                         .findIndex(x=>x.id===id);
      if(idx>-1 && confirm('Delete this transaction?')) {
        store[keyFor(viewDate)].transactions.splice(idx,1);
        saveStore(); renderAll();
      }
    };
  });
}

function renderCharts(){
  const k = keyFor(viewDate); ensureMonth(k);
  const month = store[k];
  // pie data: expense by category
  const catTotals = {};
  (month.transactions || []).filter(t=>t.type==='expense').forEach(t=>{ catTotals[t.category] = (catTotals[t.category]||0) + t.amount; });
  const labels = Object.keys(catTotals), data = Object.values(catTotals);

  // bar: weekly expenses (5 buckets)
  const weeks = [0,0,0,0,0];
  (month.transactions || []).filter(t=>t.type==='expense').forEach(t=>{
    const day = parseInt(t.date.slice(-2),10);
    const idx = Math.min(4, Math.floor((day-1)/7));
    weeks[idx] += t.amount;
  });

  try{ if(pieChart) pieChart.destroy(); }catch(e){}
  try{ if(barChart) barChart.destroy(); }catch(e){}

  pieChart = new Chart($('pieChart').getContext('2d'), {
    type: 'pie',
    data: { labels, datasets: [{ data, backgroundColor: ['#ff7b7b','#7db8ff','#7ee4b7','#ffd27a','#bda1ff','#9be7ff','#ffc9de'] }] },
    options: { plugins:{ legend:{ position:'bottom' } }, maintainAspectRatio:false }
  });

  barChart = new Chart($('barChart').getContext('2d'), {
    type: 'bar',
    data: { labels:['Week 1','Week 2','Week 3','Week 4','Week 5'], datasets:[{ label:'Expense', data: weeks, backgroundColor:'#4f46e5' }] },
    options: { plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } }, maintainAspectRatio:false }
  });
}

// boot
(function boot(){
  ensureMonth(keyFor(viewDate));
  // Restore theme
  const theme = localStorage.getItem('ft_theme'); if(theme==='dark'){ document.documentElement.setAttribute('data-bs-theme','dark'); $('darkToggleBtn').textContent='☀️ Light'; } else { document.documentElement.setAttribute('data-bs-theme','light'); $('darkToggleBtn').textContent='🌙 Dark'; }

  renderAll();
})();