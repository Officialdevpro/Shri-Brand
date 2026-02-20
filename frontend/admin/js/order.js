const erpSampleData = [
        {
          id: "6973111a1da6214ab5575bcb",
          n: "Rakesh Sharma",
          email: "rakesh@example.com",
          i: "Sony Headset ×1, HP Mouse ×2",
          t: 2520,
          p: "upi",
          d: "2024-04-07T19:15:00",
          timestamp: 1712484900000,
        },
        {
          id: "6973111a1da6214ab5575bcc",
          n: "Ragu Patil",
          email: "ragu@example.com",
          i: "HP Mouse ×3",
          t: 5045,
          p: "cash",
          d: "2024-04-07T11:13:00",
          timestamp: 1712484780000,
        },
        {
          id: "6973111a1da6214ab5575bcd",
          n: "Priya Verma",
          email: "priya@example.com",
          i: "Keyboard ×1",
          t: 3820,
          p: "upi",
          d: "2024-04-06T15:45:00",
          timestamp: 1712403900000,
        },
        {
          id: "6973111a1da6214ab5575bce",
          n: "Amit Singh",
          email: "amit@example.com",
          i: "USB Cable ×3",
          t: 1750,
          p: "cash",
          d: "2024-04-06T10:20:00",
          timestamp: 1712377200000,
        },
        {
          id: "6973111a1da6214ab5575bcf",
          n: "Sanjay Kumar",
          email: "sanjay@example.com",
          i: "Gaming Mouse ×2",
          t: 8990,
          p: "upi",
          d: "2024-04-05T17:30:00",
          timestamp: 1712313000000,
        },
        {
          id: "6973111a1da6214ab5575bd0",
          n: "Kavita Reddy",
          email: "kavita@example.com",
          i: "Bluetooth Speaker ×1",
          t: 4230,
          p: "cash",
          d: "2024-04-05T13:15:00",
          timestamp: 1712299500000,
        },
        {
          id: "6973111a1da6214ab5575bd1",
          n: "Vikram Joshi",
          email: "vikram@example.com",
          i: "Monitor ×1, Keyboard ×1",
          t: 18500,
          p: "upi",
          d: "2024-04-04T09:45:00",
          timestamp: 1712213100000,
        },
        {
          id: "6973111a1da6214ab5575bd2",
          n: "Neha Gupta",
          email: "neha@example.com",
          i: "Mousepad ×2, USB Hub ×1",
          t: 1250,
          p: "cash",
          d: "2024-04-04T14:20:00",
          timestamp: 1712200800000,
        },
        {
          id: "6973111a1da6214ab5575bd3",
          n: "Rajesh Nair",
          email: "rajesh@example.com",
          i: "Laptop Stand ×1",
          t: 3200,
          p: "upi",
          d: "2024-04-03T16:10:00",
          timestamp: 1712139000000,
        },
        {
          id: "6973111a1da6214ab5575bd4",
          n: "Sneha Desai",
          email: "sneha@example.com",
          i: "Wireless Charger ×3",
          t: 5400,
          p: "cash",
          d: "2024-04-03T11:30:00",
          timestamp: 1712125800000,
        },
        {
          id: "6973111a1da6214ab5575bd5",
          n: "Manoj Tiwari",
          email: "manoj@example.com",
          i: "External SSD ×1",
          t: 7500,
          p: "upi",
          d: "2024-04-02T13:15:00",
          timestamp: 1712049300000,
        },
        {
          id: "6973111a1da6214ab5575bd6",
          n: "Anjali Kapoor",
          email: "anjali@example.com",
          i: "Webcam ×1, Mic ×1",
          t: 6800,
          p: "cash",
          d: "2024-04-01T10:05:00",
          timestamp: 1711962300000,
        },
        {
          id: "6973111a1da6214ab5575bd7",
          n: "Pradeep Mehta",
          email: "pradeep@example.com",
          i: "Tablet ×1",
          t: 24500,
          p: "upi",
          d: "2024-03-31T14:30:00",
          timestamp: 1711873800000,
        },
        {
          id: "6973111a1da6214ab5575bd8",
          n: "Swati Choudhary",
          email: "swati@example.com",
          i: "Smart Watch ×2",
          t: 15900,
          p: "cash",
          d: "2024-03-30T16:45:00",
          timestamp: 1711795500000,
        },
        {
          id: "6973111a1da6214ab5575bd9",
          n: "Deepak Yadav",
          email: "deepak@example.com",
          i: "Laptop Bag ×1",
          t: 2800,
          p: "upi",
          d: "2024-03-29T09:20:00",
          timestamp: 1711696800000,
        },
      ];

      // Global variables
      let erpCurrentPage = 1;
      const erpItemsPerPage = 8;
      let erpCurrentData = [...erpSampleData];
      let erpSortConfig = { key: null, direction: "asc" };
      let erpCalendarActiveInput = null;
      let erpCurrentMonth = new Date().getMonth();
      let erpCurrentYear = new Date().getFullYear();

      // DOM Elements
      const erpTbody = document.getElementById("erpTbody");
      const erpEmptyState = document.getElementById("erpEmptyState");
      const erpPages = document.getElementById("erpPages");
      const erpPageInfo = document.getElementById("erpPageInfo");
      const erpToast = document.getElementById("erpToast");
      const erpToastMessage = document.getElementById("erpToastMessage");
      const erpToastTime = document.getElementById("erpToastTime");
      const erpCalendarPopup = document.getElementById("erpCalendarPopup");
      const erpCalendarDates = document.getElementById("erpCalendarDates");
      const erpCalendarTitle = document.getElementById("erpCalendarTitle");
      const erpPrevMonthBtn = document.getElementById("erpPrevMonth");
      const erpNextMonthBtn = document.getElementById("erpNextMonth");
      const erpApplyDateBtn = document.getElementById("erpApplyDate");
      const erpCancelDateBtn = document.getElementById("erpCancelDate");

      // Filter elements
      const erpSearchInput = document.getElementById("erpSearch");
      const erpPaymentSelect = document.getElementById("erpPayment");
      const erpStartDateInput = document.getElementById("erpStartDate");
      const erpEndDateInput = document.getElementById("erpEndDate");
      const erpMinAmountInput = document.getElementById("erpMin");
      const erpMaxAmountInput = document.getElementById("erpMax");

      // Button elements
      const erpClearBtn = document.getElementById("erpClearBtn");
      const erpExportBtn = document.getElementById("erpExportBtn");
      const erpRefreshBtn = document.getElementById("erpRefreshBtn");
      const erpClearAllBtn = document.getElementById("erpClearAllBtn");

      // Initialize
      document.addEventListener("DOMContentLoaded", () => {
        erpRenderTable();
        erpSetupEventListeners();
        erpUpdatePagination();
        erpGenerateCalendar();
      });

      // Event Listeners Setup
      function erpSetupEventListeners() {
        // Search and filter inputs
        erpSearchInput.addEventListener("input", () => {
          erpCurrentPage = 1;
          erpApplyFilters();
        });

        erpPaymentSelect.addEventListener("change", () => {
          erpCurrentPage = 1;
          erpApplyFilters();
        });

        erpStartDateInput.addEventListener("click", (e) => {
          erpCalendarActiveInput = "startDate";
          erpShowCalendar(e.target);
        });

        erpEndDateInput.addEventListener("click", (e) => {
          erpCalendarActiveInput = "endDate";
          erpShowCalendar(e.target);
        });

        erpMinAmountInput.addEventListener("input", () => {
          erpCurrentPage = 1;
          erpApplyFilters();
        });

        erpMaxAmountInput.addEventListener("input", () => {
          erpCurrentPage = 1;
          erpApplyFilters();
        });

        // Calendar controls
        erpPrevMonthBtn.addEventListener("click", () => {
          erpCurrentMonth--;
          if (erpCurrentMonth < 0) {
            erpCurrentMonth = 11;
            erpCurrentYear--;
          }
          erpGenerateCalendar();
        });

        erpNextMonthBtn.addEventListener("click", () => {
          erpCurrentMonth++;
          if (erpCurrentMonth > 11) {
            erpCurrentMonth = 0;
            erpCurrentYear++;
          }
          erpGenerateCalendar();
        });

        erpApplyDateBtn.addEventListener("click", () => {
          erpApplySelectedDate();
        });

        erpCancelDateBtn.addEventListener("click", () => {
          erpHideCalendar();
        });

        // Close calendar when clicking outside
        document.addEventListener("click", (e) => {
          if (
            !erpCalendarPopup.contains(e.target) &&
            !erpStartDateInput.contains(e.target) &&
            !erpEndDateInput.contains(e.target)
          ) {
            erpHideCalendar();
          }
        });

        // Action buttons
        erpClearBtn.addEventListener("click", erpClearFilters);
        erpExportBtn.addEventListener("click", erpExportData);
        erpRefreshBtn.addEventListener("click", erpRefreshData);
        erpClearAllBtn.addEventListener("click", erpClearFilters);

        // Table header sorting
        document.querySelectorAll("[data-erp-sort]").forEach((th) => {
          th.addEventListener("click", () => {
            const sortKey = th.getAttribute("data-erp-sort");
            erpSortData(sortKey);
          });
        });
      }

      // Filter Functions
      function erpApplyFilters() {
        let filtered = [...erpSampleData];

        // Search filter
        const searchTerm = erpSearchInput.value.toLowerCase();
        if (searchTerm) {
          filtered = filtered.filter(
            (item) =>
              item.id.toLowerCase().includes(searchTerm) ||
              item.n.toLowerCase().includes(searchTerm) ||
              item.i.toLowerCase().includes(searchTerm) ||
              item.email.toLowerCase().includes(searchTerm),
          );
        }

        // Payment filter
        const paymentValue = erpPaymentSelect.value;
        if (paymentValue) {
          filtered = filtered.filter((item) => item.p === paymentValue);
        }

        // Date range filter
        const startDate = erpStartDateInput.value;
        const endDate = erpEndDateInput.value;
        if (startDate) {
          const start = new Date(startDate).getTime();
          filtered = filtered.filter((item) => item.timestamp >= start);
        }
        if (endDate) {
          const end = new Date(endDate + "T23:59:59").getTime();
          filtered = filtered.filter((item) => item.timestamp <= end);
        }

        // Amount range filter
        const minAmount = parseFloat(erpMinAmountInput.value) || 0;
        const maxAmount = parseFloat(erpMaxAmountInput.value) || Infinity;
        filtered = filtered.filter(
          (item) => item.t >= minAmount && item.t <= maxAmount,
        );

        erpCurrentData = filtered;
        erpRenderTable();
        erpUpdatePagination();
      }

      function erpClearFilters() {
        erpSearchInput.value = "";
        erpPaymentSelect.value = "";
        erpStartDateInput.value = "";
        erpEndDateInput.value = "";
        erpMinAmountInput.value = "";
        erpMaxAmountInput.value = "";

        erpCurrentPage = 1;
        erpCurrentData = [...erpSampleData];
        erpSortConfig = { key: null, direction: "asc" };

        erpRenderTable();
        erpUpdatePagination();
        erpShowToast("All filters cleared successfully");
      }

      // Sorting Functions
      function erpSortData(key) {
        if (erpSortConfig.key === key) {
          erpSortConfig.direction =
            erpSortConfig.direction === "asc" ? "desc" : "asc";
        } else {
          erpSortConfig.key = key;
          erpSortConfig.direction = "asc";
        }

        erpCurrentData.sort((a, b) => {
          let aVal = a[key];
          let bVal = b[key];

          // Special handling for different data types
          if (key === "t") {
            aVal = parseFloat(aVal);
            bVal = parseFloat(bVal);
          } else if (key === "timestamp") {
            aVal = new Date(aVal).getTime();
            bVal = new Date(bVal).getTime();
          }

          if (aVal < bVal) return erpSortConfig.direction === "asc" ? -1 : 1;
          if (aVal > bVal) return erpSortConfig.direction === "asc" ? 1 : -1;
          return 0;
        });

        // Update sort indicators
        document.querySelectorAll("[data-erp-sort]").forEach((th) => {
          const indicator =
            th.querySelector(".erp-sort-indicator") ||
            erpCreateSortIndicator(th);
          indicator.className = "erp-sort-indicator";
          if (th.getAttribute("data-erp-sort") === erpSortConfig.key) {
            indicator.classList.add("active", erpSortConfig.direction);
            indicator.innerHTML = erpSortConfig.direction === "asc" ? "↑" : "↓";
          } else {
            indicator.innerHTML = "↕";
          }
        });

        erpRenderTable();
      }

      function erpCreateSortIndicator(th) {
        const indicator = document.createElement("span");
        indicator.className = "erp-sort-indicator";
        indicator.innerHTML = "↕";
        th.appendChild(indicator);
        return indicator;
      }

      // Calendar Functions
      function erpShowCalendar(target) {
        const rect = target.getBoundingClientRect();
        erpCalendarPopup.style.top = `${rect.bottom + window.scrollY + 10}px`;
        erpCalendarPopup.style.left = `${rect.left + window.scrollX}px`;
        erpCalendarPopup.classList.add("show");
      }

      function erpHideCalendar() {
        erpCalendarPopup.classList.remove("show");
      }

      function erpGenerateCalendar() {
        // Update calendar title
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
        erpCalendarTitle.textContent = `${monthNames[erpCurrentMonth]} ${erpCurrentYear}`;

        // Clear previous dates
        erpCalendarDates.innerHTML = "";

        // Get first day of month and total days
        const firstDay = new Date(erpCurrentYear, erpCurrentMonth, 1);
        const lastDay = new Date(erpCurrentYear, erpCurrentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDay; i++) {
          const emptyCell = document.createElement("button");
          emptyCell.className = "erp-calendar-date other-month";
          emptyCell.textContent = new Date(
            erpCurrentYear,
            erpCurrentMonth,
            -startingDay + i + 1,
          ).getDate();
          erpCalendarDates.appendChild(emptyCell);
        }

        // Add days of the month
        const today = new Date();
        const isToday = (day) => {
          return (
            day === today.getDate() &&
            erpCurrentMonth === today.getMonth() &&
            erpCurrentYear === today.getFullYear()
          );
        };

        const selectedDate =
          erpCalendarActiveInput === "startDate"
            ? erpStartDateInput.value
            : erpEndDateInput.value;
        const selectedDay = selectedDate
          ? new Date(selectedDate).getDate()
          : null;
        const selectedMonth = selectedDate
          ? new Date(selectedDate).getMonth()
          : null;
        const selectedYear = selectedDate
          ? new Date(selectedDate).getFullYear()
          : null;

        for (let day = 1; day <= daysInMonth; day++) {
          const dateBtn = document.createElement("button");
          dateBtn.className = "erp-calendar-date";
          dateBtn.textContent = day;

          if (isToday(day)) {
            dateBtn.classList.add("today");
          }

          if (
            day === selectedDay &&
            erpCurrentMonth === selectedMonth &&
            erpCurrentYear === selectedYear
          ) {
            dateBtn.classList.add("selected");
          }

          dateBtn.addEventListener("click", () => {
            document
              .querySelectorAll(".erp-calendar-date.selected")
              .forEach((el) => {
                el.classList.remove("selected");
              });
            dateBtn.classList.add("selected");
          });

          erpCalendarDates.appendChild(dateBtn);
        }

        // Add empty cells for remaining days
        const totalCells = 42; // 6 rows * 7 days
        const remainingCells = totalCells - (startingDay + daysInMonth);
        for (let i = 1; i <= remainingCells; i++) {
          const emptyCell = document.createElement("button");
          emptyCell.className = "erp-calendar-date other-month";
          emptyCell.textContent = i;
          erpCalendarDates.appendChild(emptyCell);
        }
      }

      function erpApplySelectedDate() {
        const selectedDate = document.querySelector(
          ".erp-calendar-date.selected",
        );
        if (selectedDate && erpCalendarActiveInput) {
          const day = selectedDate.textContent;

          // Create date in local timezone
          const date = new Date(erpCurrentYear, erpCurrentMonth, day);

          // Format date as YYYY-MM-DD (local date, not UTC)
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const dayFormatted = String(date.getDate()).padStart(2, "0");
          const formattedDate = `${year}-${month}-${dayFormatted}`;

          if (erpCalendarActiveInput === "startDate") {
            erpStartDateInput.value = formattedDate;
          } else {
            erpEndDateInput.value = formattedDate;
          }

          erpCurrentPage = 1;
          erpApplyFilters();
          erpHideCalendar();
        }
      }

      // Render Functions
      function erpRenderTable() {
        // Calculate pagination
        const startIndex = (erpCurrentPage - 1) * erpItemsPerPage;
        const endIndex = startIndex + erpItemsPerPage;
        const pageData = erpCurrentData.slice(startIndex, endIndex);

        // Clear table
        erpTbody.innerHTML = "";

        if (pageData.length === 0) {
          erpEmptyState.style.display = "block";
          return;
        }

        erpEmptyState.style.display = "none";

        // Render rows
        pageData.forEach((item, index) => {
          const row = document.createElement("tr");
          row.style.animationDelay = `${index * 0.05}s`;

          // Format date
          const date = new Date(item.d);
          const formattedDate = date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
          const formattedTime = date.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          });

          // Avatar color based on index
          const avatarColor = `erp-avatar-color-${(index % 10) + 1}`;
          const initials = item.n
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase();

          row.innerHTML = `
        <td class="erp-td"><strong>${item.id.slice(-6)}</strong></td>
        <td class="erp-td">
          <div class="erp-customer-cell">
            <div class="erp-avatar ${avatarColor}">${initials}</div>
            <div class="erp-customer-info">
              <h4>${item.n}</h4>
              <p>${item.email}</p>
            </div>
          </div>
        </td>
        <td class="erp-td">${item.i}</td>
        <td class="erp-td"><strong>₹${item.t.toLocaleString("en-IN")}</strong></td>
        <td class="erp-td">
          <span class="erp-badge ${item.p === "upi" ? "erp-upi" : "erp-cash"}">
            <i class="fas ${item.p === "upi" ? "fa-mobile-alt" : "fa-money-bill"}"></i>
            ${item.p === "upi" ? "UPI" : "Cash"}
          </span>
        </td>
        <td class="erp-td">
          <div>${formattedDate}</div>
          <small style="color: var(--erp-muted);">${formattedTime}</small>
        </td>
      `;

          erpTbody.appendChild(row);
        });
      }

      function erpUpdatePagination() {
        const totalPages = Math.ceil(erpCurrentData.length / erpItemsPerPage);
        erpPages.innerHTML = "";

        // Page info
        erpPageInfo.textContent =
          erpCurrentData.length === 0
            ? "No orders found"
            : `Showing ${Math.min((erpCurrentPage - 1) * erpItemsPerPage + 1, erpCurrentData.length)}-${Math.min(erpCurrentPage * erpItemsPerPage, erpCurrentData.length)} of ${erpCurrentData.length} orders`;

        erpPages.appendChild(erpPageInfo);

        // Previous button
        const prevBtn = document.createElement("button");
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.disabled = erpCurrentPage === 1;
        prevBtn.addEventListener("click", () => {
          if (erpCurrentPage > 1) {
            erpCurrentPage--;
            erpRenderTable();
            erpUpdatePagination();
          }
        });
        erpPages.appendChild(prevBtn);

        // Page buttons
        const maxVisiblePages = 5;
        let startPage = Math.max(
          1,
          erpCurrentPage - Math.floor(maxVisiblePages / 2),
        );
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
          startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
          const firstBtn = document.createElement("button");
          firstBtn.textContent = "1";
          firstBtn.addEventListener("click", () => {
            erpCurrentPage = 1;
            erpRenderTable();
            erpUpdatePagination();
          });
          erpPages.appendChild(firstBtn);

          if (startPage > 2) {
            const ellipsis = document.createElement("button");
            ellipsis.innerHTML = "...";
            ellipsis.disabled = true;
            erpPages.appendChild(ellipsis);
          }
        }

        for (let i = startPage; i <= endPage; i++) {
          const pageBtn = document.createElement("button");
          pageBtn.textContent = i;
          if (i === erpCurrentPage) {
            pageBtn.classList.add("active");
          }
          pageBtn.addEventListener("click", () => {
            erpCurrentPage = i;
            erpRenderTable();
            erpUpdatePagination();
          });
          erpPages.appendChild(pageBtn);
        }

        if (endPage < totalPages) {
          if (endPage < totalPages - 1) {
            const ellipsis = document.createElement("button");
            ellipsis.innerHTML = "...";
            ellipsis.disabled = true;
            erpPages.appendChild(ellipsis);
          }

          const lastBtn = document.createElement("button");
          lastBtn.textContent = totalPages;
          lastBtn.addEventListener("click", () => {
            erpCurrentPage = totalPages;
            erpRenderTable();
            erpUpdatePagination();
          });
          erpPages.appendChild(lastBtn);
        }

        // Next button
        const nextBtn = document.createElement("button");
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.disabled = erpCurrentPage === totalPages;
        nextBtn.addEventListener("click", () => {
          if (erpCurrentPage < totalPages) {
            erpCurrentPage++;
            erpRenderTable();
            erpUpdatePagination();
          }
        });
        erpPages.appendChild(nextBtn);
      }

      // Utility Functions
      function erpShowToast(message) {
        erpToastMessage.textContent = message;
        erpToastTime.textContent = "Just now";
        erpToast.classList.add("show");

        setTimeout(() => {
          erpToast.classList.remove("show");
        }, 3000);
      }

      function erpExportData() {
        // Create CSV content
        let csv = "Order ID,Customer Name,Email,Items,Total,Payment,Date\n";

        erpCurrentData.forEach((item) => {
          const date = new Date(item.d);
          const formattedDate = date.toLocaleDateString("en-IN");

          csv += `"${item.id}","${item.n}","${item.email}","${item.i}",₹${item.t},"${item.p}","${formattedDate}"\n`;
        });

        // Create download link
        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ERP_Orders_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        erpShowToast(`Exported ${erpCurrentData.length} orders successfully`);
      }

      function erpRefreshData() {
        // In a real application, this would fetch fresh data from the server
        // For now, just reset to original data
        erpCurrentData = [...erpSampleData];
        erpCurrentPage = 1;
        erpRenderTable();
        erpUpdatePagination();
        erpShowToast("Data refreshed successfully");
      }

      // Initialize sort indicators
      document.querySelectorAll("[data-erp-sort]").forEach((th) => {
        erpCreateSortIndicator(th);
      });