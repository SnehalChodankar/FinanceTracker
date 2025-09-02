const SUPABASE_URL = "https://bchophlaojqnabbqydsk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaG9waGxhb2pxbmFiYnF5ZHNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMDM3MjksImV4cCI6MjA3MTc3OTcyOX0.Qeebuu4RqlNq01JkxMlMoyFolSDRIx61ReKZSm0axq0";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let user = null;


/* ========= Auth ========= */
async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }
  user = session.user;
}

checkSession();
//loadCategoryMap(); // ensure map is ready before you aggregate



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


async function renderYearly(year) {
   try {
    showLoader();   // 👈 start loader before anything


  const summaryData = [];
  const categoryTotals = {};
  const monthlyCategory = Array.from({ length: 12 }, () => ({}));

  for (let m = 0; m < 12; m++) {
    const ym = `${year}-${String(m + 1).padStart(2, '0')}`;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      window.location.href = "login.html";
      return;
    }
    user = session.user;

    // Fetch starting balance
    let { data: sbData } = await supabaseClient
      .from("balances")
      .select("starting_balance")
      .eq("user_id", user.id)
      .eq("year", year)
      .eq("month", m + 1)
      .maybeSingle();


    const startingBalance = sbData?.starting_balance || 0;

    // Fetch transactions
    let start = `${year}-${String(m + 1).padStart(2, "0")}-01`;
    let end = `${year}-${String(m + 1).padStart(2, "0")}-31`; // safe upper bound

    let { data: txns, error } = await supabaseClient
      .from("transactions")
      .select('id, amount, type, date, notes, category_id')
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end);



    const income = txns?.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0) || 0;
    const expense = txns?.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0) || 0;
    const balance = startingBalance + income - expense;

    (txns || []).filter(t => t.type === 'expense').forEach(t => {
      const catName = catIdToName[String(t.category_id)] || 'Uncategorized';
      const amt = Number(t.amount || 0);
      categoryTotals[catName] = (categoryTotals[catName] || 0) + amt;
      monthlyCategory[m][catName] = (monthlyCategory[m][catName] || 0) + amt;
    });


    summaryData.push({
      month: monthNames[m],
      days: daysInMonth(m, year),
      start: startingBalance,
      income, expense, balance
    });
  }




  // Update title
  document.getElementById('yearTitle').textContent = `📊 Yearly Overview — ${year}`;

  // Totals
  const totalIncome = summaryData.reduce((s, r) => s + r.income, 0);
  const totalExpense = summaryData.reduce((s, r) => s + r.expense, 0);
  const totalBalance = summaryData.reduce((s, r) => s + r.balance, 0);

  // Summary Cards
  const cardsDiv = document.getElementById('yearlyCards');
  cardsDiv.innerHTML = `
    <div class="col-md-4">
      <div class="card text-center shadow-sm border-0 p-3 bg-success-subtle">
        <h6 class="text-muted">Total Income</h6>
        <h4 class="text-success fw-bold">+₹${totalIncome}</h4>
      </div>
    </div>
    <div class="col-md-4">
      <div class="card text-center shadow-sm border-0 p-3 bg-warning-subtle">
        <h6 class="text-muted">Total Expenses</h6>
        <h4 class="text-danger fw-bold">-₹${totalExpense}</h4>
      </div>
    </div>
    <div class="col-md-4">
      <div class="card text-center shadow-sm border-0 p-3 ${totalBalance >= 0 ? 'bg-success-subtle' : 'bg-danger-subtle'}">
        <h6 class="text-muted">Net Balance</h6>
        <h4 class="${totalBalance >= 0 ? 'text-success' : 'text-danger'} fw-bold">₹${totalBalance}</h4>
      </div>
    </div>
  `;


  // Table body
  const tableBody = document.getElementById('summaryTable');
  tableBody.innerHTML = '';
  summaryData.forEach(r => {
    tableBody.innerHTML += `
      <tr>
        <td>${r.month}</td>
        <td>${r.days}</td>
        <td>₹${r.start}</td>
        <td class="text-success">+₹${r.income}</td>
        <td class="text-danger">-₹${r.expense}</td>
        <td class="${r.balance >= 0 ? 'text-success' : 'text-danger'} fw-bold">₹${r.balance}</td>
      </tr>`;
  });

  // Totals row
  tableBody.innerHTML += `
    <tr class="table-secondary fw-bold">
      <td>Total</td>
      <td>-</td>
      <td>-</td>
      <td class="text-success">+₹${totalIncome}</td>
      <td class="text-danger">-₹${totalExpense}</td>
      <td class="${totalBalance >= 0 ? 'text-success' : 'text-danger'}">₹${totalBalance}</td>
    </tr>`;




  // Destroy old charts before re-render
  Chart.helpers.each(Chart.instances, function (instance) { instance.destroy(); });

  // Charts
  new Chart(document.getElementById('lineChart'), {
    type: 'line',
    data: { labels: summaryData.map(r => r.month), datasets: [{ label: 'Balance', data: summaryData.map(r => r.balance), borderColor: '#6366f1', tension: 0.3, fill: false }] }
  });
  new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: summaryData.map(r => r.month), datasets: [
        { label: 'Income', data: summaryData.map(r => r.income), backgroundColor: '#10b981' },
        { label: 'Expense', data: summaryData.map(r => r.expense), backgroundColor: '#ef4444' }
      ]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
  new Chart(document.getElementById('catPie'), {
    type: 'pie',
    data: { labels: Object.keys(categoryTotals), datasets: [{ data: Object.values(categoryTotals), backgroundColor: ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6'] }] }
  });
  const categories = Object.keys(categoryTotals);
  const datasets = categories.map((c, i) => ({
    label: c,
    data: monthlyCategory.map(m => m[c] || 0),
    backgroundColor: ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6'][i % 7]
  }));
  new Chart(document.getElementById('catBar'), {
    type: 'bar',
    data: { labels: monthNames, datasets },
    options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }
  });

  // Export
  document.getElementById('exportBtn').onclick = () => {
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Monthly Summary');
    const catArr = Object.entries(categoryTotals).map(([c, v]) => ({ Category: c, Spent: v }));
    const ws2 = XLSX.utils.json_to_sheet(catArr);
    XLSX.utils.book_append_sheet(wb, ws2, 'Category Totals');
    const ws3 = XLSX.utils.json_to_sheet(monthlyCategory.map((c, i) => ({ Month: monthNames[i], ...c })));
    XLSX.utils.book_append_sheet(wb, ws3, 'Category by Month');
    XLSX.writeFile(wb, `Yearly_Summary_${year}.xlsx`);
  };

  } catch (err) {
    console.error("Error in renderAll:", err);
  } finally {
    hideLoader();   // 👈 always stop loader, even if error
  }
}


