/* ══════════════════════════════════════════
   DASHBOARD — JS (extracted from abc.html)
   Called via loadDashboard() from index.html navigate()
══════════════════════════════════════════ */

/* ── API endpoint ── */
const DASH_API_BASE = "http://localhost:5000/api/dashboard";

/* ── Shared chart registry ── */
let dashCharts = {};

/* ── Helpers ── */
const dashFmt   = n => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const dashFmtRs = n => "₹" + dashFmt(n);
const dashEl    = id => document.getElementById(id);

/* ── Chart color palette ── */
const DC = {
  primary:   "#7f0403",
  gold:      "#b8860b",
  goldLt:    "#d4a520",
  green:     "#2e7d52",
  red:       "#b83232",
  blue:      "#1a5fa8",
  purple:    "#6b3fa0",
  muted:     "#aa9988",
  grid:      "rgba(184,134,11,0.08)",
  tooltipBg: "#1c1410",
};

const DASH_DONUT_COLORS = [DC.goldLt, DC.blue, DC.green, DC.purple, DC.red, "#b06030"];

/* ── Analytics panel switching ── */
function switchDashPanel(idx, el) {
  document.querySelectorAll('#page-dashboard .a-tab').forEach((t, i) =>
    t.classList.toggle('active', i === idx)
  );
  document.querySelectorAll('#page-dashboard .tab-panel').forEach((p, i) =>
    p.classList.toggle('active', i === idx)
  );
  requestAnimationFrame(() => {
    Object.values(dashCharts).forEach(c => { try { c.resize(); } catch (_) {} });
  });
}

/* ── Destroy & recreate chart helper ── */
function dashDestroyChart(id) {
  if (dashCharts[id]) { dashCharts[id].destroy(); delete dashCharts[id]; }
}

/* ── Revenue chart static data ── */
const dashRevData = {
  monthly: {
    labels: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15'],
    rev:    [18400,24600,21300,31200,28700,35400,29800,42100,38500,44200,39600,51000,46800,53200,58100],
    ord:    [28,38,31,47,42,56,44,66,58,68,61,78,72,82,92]
  },
  weekly: {
    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    rev:    [82400,71200,95600,88300,112400,124600,98200],
    ord:    [120,105,142,130,168,188,148]
  },
  yearly: {
    labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    rev:    [620000,590000,842560,780000,910000,875000,950000,1020000,980000,1050000,1100000,1250000],
    ord:    [950,910,1284,1190,1380,1320,1450,1560,1490,1600,1680,1920]
  }
};

function dashBuildRevenueChart() {
  dashDestroyChart('revenueChart');
  const ctx = dashEl('revenueChart').getContext('2d');
  dashCharts['revenueChart'] = new Chart(ctx, {
    data: {
      labels: dashRevData.monthly.labels,
      datasets: [
        {
          type: 'bar', label: 'Revenue', data: dashRevData.monthly.rev,
          backgroundColor: 'rgba(127,4,3,0.75)', hoverBackgroundColor: 'rgba(127,4,3,1)',
          borderRadius: 2, order: 2, yAxisID: 'yRev'
        },
        {
          type: 'line', label: 'Orders', data: dashRevData.monthly.ord,
          borderColor: 'rgba(184,134,11,0.8)', backgroundColor: 'rgba(184,134,11,0.06)',
          fill: true, tension: 0.42, pointRadius: 2, pointHoverRadius: 5,
          pointBackgroundColor: DC.gold, borderWidth: 1.8, order: 1, yAxisID: 'yOrd'
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#fff', titleColor: '#1c1410', bodyColor: '#7a6a58',
          borderColor: 'rgba(184,134,11,0.28)', borderWidth: 1, padding: 10,
          callbacks: {
            label: ctx => ctx.datasetIndex === 0
              ? ` ₹${ctx.parsed.y.toLocaleString('en-IN')}`
              : ` ${ctx.parsed.y} orders`
          }
        }
      },
      scales: {
        x: { grid: { color: DC.grid }, ticks: { color: DC.muted, font: { family: 'Poppins', size: 10 } } },
        yRev: {
          position: 'left', grid: { color: DC.grid },
          ticks: {
            color: DC.muted, font: { family: 'Poppins', size: 10 },
            callback: v => v >= 100000 ? '₹' + (v / 100000).toFixed(1) + 'L'
              : v >= 1000 ? '₹' + (v / 1000).toFixed(0) + 'k'
                : '₹' + v
          }
        },
        yOrd: {
          position: 'right', grid: { drawOnChartArea: false },
          ticks: { color: 'rgba(184,134,11,0.55)', font: { family: 'Poppins', size: 10 } }
        }
      }
    }
  });
}

