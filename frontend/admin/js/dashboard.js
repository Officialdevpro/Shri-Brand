// Theme Management
function initTheme() {
  updateChartThemes();
}

function updateChartThemes() {
  // Update all charts with new theme
  if (revenueChart) {
    revenueChart.options.scales.x.grid.color = gridColor;
    revenueChart.options.scales.y.grid.color = gridColor;
    revenueChart.options.scales.x.ticks.color = textColor;
    revenueChart.options.scales.y.ticks.color = textColor;
    revenueChart.update();
  }

  if (paymentChart) {
    paymentChart.options.plugins.legend.labels.color = textColor;
    paymentChart.update();
  }

  if (dailySalesChart) {
    dailySalesChart.options.scales.x.grid.color = gridColor;
    dailySalesChart.options.scales.y.grid.color = gridColor;
    dailySalesChart.options.scales.x.ticks.color = textColor;
    dailySalesChart.options.scales.y.ticks.color = textColor;
    dailySalesChart.options.plugins.legend.labels.color = textColor;
    dailySalesChart.update();
  }
}

// Initialize Charts
let revenueChart, paymentChart, dailySalesChart;

function initCharts() {
  const gridColor =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "rgba(255, 255, 255, 0.1)"
      : "rgba(0, 0, 0, 0.1)";
  const textColor =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "#94a3b8"
      : "#64748b";

  // Revenue Chart
  const revenueCtx = document.getElementById("revenueChart").getContext("2d");
  revenueChart = new Chart(revenueCtx, {
    type: "line",
    data: {
      labels: generateMonthLabels(),
      datasets: [
        {
          label: "Revenue",
          data: generateRevenueData(),
          borderColor: "#6366f1",
          backgroundColor: "rgba(99, 102, 241, 0.1)",
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: "#22d3ee",
          pointBorderColor:
            document.documentElement.getAttribute("data-theme") === "dark"
              ? "#ffffff"
              : "#0a0e17",
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: "index",
          intersect: false,
          backgroundColor: "rgba(18, 24, 40, 0.9)",
          titleColor: "#f1f5f9",
          bodyColor: "#cbd5e1",
          borderColor: "#6366f1",
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: function (context) {
              return `₹${context.parsed.y.toLocaleString("en-IN")}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor },
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            callback: function (value) {
              return "₹" + (value / 100000).toFixed(1) + "L";
            },
          },
        },
      },
      interaction: {
        intersect: false,
        mode: "nearest",
      },
    },
  });

  // Payment Chart
  const paymentCtx = document.getElementById("paymentChart").getContext("2d");
  paymentChart = new Chart(paymentCtx, {
    type: "doughnut",
    data: {
      labels: ["UPI", "Credit/Debit Cards", "Cash", "Net Banking", "Wallet"],
      datasets: [
        {
          data: [48, 32, 12, 5, 3],
          backgroundColor: [
            "#6366f1",
            "#22d3ee",
            "#10b981",
            "#f59e0b",
            "#8b5cf6",
          ],
          borderWidth: 0,
          hoverOffset: 20,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: textColor,
            padding: 20,
            font: { size: 12 },
          },
        },
        tooltip: {
          backgroundColor: "rgba(18, 24, 40, 0.9)",
          titleColor: "#f1f5f9",
          bodyColor: "#cbd5e1",
          borderColor: "#6366f1",
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: function (context) {
              return `${context.label}: ${context.parsed}%`;
            },
          },
        },
      },
    },
  });

  // Daily Sales Chart
  const salesCtx = document.getElementById("dailySalesChart").getContext("2d");
  dailySalesChart = new Chart(salesCtx, {
    type: "bar",
    data: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      datasets: [
        {
          label: "This Week",
          data: [45, 52, 38, 65, 72, 88, 42],
          backgroundColor: "rgba(99, 102, 241, 0.8)",
          borderRadius: 8,
          borderSkipped: false,
        },
        {
          label: "Last Week",
          data: [38, 48, 32, 58, 65, 75, 35],
          backgroundColor: "rgba(34, 211, 238, 0.8)",
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: {
            color: textColor,
            padding: 20,
            font: { size: 12 },
          },
        },
        tooltip: {
          backgroundColor: "rgba(18, 24, 40, 0.9)",
          titleColor: "#f1f5f9",
          bodyColor: "#cbd5e1",
          borderColor: "#6366f1",
          borderWidth: 1,
          padding: 12,
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor },
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor },
        },
      },
    },
  });
}

// Generate Data
function generateMonthLabels() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(date.toLocaleDateString("en-US", { month: "short" }));
  }
  return months;
}

function generateRevenueData() {
  return Array.from(
    { length: 6 },
    () => Math.floor(Math.random() * 1500000) + 1000000,
  );
}

// Time Range Filter
function setTimeRange(range) {
  // Update active button
  document
    .querySelectorAll(".time-btn")
    .forEach((btn) => btn.classList.remove("active"));
  event.target.classList.add("active");

  // Simulate data update
  const newData = generateRevenueData();
  revenueChart.data.datasets[0].data = newData;

  // Update labels based on range
  let labels = [];
  const now = new Date();

  if (range === "7d") {
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString("en-US", { weekday: "short" }));
    }
  } else if (range === "30d") {
    for (let i = 4; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i * 7);
      labels.push(`Week ${5 - i}`);
    }
  } else if (range === "90d") {
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      labels.push(date.toLocaleDateString("en-US", { month: "short" }));
    }
  } else {
    labels = generateMonthLabels();
  }

  revenueChart.data.labels = labels;
  revenueChart.update();
}

// Update Payment Chart
function updatePaymentChart() {
  const filter = document.getElementById("paymentFilter").value;
  const percentages = {
    month: [48, 32, 12, 5, 3],
    quarter: [45, 35, 13, 4, 3],
    year: [42, 38, 12, 5, 3],
  };

  paymentChart.data.datasets[0].data = percentages[filter];
  paymentChart.update();

  // Update mini stats
  document.getElementById("upiPercent").textContent =
    `${percentages[filter][0]}%`;
  document.getElementById("cardPercent").textContent =
    `${percentages[filter][1]}%`;
  document.getElementById("cashPercent").textContent =
    `${percentages[filter][2]}%`;
}

// Update Daily Sales Chart
function updateDailySales() {
  const newDataThisWeek = Array.from(
    { length: 7 },
    () => Math.floor(Math.random() * 50) + 30,
  );
  const newDataLastWeek = Array.from(
    { length: 7 },
    () => Math.floor(Math.random() * 45) + 25,
  );

  dailySalesChart.data.datasets[0].data = newDataThisWeek;
  dailySalesChart.data.datasets[1].data = newDataLastWeek;
  dailySalesChart.update();
}

// Top Products
function updateTopProducts() {
  const products = [
    { name: "Premium Wireless Headphones", sales: 2450, growth: 12 },
    { name: "Mechanical Gaming Keyboard", sales: 1890, growth: 8 },
    { name: "4K Webcam with Mic", sales: 1560, growth: 15 },
    { name: "Ergonomic Office Chair", sales: 1320, growth: 5 },
    { name: "Smart Watch Pro", sales: 1120, growth: 22 },
  ];

  const list = document.getElementById("topProductsList");
  list.innerHTML = "";

  products.forEach((product, index) => {
    const item = document.createElement("div");
    item.className = "product-item";
    item.innerHTML = `
            <div class="product-rank">${index + 1}</div>
            <div class="product-info">
              <div class="product-name">${product.name}</div>
              <div class="product-stats">
                <span class="product-sales">${product.sales.toLocaleString()} units</span>
                <span class="product-growth">+${product.growth}%</span>
              </div>
            </div>
          `;
    list.appendChild(item);
  });
}

// Export Chart
function exportChart(chartId) {
  const canvas = document.getElementById(chartId);
  const link = document.createElement("a");
  link.download = `${chartId}-${new Date().toISOString().split("T")[0]}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// Initialize Everything
document.addEventListener("DOMContentLoaded", function () {
  // Initialize theme
  initTheme();

  // Initialize date/time

  // Initialize charts
  initCharts();

  // Initialize top products
  updateTopProducts();

  // Update stats randomly every 30 seconds
  setInterval(() => {
    // Update revenue
    const revenue = document.getElementById("totalRevenue");
    const currentRev = parseInt(revenue.textContent.replace(/[^0-9]/g, ""));
    const newRev = currentRev + Math.floor(Math.random() * 100000);
    revenue.textContent = `₹${newRev.toLocaleString("en-IN")}`;

    // Update active customers
    const customers = document.getElementById("activeCustomers");
    const currentCust = parseInt(customers.textContent.replace(/[^0-9]/g, ""));
    const newCust = currentCust + Math.floor(Math.random() * 50);
    customers.textContent = newCust.toLocaleString("en-IN");
  }, 30000);
});

// Handle window resize
window.addEventListener("resize", function () {
  if (revenueChart) revenueChart.resize();
  if (paymentChart) paymentChart.resize();
  if (dailySalesChart) dailySalesChart.resize();
});