function showLoader() {
  document.getElementById("loader").style.display = "flex";
}

function hideLoader() {
  document.getElementById("loader").style.display = "none";
}

let catIdToName = Object.create(null);

/*async function loadCategoryMap() {
  const { data, error } = await supabaseClient
    .from('categories')
    .select('id,name')
    .eq('user_id', user.id);

  if (error) {
    console.error('loadCategoryMap error:', error);
    catIdToName = {};
    return;
  }
  catIdToName = {};
  (data || []).forEach(c => { catIdToName[String(c.id)] = c.name; });
}*/

document.getElementById('toggleChartsBtn').onclick = () => {
  let el = document.getElementById('chartsRow-1');
  el.classList.toggle('d-none');
  document.getElementById('toggleChartsBtn').textContent = el.classList.contains('d-none') ? '📈 Show Charts' : '📈 Hide Charts';
  el = document.getElementById('chartsRow-2');
  //el.classList.toggle('d-none');
  //document.getElementById('toggleChartsBtn').textContent = el.classList.contains('d-none') ? 'Show Charts' : 'Hide Charts';
};


const LS_KEY = 'ft_calendar_v4';
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
let currentYear = new Date().getFullYear();

// Helper: days in month
function daysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}



// Year navigation
document.getElementById('prevYear').onclick = () => { currentYear--; renderYearly(currentYear); }
document.getElementById('nextYear').onclick = () => { currentYear++; renderYearly(currentYear); }

// Initial render
renderYearly(currentYear);




// Dark mode
const html = document.documentElement; const darkBtn = document.getElementById('darkToggleBtn');
if (localStorage.getItem('theme') === 'dark') { html.setAttribute('data-bs-theme', 'dark'); darkBtn.textContent = '☀️ Light'; }
darkBtn.onclick = () => {
  if (html.getAttribute('data-bs-theme') === 'dark') { html.setAttribute('data-bs-theme', 'light'); darkBtn.textContent = '🌙 Dark'; localStorage.setItem('theme', 'light'); }
  else { html.setAttribute('data-bs-theme', 'dark'); darkBtn.textContent = '☀️ Light'; localStorage.setItem('theme', 'dark'); }
};