// ============================================================
//  admin.js — Admin Dashboard Logic
//  Replace BACKEND_URL with your live Railway URL before deploy
// ============================================================

const BACKEND_URL = "https://YOUR-RAILWAY-APP.railway.app";

// ---- Hardcoded admin credentials (client-side only guard) ----
// For production, move auth to the backend with JWT or session tokens.
const ADMIN_USER = "admin";
const ADMIN_PASS = "paperformat2024";

let authToken = null; // stored after login for backend requests

// ---- Login ----
function doLogin() {
  const user = document.getElementById("admin-user").value.trim();
  const pass = document.getElementById("admin-pass").value;
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    authToken = btoa(`${user}:${pass}`); // basic auth token for backend
    sessionStorage.setItem("pf_admin", authToken);
    document.getElementById("login-overlay").style.display = "none";
    document.getElementById("admin-panel").style.display = "flex";
    loadOrders();
  } else {
    errEl.textContent = "Invalid credentials.";
    document.getElementById("admin-pass").value = "";
  }
}

function doLogout() {
  sessionStorage.removeItem("pf_admin");
  authToken = null;
  document.getElementById("login-overlay").style.display = "flex";
  document.getElementById("admin-panel").style.display = "none";
  document.getElementById("admin-user").value = "";
  document.getElementById("admin-pass").value = "";
}

// ---- Auto-login from session ----
window.addEventListener("DOMContentLoaded", () => {
  const saved = sessionStorage.getItem("pf_admin");
  if (saved) {
    authToken = saved;
    document.getElementById("login-overlay").style.display = "none";
    document.getElementById("admin-panel").style.display = "flex";
    loadOrders();
  }

  // Allow Enter key on login form
  document.getElementById("admin-pass").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });
  document.getElementById("admin-user").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });
});

// ---- Load Orders ----
async function loadOrders() {
  const tbody = document.getElementById("orders-tbody");
  tbody.innerHTML = `<tr class="loading-row"><td colspan="10">LOADING ORDERS...</td></tr>`;

  try {
    const res = await fetch(`${BACKEND_URL}/orders`, {
      headers: { "Authorization": `Basic ${authToken}` },
    });

    if (res.status === 401) {
      doLogout();
      return;
    }

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const orders = await res.json();
    renderOrders(orders);
    updateStats(orders);

    const now = new Date();
    document.getElementById("last-refresh").textContent =
      `Last refreshed: ${now.toLocaleTimeString()}`;

  } catch (err) {
    console.error("Failed to load orders:", err);
    tbody.innerHTML = `<tr class="loading-row"><td colspan="10">FAILED TO LOAD ORDERS. CHECK BACKEND CONNECTION.</td></tr>`;
  }
}

// ---- Render table rows ----
function renderOrders(orders) {
  const tbody = document.getElementById("orders-tbody");

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10">NO ORDERS YET.</td></tr>`;
    return;
  }

  // Sort newest first
  const sorted = [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  tbody.innerHTML = sorted.map(order => {
    const whatsappNum = order.phone.replace(/\D/g, "");
    const waLink = `https://wa.me/${whatsappNum}`;
    const dateStr = order.created_at
      ? new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : "—";
    const timeStr = order.created_at
      ? new Date(order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
      : "";

    const statusBadge = order.status === "completed"
      ? `<span class="badge badge-completed">Completed</span>`
      : `<span class="badge badge-pending">Pending</span>`;

    const toggleBtn = order.status === "completed"
      ? `<button class="btn-action pending" onclick="toggleStatus(${order.id}, 'pending')">Mark Pending</button>`
      : `<button class="btn-action complete" onclick="toggleStatus(${order.id}, 'completed')">Mark Complete</button>`;

    const fileCell = order.file_url
      ? `<a href="${BACKEND_URL}${order.file_url}" target="_blank" class="link-blue">Download</a>`
      : `<span class="font-mono text-xs text-gray-300">—</span>`;

    const formatCell = order.formatting_type || `<span class="text-gray-300">—</span>`;
    const instrCell = order.instructions
      ? `<div class="instructions-cell" title="${escapeHtml(order.instructions)}">${truncate(escapeHtml(order.instructions), 60)}</div>`
      : `<span class="font-mono text-xs text-gray-300">—</span>`;

    return `
      <tr id="row-${order.id}">
        <td class="id-cell">#${String(order.id).padStart(4, "0")}</td>
        <td class="id-cell" style="white-space:nowrap;">${dateStr}<br/>${timeStr}</td>
        <td class="font-medium" style="white-space:nowrap;">${escapeHtml(order.full_name)}</td>
        <td style="white-space:nowrap;">
          <a href="${waLink}" target="_blank" class="link-blue">${escapeHtml(order.phone)}</a>
        </td>
        <td class="topic-cell">${escapeHtml(order.topic)}</td>
        <td class="font-mono text-xs">${formatCell}</td>
        <td>${fileCell}</td>
        <td>${instrCell}</td>
        <td>${statusBadge}</td>
        <td style="white-space:nowrap;">${toggleBtn}</td>
      </tr>
    `;
  }).join("");
}

// ---- Update stats bar ----
function updateStats(orders) {
  const total = orders.length;
  const pending = orders.filter(o => o.status === "pending").length;
  const completed = orders.filter(o => o.status === "completed").length;
  const withFiles = orders.filter(o => o.file_url).length;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-pending").textContent = pending;
  document.getElementById("stat-completed").textContent = completed;
  document.getElementById("stat-files").textContent = withFiles;
}

// ---- Toggle Status ----
async function toggleStatus(orderId, newStatus) {
  const btn = document.querySelector(`#row-${orderId} .btn-action`);
  if (btn) { btn.disabled = true; btn.textContent = "..."; }

  try {
    const res = await fetch(`${BACKEND_URL}/orders/${orderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authToken}`,
      },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.status === 401) { doLogout(); return; }
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    // Reload to reflect changes
    await loadOrders();

  } catch (err) {
    console.error("Failed to update status:", err);
    if (btn) { btn.disabled = false; btn.textContent = "Error"; }
    setTimeout(() => loadOrders(), 1000);
  }
}

// ---- Utilities ----
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(str, maxLen) {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
}
