let token = localStorage.getItem("token");
let user = JSON.parse(localStorage.getItem("user") || "null");
let expenses = [],
  budgets = [],
  categoryChart,
  reportChart,
  editId = null;

const $ = (s) => document.querySelector(s);
const money = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );

async function api(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function toast(msg) {
  $("#toast").textContent = msg;
  $("#toast").style.display = "block";
  setTimeout(() => ($("#toast").style.display = "none"), 2200);
}
function showAuth() {
  $("#authPage").classList.remove("hidden");
  $("#app").classList.add("hidden");
}
function showApp() {
  $("#authPage").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#userName").textContent = user?.name || "User";
  $("#settingsEmail").textContent = user?.email || "";
  loadAll();
}

let mode = "login";
$("#loginTab").onclick = () => setMode("login");
$("#registerTab").onclick = () => setMode("register");
function setMode(m) {
  mode = m;
  $("#loginTab").classList.toggle("active", m === "login");
  $("#registerTab").classList.toggle("active", m === "register");
  $("#nameField").classList.toggle("hidden", m === "login");
  $("#authSubmit").textContent = m === "login" ? "Login" : "Create account";
}
$("#authForm").onsubmit = async (e) => {
  e.preventDefault();
  $("#authMessage").textContent = "";
  try {
    const data = await api("/api/auth/" + mode, {
      method: "POST",
      body: {
        name: $("#authName").value,
        email: $("#authEmail").value,
        password: $("#authPassword").value,
      },
    });
    token = data.token;
    user = data.user;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    showApp();
  } catch (err) {
    $("#authMessage").textContent = err.message;
  }
};
$("#logout").onclick = () => {
  localStorage.clear();
  token = null;
  user = null;
  showAuth();
};

document
  .querySelectorAll(".nav")
  .forEach((b) => (b.onclick = () => goPage(b.dataset.page)));
document
  .querySelectorAll("[data-page]")
  .forEach((b) => (b.onclick = () => goPage(b.dataset.page)));
function goPage(page) {
  const titles = {
    dashboard: "Dashboard",
    transactions: "Transactions",
    budgets: "Budgets",
    reports: "Reports",
    settings: "Settings",
  };
  $("#pageTitle").textContent = titles[page];
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  $("#" + page + "Page").classList.remove("hidden");
  document
    .querySelectorAll(".nav")
    .forEach((n) => n.classList.toggle("active", n.dataset.page === page));
  if (page === "reports") renderReports();
}

$("#openIncome").onclick = () => {
  $("#incomeDate").value = new Date().toISOString().slice(0, 10);
  $("#incomeModal").classList.remove("hidden");
};
$("#incomeForm").onsubmit = async (e) => {
  e.preventDefault();
  const data = {
    source: $("#incomeSource").value,
    amount: Number($("#incomeAmount").value),
    income_date: $("#incomeDate").value,
  };
  try {
    await api("/api/income", {
      method: "POST",
      body: data,
    });
    toast("Income added successfully");
    $("#incomeModal").classList.add("hidden");
    $("#incomeForm").reset();
    await loadAll();
  } catch (error) {
    toast(error.message);
  }
};

function expenseFormHTML(x = {}) {
  return `<label>Amount</label><input id="fAmount" type="number" min="1" value="${x.amount || ""}" required>
 <label>Category</label><select id="fCategory" required>
 ${["Food", "Shopping", "Travel", "Bills", "Entertainment", "Other"]
   .map(
     (c) => `<option 
  ${x.category === c ? "selected" : ""}>
  ${c}</option>`,
   )
   .join("")}
 </select>
 <label>Payment method</label><select id="fPayment">
 ${["UPI", "Cash", "Card", "Bank Transfer"]
   .map(
     (c) => `<option 
  ${x.payment_method === c ? "selected" : ""}>
  ${c}</option>`,
   )
   .join("")}
  </select>
 <label>Date</label>
 <input id="fDate" type="date" 
 value=" ${x.expense_date || new Date().toISOString().slice(0, 10)}" 
 required>
 <label>Description</label>
 <input id="fDesc" placeholder="e.g. Grocery Store" 
 value=" ${esc(x.description || "")}">
 <button class="primary" type="submit">
 ${x.expense_id ? "Update" : "Add expense"}
 </button>`;
}
$("#expenseForm").innerHTML = expenseFormHTML();
$("#quickExpense").innerHTML = expenseFormHTML();

function openExpense(x = null) {
  editId = x?.expense_id || null;
  $("#expenseModalTitle").textContent = x ? "Edit Expense" : "Add Expense";
  $("#expenseForm").innerHTML = expenseFormHTML(x || {});
  $("#expenseModal").classList.remove("hidden");
}
$("#openExpense").onclick = () => openExpense();
document
  .querySelectorAll(".close")
  .forEach(
    (b) => (b.onclick = () => $("#" + b.dataset.close).classList.add("hidden")),
  );

async function submitExpense(e) {
  e.preventDefault();
  const data = {
    amount: +$("#fAmount").value,
    category: $("#fCategory").value,
    payment_method: $("#fPayment").value,
    expense_date: $("#fDate").value,
    description: $("#fDesc").value,
  };
  try {
    if (editId)
      await api("/api/expenses/" + editId, {
        method: "PUT",
        body: data,
      });
    else
      await api("/api/expenses", {
        method: "POST",
        body: data,
      });
    toast(editId ? "Expense updated" : "Expense added");
    editId = null;
    $("#expenseModal").classList.add("hidden");
    await loadAll();
  } catch (err) {
    toast(err.message);
  }
}
$("#expenseForm").onsubmit = submitExpense;
$("#quickExpense").onsubmit = async (e) => {
  e.preventDefault();
  const data = {
    amount: +$("#fAmount").value,
    category: $("#fCategory").value,
    payment_method: $("#fPayment").value,
    expense_date: $("#fDate").value,
    description: $("#fDesc").value,
  };
  try {
    await api("/api/expenses", {
      method: "POST",
      body: data,
    });
    toast("Expense added");
    $("#quickExpense").reset();
    await loadAll();
  } catch (err) {
    toast(err.message);
  }
};

function renderTransactions() {
  const q = ($("#search")?.value || "").toLowerCase();
  const rows = expenses.filter((x) =>
    [x.category, x.description, x.payment_method]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
  $("#expenseTable").innerHTML = rows
    .map(
      (x) => `<tr>
    <td>
    ${x.expense_date}</td><td>${esc(x.description || "-")}
    </td>
    <td>
    ${esc(x.category)}</td>
    <td>${esc(x.payment_method)}</td>
    <td class="red">-${money(x.amount)}
    </td>
    <td><button class="edit" onclick='openExpense(${JSON.stringify(x)})
    '>Edit</button><button class="action" onclick="deleteExpense(${x.expense_id})"
    >Delete</button></td></tr>`,
    )
    .join("");
  $("#recent").innerHTML =
    expenses
      .slice(0, 5)
      .map(
        (x) => `<div class="transaction">
    <div><b>${esc(x.description || x.category)}
    </b><small>${esc(x.category)} • 
    ${x.expense_date}</small>
    </div>
    <b class="red">-${money(x.amount)}
    </b></div>`,
      )
      .join("") || "<p class='muted'>No transactions yet.</p>";
}
$("#search").oninput = renderTransactions;
async function deleteExpense(id) {
  if (!confirm("Delete this expense?")) return;
  try {
    await api("/api/expenses/" + id, {
      method: "DELETE",
    });
    toast("Expense deleted");
    loadAll();
  } catch (e) {
    toast(e.message);
  }
}

function renderBudgets() {
  $("#budgetPreview").innerHTML =
    budgets
      .slice(0, 4)
      .map((b) => budgetHTML(b))
      .join("") || "<p class='muted'>No budgets yet.</p>";
  $("#budgetList").innerHTML =
    budgets
      .map(
        (b) => `<div class="budget-full">
    ${budgetHTML(b)}
    <div class="budget-actions">
    <button class="action" onclick="deleteBudget(${b.budget_id})">Delete</button>
    </div></div>`,
      )
      .join("") || "<p class='muted'>Create your first monthly budget.</p>";
  $("#sideBudget").textContent = money(
    budgets.reduce((a, b) => a + Number(b.limit_amount), 0),
  );
}
function budgetHTML(b) {
  const pct = Math.min(100, b.percentage);
  return `<div class="budget-item">
   <div class="budget-row"><b>
   ${esc(b.category)}
   </b><span>
   ${money(b.spent)} / 
   ${money(b.limit_amount)}(
   ${b.percentage}%)
   </span>
   </div>
   <div class="track">
   <div class="fill 
   ${b.percentage >= 90 ? "warn" : ""}" 
   style="width:${pct}%">
   </div>
   </div>
   </div>`;
}
$("#openBudget").onclick = () => {
  $("#budgetForm").innerHTML = `<label>Category</label>
  <select id="bCategory">
  ${["Food", "Shopping", "Travel", "Bills", "Entertainment", "Other"]
    .map((x) => `<option>${x}</option>`)
    .join("")}
  </select>
  <label>Limit amount</label>
  <input id="bLimit" type="number" min="1" required>
  <label>Month</label>
  <input id="bMonth" type="month" value="${new Date().toISOString().slice(0, 7)}" required>
  <button class="primary">Save budget</button>`;
  $("#budgetModal").classList.remove("hidden");
};
$("#budgetForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api("/api/budgets", {
      method: "POST",
      body: {
        category: $("#bCategory").value,
        limit_amount: +$("#bLimit").value,
        month: $("#bMonth").value,
      },
    });
    $("#budgetModal").classList.add("hidden");
    toast("Budget saved");
    loadAll();
  } catch (err) {
    toast(err.message);
  }
};
async function deleteBudget(id) {
  if (confirm("Delete this budget?")) {
    await api("/api/budgets/" + id, {
      method: "DELETE",
    });
    loadAll();
  }
}