function switchRevTab(el, key) {
  document.querySelectorAll('#page-dashboard .ctab').forEach(t => t.classList.remove('on'));
  el.classList.add('on');
  const ch = dashCharts['revenueChart'];
  ch.data.labels = dashRevData[key].labels;
  ch.data.datasets[0].data = dashRevData[key].rev;
  ch.data.datasets[1].data = dashRevData[key].ord;
  ch.update('active');
  const total = dashRevData[key].rev.reduce((a, b) => a + b, 0);
  dashEl('rev-total').innerHTML = dashFmtRs(total) + ' <span>total this period</span>';
}

function dashMakeLineChart(id, labels, data, label, color) {
  dashDestroyChart(id);
  const ctx = dashEl(id).getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 210);
  grad.addColorStop(0, color + '25');
  grad.addColorStop(1, color + '00');
  dashCharts[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels, datasets: [{
        label, data, borderColor: color, borderWidth: 2,
        pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: color,
        tension: 0.4, fill: true, backgroundColor: grad
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#fff', titleColor: '#1c1410', bodyColor: '#7a6a58',
          borderColor: 'rgba(184,134,11,0.28)', borderWidth: 1, padding: 10,
          callbacks: { label: c => ' ' + (label.includes('Rev') ? dashFmtRs(c.raw) : dashFmt(c.raw)) }
        }
      },
      scales: {
        x: { grid: { color: DC.grid }, ticks: { color: DC.muted, font: { family: 'Poppins', size: 10 }, maxTicksLimit: 8 } },
        y: {
          grid: { color: DC.grid },
          ticks: {
            color: DC.muted, font: { family: 'Poppins', size: 10 },
            callback: v => label.includes('Rev')
              ? (v >= 1000 ? '₹' + (v / 1000).toFixed(0) + 'k' : '₹' + v)
              : v
          }
        }
      }
    }
  });
}

function dashMakeDonutChart(id, labels, data, colors) {
  dashDestroyChart(id);
  const ctx = dashEl(id).getContext('2d');
  dashCharts[id] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels, datasets: [{
        data,
        backgroundColor: colors || DASH_DONUT_COLORS,
        borderColor: '#fff', borderWidth: 3, hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#fff', titleColor: '#1c1410', bodyColor: '#7a6a58',
          borderColor: 'rgba(184,134,11,0.28)', borderWidth: 1, padding: 10,
        }
      }
    }
  });
}

function dashMakeSumRows(containerId, labels, values, colors, formatter) {
  const total = values.reduce((a, b) => a + b, 0);
  dashEl(containerId).innerHTML = labels.map((l, i) => `
    <div class="sum-row">
      <span class="sum-dot" style="background:${(colors || DASH_DONUT_COLORS)[i]}"></span>
      <span class="sum-name">${l}</span>
      <span class="sum-amt">${formatter ? formatter(values[i]) : dashFmt(values[i])}</span>
      <span class="sum-pct">${total > 0 ? Math.round(values[i] / total * 100) : 0}%</span>
    </div>`).join('');
}

function dashMakeBarRows(cid, items, maxVal, colors) {
  dashEl(cid).innerHTML = items.slice(0, 7).map((item, i) => {
    const pct = maxVal > 0 ? Math.round(item.value / maxVal * 100) : 0;
    const cls = colors ? colors[i % colors.length] : '';
    return `<div class="bar-row">
      <span class="bar-label">${item.label || '—'}</span>
      <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
      <span class="bar-count">${dashFmt(item.value)}</span>
    </div>`;
  }).join('');
}

