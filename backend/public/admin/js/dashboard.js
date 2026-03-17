/* ══════════════════════════════════════════
   DASHBOARD — JS (extracted from abc.html)
   Called via loadDashboard() from index.html navigate()
══════════════════════════════════════════ */

/* ── API endpoint ── */
const DASH_API_BASE = "https://shri-brand.onrender.com/api/dashboard";

/* ── Shared chart registry ── */
let dashCharts = {};

/* ── Helpers ── */
const dashFmt = (n) =>
  Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const dashFmtRs = (n) => "₹" + dashFmt(n);
const dashEl = (id) => document.getElementById(id);

/* ── Chart color palette ── */
const DC = {
  primary: "#7f0403",
  gold: "#b8860b",
  goldLt: "#d4a520",
  green: "#2e7d52",
  red: "#b83232",
  blue: "#1a5fa8",
  purple: "#6b3fa0",
  muted: "#aa9988",
  grid: "rgba(184,134,11,0.08)",
  tooltipBg: "#1c1410",
};

const DASH_DONUT_COLORS = [
  DC.goldLt,
  DC.blue,
  DC.green,
  DC.purple,
  DC.red,
  "#b06030",
];

/* ── Analytics panel switching ── */
function switchDashPanel(idx, el) {
  document
    .querySelectorAll("#page-dashboard .a-tab")
    .forEach((t, i) => t.classList.toggle("active", i === idx));
  document
    .querySelectorAll("#page-dashboard .tab-panel")
    .forEach((p, i) => p.classList.toggle("active", i === idx));
  requestAnimationFrame(() => {
    Object.values(dashCharts).forEach((c) => {
      try {
        c.resize();
      } catch (_) {}
    });
  });
}

/* ── Destroy & recreate chart helper ── */
function dashDestroyChart(id) {
  if (dashCharts[id]) {
    dashCharts[id].destroy();
    delete dashCharts[id];
  }
}

/* ── Revenue chart data (built from API) ── */
let dashRevData = {
  daily: { labels: [], rev: [], ord: [] },
  weekly: { labels: [], rev: [], ord: [] },
  monthly: { labels: [], rev: [], ord: [] },
  yearly: { labels: [], rev: [], ord: [] },
};

function dashBuildRevData(apiChart) {
  // apiChart = [ { date: "2026-03-01", revenue: 1200, orders: 3 }, ... ]
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // ── Daily (raw from API — last 30 days) ──
  const daily = { labels: [], rev: [], ord: [] };
  apiChart.forEach((d) => {
    const dt = new Date(d.date);
    daily.labels.push(`${dt.getDate()}/${dt.getMonth() + 1}`);
    daily.rev.push(Math.round(d.revenue));
    daily.ord.push(d.orders);
  });

  // ── Weekly (aggregate last 7 days by day name) ──
  const weekly = { labels: [], rev: [], ord: [] };
  const last7 = apiChart.slice(-7);
  last7.forEach((d) => {
    const dt = new Date(d.date);
    weekly.labels.push(dayNames[dt.getDay()]);
    weekly.rev.push(Math.round(d.revenue));
    weekly.ord.push(d.orders);
  });

  // ── Monthly (daily data for current month from the API data) ──
  const monthly = { labels: [], rev: [], ord: [] };
  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();
  apiChart.forEach((d) => {
    const dt = new Date(d.date);
    if (dt.getMonth() === curMonth && dt.getFullYear() === curYear) {
      monthly.labels.push(String(dt.getDate()));
      monthly.rev.push(Math.round(d.revenue));
      monthly.ord.push(d.orders);
    }
  });
  // If no data for current month, fall back to daily
  if (!monthly.labels.length) {
    monthly.labels = daily.labels;
    monthly.rev = daily.rev;
    monthly.ord = daily.ord;
  }

  // ── Yearly (aggregate by month across all API data) ──
  const yearlyMap = {};
  apiChart.forEach((d) => {
    const dt = new Date(d.date);
    const key = dt.getMonth();
    if (!yearlyMap[key]) yearlyMap[key] = { rev: 0, ord: 0 };
    yearlyMap[key].rev += d.revenue;
    yearlyMap[key].ord += d.orders;
  });
  const yearly = { labels: [], rev: [], ord: [] };
  Object.keys(yearlyMap)
    .sort((a, b) => a - b)
    .forEach((m) => {
      yearly.labels.push(monthNames[+m]);
      yearly.rev.push(Math.round(yearlyMap[m].rev));
      yearly.ord.push(yearlyMap[m].ord);
    });

  dashRevData = { daily, weekly, monthly, yearly };
}