async function renderCharts() {
  const cats = await api("/api/categories");
  const labels = cats.map((x) => x.category),
    data = cats.map((x) => x.total);
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart($("#categoryChart"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
}
async function renderReports() {
  const cats = await api("/api/categories");
  if (reportChart) reportChart.destroy();
  reportChart = new Chart($("#reportChart"), {
    type: "bar",
    data: {
      labels: cats.map((x) => x.category),
      datasets: [
        {
          label: "Expenses",
          data: cats.map((x) => x.total),
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
  const total = expenses.reduce((a, x) => a + Number(x.amount), 0),
    top = cats[0];
  $("#insights").innerHTML = `<div class="budget-full">
  <b>Total spending</b>
  <h2>${money(total)}</h2>
  <p class="muted">Across ${expenses.length} transactions.</p>
  </div>
 ${
   top
     ? `<div class="budget-full">
  <b>Highest category</b>
  <h3>${esc(top.category)}</h3>
  <p class="muted">${money(top.total)} spent here.</p>
  </div>`
     : ""
 }
 <div class="budget-full"><b>Tip</b>
 <p class="muted">Set category budgets and watch the progress bars to avoid overspending.</p>
 </div>`;
}

async function loadAll() {
  try {
    const [summary, expenseData, budgetData] = await Promise.all([
      api("/api/summary"),
      api("/api/expenses"),
      api("/api/budgets"),
    ]);
    expenses = expenseData;
    budgets = budgetData;
    $("#balance").textContent = money(summary.balance);
    $("#income").textContent = money(summary.income);
    $("#expenses").textContent = money(summary.expenses);
    $("#savings").textContent = money(summary.savings);
    renderTransactions();
    renderBudgets();
    await renderCharts();
  } catch (error) {
    console.error("LOAD ALL ERROR:", error);
    toast(error.message);
    if (error.message.includes("session") || error.message.includes("Login")) {
      localStorage.clear();
      showAuth();
    }
  }
}
$("#themeBtn").onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("dark", document.body.classList.contains("dark"));
};
if (localStorage.getItem("dark") === "true")
  document.body.classList.add("dark");
if (token && user) showApp();
else showAuth();