/* ── Render Tab 1: Revenue & Orders ── */
function dashRenderRevenue(d) {
  dashEl('stat-totalRevenue').textContent   = dashFmt(d.totalRevenue);
  dashEl('stat-ordersToday').textContent    = dashFmt(d.ordersToday.count);
  dashEl('stat-ordersTodayRev').textContent = dashFmtRs(d.ordersToday.revenue) + ' revenue';
  dashEl('stat-ordersWeek').textContent     = dashFmt(d.ordersThisWeek.count);
  dashEl('stat-ordersWeekRev').textContent  = dashFmtRs(d.ordersThisWeek.revenue) + ' revenue';
  dashEl('stat-aov').textContent            = dashFmt(d.avgOrderValue);
  dashEl('rev-total').innerHTML             = dashFmtRs(d.totalRevenue) + ' <span>all time</span>';

  dashBuildRevenueChart();

  const payLabels = d.paymentSplit.map(p =>
    p.method === 'razorpay' ? 'Razorpay' : p.method === 'cod' ? 'COD' : p.method
  );
  const payData = d.paymentSplit.map(p => p.count);
  const payCols = [DC.blue, DC.purple];
  dashMakeDonutChart('paymentChart', payLabels, payData, payCols);
  dashMakeSumRows('paymentLegend', payLabels, payData, payCols);
  dashEl('pay-total').textContent = dashFmt(payData.reduce((a, b) => a + b, 0));

  const statusOrder  = ['placed', 'processing', 'shipped', 'delivered', 'cancelled'];
  const statusColors = { placed: 'blue', processing: '', shipped: 'purple', delivered: 'green', cancelled: '' };
  const sorted = statusOrder
    .map(s => d.statusBreakdown.find(x => x.status === s) || { status: s, count: 0 })
    .filter(x => x.count > 0);
  const maxS = Math.max(...sorted.map(x => x.count), 1);
  dashEl('statusBars').innerHTML = sorted.map(x => `<div class="bar-row">
    <span class="bar-label"><span class="badge ${x.status}">${x.status}</span></span>
    <div class="bar-track"><div class="bar-fill ${statusColors[x.status] || ''}" style="width:${Math.round(x.count / maxS * 100)}%"></div></div>
    <span class="bar-count">${dashFmt(x.count)}</span>
  </div>`).join('');
}