function dashBuildRevenueChart(startKey) {
  const key = startKey || "monthly";
  dashDestroyChart("revenueChart");
  const ctx = dashEl("revenueChart").getContext("2d");
  dashCharts["revenueChart"] = new Chart(ctx, {
    data: {
      labels: dashRevData[key].labels,
      datasets: [
        {
          type: "bar",
          label: "Revenue",
          data: dashRevData[key].rev,
          backgroundColor: "rgba(127,4,3,0.75)",
          hoverBackgroundColor: "rgba(127,4,3,1)",
          borderRadius: 2,
          order: 2,
          yAxisID: "yRev",
        },
        {
          type: "line",
          label: "Orders",
          data: dashRevData[key].ord,
          borderColor: "rgba(184,134,11,0.8)",
          backgroundColor: "rgba(184,134,11,0.06)",
          fill: true,
          tension: 0.42,
          pointRadius: 2,
          pointHoverRadius: 5,
          pointBackgroundColor: DC.gold,
          borderWidth: 1.8,
          order: 1,
          yAxisID: "yOrd",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#fff",
          titleColor: "#1c1410",
          bodyColor: "#7a6a58",
          borderColor: "rgba(184,134,11,0.28)",
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) =>
              ctx.datasetIndex === 0
                ? ` ₹${ctx.parsed.y.toLocaleString("en-IN")}`
                : ` ${ctx.parsed.y} orders`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: DC.grid },
          ticks: { color: DC.muted, font: { family: "Poppins", size: 10 } },
        },
        yRev: {
          position: "left",
          grid: { color: DC.grid },
          ticks: {
            color: DC.muted,
            font: { family: "Poppins", size: 10 },
            callback: (v) =>
              v >= 100000
                ? "₹" + (v / 100000).toFixed(1) + "L"
                : v >= 1000
                  ? "₹" + (v / 1000).toFixed(0) + "k"
                  : "₹" + v,
          },
        },
        yOrd: {
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: {
            color: "rgba(184,134,11,0.55)",
            font: { family: "Poppins", size: 10 },
          },
        },
      },
    },
  });
  // Update legend total for initial key
  const total = dashRevData[key].rev.reduce((a, b) => a + b, 0);
  dashEl("rev-total").innerHTML =
    dashFmtRs(total) + " <span>total this period</span>";
}

function switchRevTab(el, key) {
  document
    .querySelectorAll("#page-dashboard .ctab")
    .forEach((t) => t.classList.remove("on"));
  el.classList.add("on");
  const ch = dashCharts["revenueChart"];
  ch.data.labels = dashRevData[key].labels;
  ch.data.datasets[0].data = dashRevData[key].rev;
  ch.data.datasets[1].data = dashRevData[key].ord;
  ch.update("active");
  const total = dashRevData[key].rev.reduce((a, b) => a + b, 0);
  dashEl("rev-total").innerHTML =
    dashFmtRs(total) + " <span>total this period</span>";
  // Update subtitle
  const subEl = dashEl("rev-chart-sub");
  if (subEl) {
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const now = new Date();
    const subs = {
      weekly: "Last 7 days performance",
      monthly: `Daily performance · ${monthNames[now.getMonth()]} ${now.getFullYear()}`,
      yearly: `Monthly overview · ${now.getFullYear()}`,
      daily: "Daily performance · last 30 days",
    };
    subEl.textContent = subs[key] || "Performance overview";
  }
}