/* ── Render Tab 2: Products ── */
function dashRenderProducts(d) {
  dashEl('stat-totalProducts').textContent  = dashFmt(d.activeStats.total);
  dashEl('stat-activeProducts').textContent = dashFmt(d.activeStats.active);
  dashEl('stat-lowStock').textContent       = dashFmt(d.lowStockCount);
  dashEl('stat-outStock').textContent       = dashFmt(d.outOfStockCount);

  const catLabels = d.byCategory.map(c => c.category);
  const catData   = d.byCategory.map(c => c.count);
  dashMakeDonutChart('categoryChart', catLabels, catData);
  dashMakeSumRows('categoryLegend', catLabels, catData);
  dashEl('cat-total').textContent = dashFmt(catData.reduce((a, b) => a + b, 0));

  dashMakeDonutChart('activeChart', ['Active', 'Inactive'],
    [d.activeStats.active, d.activeStats.inactive], [DC.green, DC.muted]);
  dashMakeSumRows('activeLegend', ['Active', 'Inactive'],
    [d.activeStats.active, d.activeStats.inactive], [DC.green, DC.muted]);
  dashEl('active-total').textContent = dashFmt(d.activeStats.total);

  dashEl('topSellersBody').innerHTML = d.topSellers.length
    ? d.topSellers.map((p, i) => `<tr>
        <td><span class="rank ${i < 3 ? 'top' : ''}">${i + 1}</span></td>
        <td><strong style="color:var(--text,#1c1410)">${p.name}</strong></td>
        <td><span style="font-size:10px;font-family:'Poppins',sans-serif;font-weight:600;color:var(--gold,#b8860b);background:rgba(184,134,11,.11);border:1px solid rgba(184,134,11,.22);padding:2px 8px;">${p.fragranceCategory}</span></td>
        <td class="td-num">${dashFmt(p.totalSoldAll)}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" style="text-align:center;color:#aa9988;padding:24px">No sales data yet</td></tr>`;

  dashEl('lowStockBody').innerHTML = d.lowStockProducts.length
    ? d.lowStockProducts.map(p => `<tr>
        <td>${p.name}</td><td>${p.packs.weight}</td>
        <td><span class="badge low-stock">${p.packs.stock}</span></td>
        <td class="td-muted">${p.packs.lowStockThreshold}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" style="text-align:center;color:#aa9988;padding:24px">All good ✓</td></tr>`;

  dashEl('outOfStockBody').innerHTML = d.outOfStockProducts.length
    ? d.outOfStockProducts.map(p => `<tr>
        <td>${p.name}</td><td>${p.packs.weight}</td>
        <td class="td-muted">${p.packs.sku || '—'}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" style="text-align:center;color:#aa9988;padding:24px">All in stock ✓</td></tr>`;
}

/* ── Render Tab 3: Customers ── */
function dashRenderCustomers(d) {
  dashEl('stat-totalUsers').textContent = dashFmt(d.totalUsers);
  dashEl('stat-newToday').textContent   = dashFmt(d.newSignups.today);
  dashEl('stat-newWeek').textContent    = dashFmt(d.newSignups.week) + ' this week';
  dashEl('stat-repeat').textContent     = dashFmt(d.repeatCustomers);
  dashEl('stat-locked').textContent     = dashFmt(d.lockedAccounts);

  const scLabels = d.signupChart.map(r => {
    const [, m, dy] = r.date.split('-');
    return `${dy}/${m}`;
  });
  dashMakeLineChart('signupChart', scLabels, d.signupChart.map(r => r.count), 'Signups', DC.blue);

  dashMakeDonutChart('verifiedChart',
    ['Verified', 'Unverified'],
    [d.verifiedStats.verified, d.verifiedStats.unverified],
    [DC.green, DC.muted]
  );
  dashMakeSumRows('verifiedLegend',
    ['Verified', 'Unverified'],
    [d.verifiedStats.verified, d.verifiedStats.unverified],
    [DC.green, DC.muted]
  );
  dashEl('ver-total').textContent = dashFmt(d.verifiedStats.verified + d.verifiedStats.unverified);

  const maxState = Math.max(...d.topStates.map(s => s.count), 1);
  dashMakeBarRows('stateBars', d.topStates.map(s => ({ label: s.state || 'Unknown', value: s.count })), maxState, ['blue', 'purple', '', 'green']);

  dashEl('topCustomersBody').innerHTML = d.topCustomersBySpend.length
    ? d.topCustomersBySpend.map((c, i) => `<tr>
        <td><span class="rank ${i < 3 ? 'top' : ''}">${i + 1}</span></td>
        <td><strong style="color:var(--text,#1c1410)">${c.name || '—'}</strong></td>
        <td class="td-muted">${c.email || '—'}</td>
        <td class="td-num">${dashFmt(c.orderCount)}</td>
        <td><strong style="color:var(--primary,#7f0403);font-family:'Poppins',sans-serif;font-size:12.5px">${dashFmtRs(c.totalSpend)}</strong></td>
      </tr>`).join('')
    : `<tr><td colspan="5" style="text-align:center;color:#aa9988;padding:24px">No orders yet</td></tr>`;
}

/* ── Mock data fallback ── */
function dashLoadMockData() {
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 29 + i);
    return d.toISOString().slice(0, 10);
  });

  dashRenderRevenue({
    totalRevenue:   842560,
    avgOrderValue:  656,
    ordersToday:    { count: 14, revenue: 17430 },
    ordersThisWeek: { count: 87, revenue: 108225 },
    paymentSplit: [
      { method: 'razorpay', count: 312, revenue: 389000 },
      { method: 'cod',      count: 75,  revenue: 93600  }
    ],
    revenueChart: days.map((date, i) => ({
      date,
      revenue: 8000 + Math.sin(i * .4) * 3000 + Math.random() * 4000,
      orders:  6 + Math.floor(Math.random() * 8),
    })),
    statusBreakdown: [
      { status: 'placed',     count: 42  },
      { status: 'processing', count: 38  },
      { status: 'shipped',    count: 91  },
      { status: 'delivered',  count: 184 },
      { status: 'cancelled',  count: 21  }
    ]
  });

  dashRenderProducts({
    activeStats: { total: 48, active: 41, inactive: 7 },
    lowStockCount: 3, outOfStockCount: 2,
    byCategory: [
      { category: 'floral',   count: 14 },
      { category: 'woody',    count: 11 },
      { category: 'resin',    count: 9  },
      { category: 'heritage', count: 8  },
      { category: 'mixed',    count: 6  }
    ],
    topSellers: [
      { name: 'Rose Agarbatti',     fragranceCategory: 'floral',   totalSoldAll: 1840 },
      { name: 'Sandalwood Classic', fragranceCategory: 'woody',    totalSoldAll: 1512 },
      { name: 'Guggul Dhoop',       fragranceCategory: 'resin',    totalSoldAll: 1203 },
      { name: 'Jasmine Premium',    fragranceCategory: 'floral',   totalSoldAll: 984  },
      { name: 'Chandan Heritage',   fragranceCategory: 'heritage', totalSoldAll: 761  },
      { name: 'Loban Mix',          fragranceCategory: 'mixed',    totalSoldAll: 640  }
    ],
    lowStockProducts: [
      { name: 'Rose Agarbatti',     packs: { weight: '40g',  stock: 4, lowStockThreshold: 10, sku: 'ROSE-40'  } },
      { name: 'Sandalwood Classic', packs: { weight: '80g',  stock: 7, lowStockThreshold: 10, sku: 'SAND-80'  } },
      { name: 'Jasmine Premium',    packs: { weight: '100g', stock: 3, lowStockThreshold: 10, sku: 'JASM-100' } }
    ],
    outOfStockProducts: [
      { name: 'Guggul Dhoop', packs: { weight: '200g', sku: 'GUGG-200' } },
      { name: 'Loban Mix',    packs: { weight: '40g',  sku: 'LOBN-40'  } }
    ]
  });

  dashRenderCustomers({
    totalUsers:      1284,
    newSignups:      { today: 8, week: 47, month: 194 },
    repeatCustomers: 346,
    lockedAccounts:  2,
    verifiedStats:   { verified: 1086, unverified: 198 },
    topStates: [
      { state: 'Tamil Nadu',    count: 284 },
      { state: 'Maharashtra',   count: 198 },
      { state: 'Karnataka',     count: 162 },
      { state: 'Gujarat',       count: 141 },
      { state: 'Uttar Pradesh', count: 118 },
      { state: 'Rajasthan',     count: 94  }
    ],
    signupChart: days.map((date, i) => ({
      date,
      count: 3 + Math.floor(Math.sin(i * .3) * 2 + Math.random() * 6)
    })),
    topCustomersBySpend: [
      { name: 'Priya Nair',    email: 'priya@gmail.com',   orderCount: 12, totalSpend: 18400 },
      { name: 'Rajan Mehta',   email: 'rajan@outlook.com', orderCount: 9,  totalSpend: 14200 },
      { name: 'Kavitha Nair',  email: 'kavitha@gmail.com', orderCount: 8,  totalSpend: 11800 },
      { name: 'Suresh Pillai', email: 'suresh@yahoo.com',  orderCount: 7,  totalSpend: 9600  },
      { name: 'Ananya Iyer',   email: 'ananya@gmail.com',  orderCount: 6,  totalSpend: 8100  }
    ]
  });
}

/* ── Main load function — called by navigate() in index.html ── */
async function loadDashboard() {
  // Ensure Chart.js defaults are set each time
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color       = DC.muted;
    Chart.defaults.borderColor = DC.grid;
  }

  try {
    const res  = await fetch(`${DASH_API_BASE}/all`);
    if (!res.ok) throw new Error();
    const json = await res.json();
    if (json.status !== 'success') throw new Error();
    dashRenderRevenue(json.data.revenue);
    dashRenderProducts(json.data.products);
    dashRenderCustomers(json.data.customers);
  } catch {
    dashLoadMockData();
  }
}