function dashMakeLineChart(id, labels, data, label, color) {
  dashDestroyChart(id);
  const ctx = dashEl(id).getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 210);
  grad.addColorStop(0, color + "25");
  grad.addColorStop(1, color + "00");
  dashCharts[id] = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label,
          data,
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: color,
          tension: 0.4,
          fill: true,
          backgroundColor: grad,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#fff",
          titleColor: "#1c1410",
          bodyColor: "#7a6a58",
          borderColor: "rgba(184,134,11,0.28)",
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (c) =>
              " " + (label.includes("Rev") ? dashFmtRs(c.raw) : dashFmt(c.raw)),
          },
        },
      },
      scales: {
        x: {
          grid: { color: DC.grid },
          ticks: {
            color: DC.muted,
            font: { family: "Poppins", size: 10 },
            maxTicksLimit: 8,
          },
        },
        y: {
          grid: { color: DC.grid },
          ticks: {
            color: DC.muted,
            font: { family: "Poppins", size: 10 },
            callback: (v) =>
              label.includes("Rev")
                ? v >= 1000
                  ? "₹" + (v / 1000).toFixed(0) + "k"
                  : "₹" + v
                : v,
          },
        },
      },
    },
  });
}

function dashMakeDonutChart(id, labels, data, colors) {
  dashDestroyChart(id);
  const ctx = dashEl(id).getContext("2d");
  dashCharts[id] = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors || DASH_DONUT_COLORS,
          borderColor: "#fff",
          borderWidth: 3,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: "72%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#fff",
          titleColor: "#1c1410",
          bodyColor: "#7a6a58",
          borderColor: "rgba(184,134,11,0.28)",
          borderWidth: 1,
          padding: 10,
        },
      },
    },
  });
}

function dashMakeSumRows(containerId, labels, values, colors, formatter) {
  const total = values.reduce((a, b) => a + b, 0);
  dashEl(containerId).innerHTML = labels
    .map(
      (l, i) => `
    <div class="sum-row">
      <span class="sum-dot" style="background:${(colors || DASH_DONUT_COLORS)[i]}"></span>
      <span class="sum-name">${l}</span>
      <span class="sum-amt">${formatter ? formatter(values[i]) : dashFmt(values[i])}</span>
      <span class="sum-pct">${total > 0 ? Math.round((values[i] / total) * 100) : 0}%</span>
    </div>`,
    )
    .join("");
}

function dashMakeBarRows(cid, items, maxVal, colors) {
  dashEl(cid).innerHTML = items
    .slice(0, 7)
    .map((item, i) => {
      const pct = maxVal > 0 ? Math.round((item.value / maxVal) * 100) : 0;
      const cls = colors ? colors[i % colors.length] : "";
      return `<div class="bar-row">
      <span class="bar-label">${item.label || "—"}</span>
      <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
      <span class="bar-count">${dashFmt(item.value)}</span>
    </div>`;
    })
    .join("");
}

/* ── Render Tab 1: Revenue & Orders ── */
function dashRenderRevenue(d) {
  dashEl("stat-totalRevenue").textContent = dashFmt(d.totalRevenue);
  dashEl("stat-ordersToday").textContent = dashFmt(d.ordersToday.count);
  dashEl("stat-ordersTodayRev").textContent =
    dashFmtRs(d.ordersToday.revenue) + " revenue";
  dashEl("stat-ordersWeek").textContent = dashFmt(d.ordersThisWeek.count);
  dashEl("stat-ordersWeekRev").textContent =
    dashFmtRs(d.ordersThisWeek.revenue) + " revenue";
  dashEl("stat-aov").textContent = dashFmt(d.avgOrderValue);
  dashEl("rev-total").innerHTML =
    dashFmtRs(d.totalRevenue) + " <span>all time</span>";

  // Build revenue chart data from API revenueChart array
  if (d.revenueChart && d.revenueChart.length) {
    dashBuildRevData(d.revenueChart);
  }
  dashBuildRevenueChart("monthly");

  const payLabels = d.paymentSplit.map((p) =>
    p.method === "razorpay"
      ? "Razorpay"
      : p.method === "cod"
        ? "COD"
        : p.method,
  );
  const payData = d.paymentSplit.map((p) => p.count);
  const payCols = [DC.blue, DC.purple];
  dashMakeDonutChart("paymentChart", payLabels, payData, payCols);
  dashMakeSumRows("paymentLegend", payLabels, payData, payCols);
  dashEl("pay-total").textContent = dashFmt(payData.reduce((a, b) => a + b, 0));

  const statusOrder = [
    "placed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];
  const statusColors = {
    placed: "blue",
    processing: "",
    shipped: "purple",
    delivered: "green",
    cancelled: "",
  };
  const sorted = statusOrder
    .map(
      (s) =>
        d.statusBreakdown.find((x) => x.status === s) || {
          status: s,
          count: 0,
        },
    )
    .filter((x) => x.count > 0);
  const maxS = Math.max(...sorted.map((x) => x.count), 1);
  dashEl("statusBars").innerHTML = sorted
    .map(
      (x) => `<div class="bar-row">
    <span class="bar-label"><span class="badge ${x.status}">${x.status}</span></span>
    <div class="bar-track"><div class="bar-fill ${statusColors[x.status] || ""}" style="width:${Math.round((x.count / maxS) * 100)}%"></div></div>
    <span class="bar-count">${dashFmt(x.count)}</span>
  </div>`,
    )
    .join("");
}

/* ── Render Tab 2: Products ── */
function dashRenderProducts(d) {
  dashEl("stat-totalProducts").textContent = dashFmt(d.activeStats.total);
  dashEl("stat-activeProducts").textContent = dashFmt(d.activeStats.active);
  dashEl("stat-lowStock").textContent = dashFmt(d.lowStockCount);
  dashEl("stat-outStock").textContent = dashFmt(d.outOfStockCount);

  const catLabels = d.byCategory.map((c) => c.category);
  const catData = d.byCategory.map((c) => c.count);
  dashMakeDonutChart("categoryChart", catLabels, catData);
  dashMakeSumRows("categoryLegend", catLabels, catData);
  dashEl("cat-total").textContent = dashFmt(catData.reduce((a, b) => a + b, 0));

  dashMakeDonutChart(
    "activeChart",
    ["Active", "Inactive"],
    [d.activeStats.active, d.activeStats.inactive],
    [DC.green, DC.muted],
  );
  dashMakeSumRows(
    "activeLegend",
    ["Active", "Inactive"],
    [d.activeStats.active, d.activeStats.inactive],
    [DC.green, DC.muted],
  );
  dashEl("active-total").textContent = dashFmt(d.activeStats.total);

  dashEl("topSellersBody").innerHTML = d.topSellers.length
    ? d.topSellers
        .map(
          (p, i) => `<tr>
        <td><span class="rank ${i < 3 ? "top" : ""}">${i + 1}</span></td>
        <td><strong style="color:var(--text,#1c1410)">${p.name}</strong></td>
        <td><span style="font-size:10px;font-family:'Poppins',sans-serif;font-weight:600;color:var(--gold,#b8860b);background:rgba(184,134,11,.11);border:1px solid rgba(184,134,11,.22);padding:2px 8px;">${p.fragranceCategory}</span></td>
        <td class="td-num">${dashFmt(p.totalSoldAll)}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:#aa9988;padding:24px">No sales data yet</td></tr>`;

  dashEl("lowStockBody").innerHTML = d.lowStockProducts.length
    ? d.lowStockProducts
        .map(
          (p) => `<tr>
        <td>${p.name}</td><td>${p.packs.weight}</td>
        <td><span class="badge low-stock">${p.packs.stock}</span></td>
        <td class="td-muted">${p.packs.lowStockThreshold}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:#aa9988;padding:24px">All good ✓</td></tr>`;

  dashEl("outOfStockBody").innerHTML = d.outOfStockProducts.length
    ? d.outOfStockProducts
        .map(
          (p) => `<tr>
        <td>${p.name}</td><td>${p.packs.weight}</td>
        <td class="td-muted">${p.packs.sku || "—"}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" style="text-align:center;color:#aa9988;padding:24px">All in stock ✓</td></tr>`;
}

/* ── Render Tab 3: Customers ── */
function dashRenderCustomers(d) {
  dashEl("stat-totalUsers").textContent = dashFmt(d.totalUsers);
  dashEl("stat-newToday").textContent = dashFmt(d.newSignups.today);
  dashEl("stat-newWeek").textContent =
    dashFmt(d.newSignups.week) + " this week";
  dashEl("stat-repeat").textContent = dashFmt(d.repeatCustomers);
  dashEl("stat-locked").textContent = dashFmt(d.lockedAccounts);

  const scLabels = d.signupChart.map((r) => {
    const [, m, dy] = r.date.split("-");
    return `${dy}/${m}`;
  });
  dashMakeLineChart(
    "signupChart",
    scLabels,
    d.signupChart.map((r) => r.count),
    "Signups",
    DC.blue,
  );

  dashMakeDonutChart(
    "verifiedChart",
    ["Verified", "Unverified"],
    [d.verifiedStats.verified, d.verifiedStats.unverified],
    [DC.green, DC.muted],
  );
  dashMakeSumRows(
    "verifiedLegend",
    ["Verified", "Unverified"],
    [d.verifiedStats.verified, d.verifiedStats.unverified],
    [DC.green, DC.muted],
  );
  dashEl("ver-total").textContent = dashFmt(
    d.verifiedStats.verified + d.verifiedStats.unverified,
  );

  const maxState = Math.max(...d.topStates.map((s) => s.count), 1);
  dashMakeBarRows(
    "stateBars",
    d.topStates.map((s) => ({ label: s.state || "Unknown", value: s.count })),
    maxState,
    ["blue", "purple", "", "green"],
  );

  dashEl("topCustomersBody").innerHTML = d.topCustomersBySpend.length
    ? d.topCustomersBySpend
        .map(
          (c, i) => `<tr>
        <td><span class="rank ${i < 3 ? "top" : ""}">${i + 1}</span></td>
        <td><strong style="color:var(--text,#1c1410)">${c.name || "—"}</strong></td>
        <td class="td-muted">${c.email || "—"}</td>
        <td class="td-num">${dashFmt(c.orderCount)}</td>
        <td><strong style="color:var(--primary,#7f0403);font-family:'Poppins',sans-serif;font-size:12.5px">${dashFmtRs(c.totalSpend)}</strong></td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:#aa9988;padding:24px">No orders yet</td></tr>`;
}

/* ── Main load function — called by navigate() in index.html ── */
async function loadDashboard() {
  // Ensure Chart.js defaults are set each time
  if (typeof Chart !== "undefined") {
    Chart.defaults.color = DC.muted;
    Chart.defaults.borderColor = DC.grid;
  }

  try {
    const res = await fetch(`${DASH_API_BASE}/all`, { credentials: "include" });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const json = await res.json();
    if (json.status !== "success") throw new Error("Dashboard API error");
    dashRenderRevenue(json.data.revenue);
    dashRenderProducts(json.data.products);
    dashRenderCustomers(json.data.customers);
  } catch (e) {
    console.error("Dashboard load failed:", e.message);
  }
}
