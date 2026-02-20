// Sample user data
let umUsers = [
  {
    id: 1,
    name: "Rakesh Sharma",
    mobile: "9876543210",
    status: "active",
    createdAt: "2024-02-25",
    selected: false,
  },
  {
    id: 2,
    name: "Amit Singh",
    mobile: "9123456789",
    status: "active",
    createdAt: "2024-02-20",
    selected: false,
  },
  {
    id: 3,
    name: "Priya Verma",
    mobile: "9012345678",
    status: "inactive",
    createdAt: "2024-01-15",
    selected: false,
  },
  {
    id: 4,
    name: "Neha Gupta",
    mobile: "9345678123",
    status: "active",
    createdAt: "2024-02-18",
    selected: false,
  },
  {
    id: 5,
    name: "Sanjay Kumar",
    mobile: "9988776655",
    status: "active",
    createdAt: "2024-02-10",
    selected: false,
  },
  {
    id: 6,
    name: "Vikram Joshi",
    mobile: "8899776655",
    status: "inactive",
    createdAt: "2023-12-05",
    selected: false,
  },
  {
    id: 7,
    name: "Anjali Mehta",
    mobile: "7766554433",
    status: "active",
    createdAt: "2024-02-28",
    selected: false,
  },
  {
    id: 8,
    name: "Rajesh Patel",
    mobile: "8877665544",
    status: "active",
    createdAt: "2024-02-22",
    selected: false,
  },
  {
    id: 9,
    name: "Sneha Reddy",
    mobile: "9988443322",
    status: "active",
    createdAt: "2024-02-29",
    selected: false,
  },
  {
    id: 10,
    name: "Arun Mishra",
    mobile: "7766889900",
    status: "inactive",
    createdAt: "2023-11-20",
    selected: false,
  },
  {
    id: 11,
    name: "Kavita Nair",
    mobile: "8899001122",
    status: "active",
    createdAt: "2024-02-24",
    selected: false,
  },
  {
    id: 12,
    name: "Manoj Desai",
    mobile: "9900112233",
    status: "active",
    createdAt: "2024-01-30",
    selected: false,
  },
];

let umPage = 1;
let umPerPage = 8;
let umFiltered = [...umUsers];
let umEditIndex = null;
let umSelectedUsers = [];
let umCurrentFilter = {
  status: "all",
  age: "all",
  dateFrom: "",
  dateTo: "",
  sort: "newest",
};
let umRecipientTags = [];
let umUserToDeleteIndex = null;

// DOM Elements
const umTbody = document.getElementById("umTbody");
const umPagination = document.getElementById("umPagination");
const umSelectionBar = document.getElementById("umSelectionBar");
const umSelectedUsersCount = document.getElementById("umSelectedUsersCount");
const umSearch = document.getElementById("umSearch");
const umMsgBtn = document.getElementById("umMsgBtn");
const umAddBtn = document.getElementById("umAddBtn");
const umStartRow = document.getElementById("umStartRow");
const umEndRow = document.getElementById("umEndRow");
const umTotalRows = document.getElementById("umTotalRows");
const umRecipientTagsContainer = document.getElementById("umRecipientTags");
const umRecipientPlaceholder = document.querySelector(
  ".um-recipient-placeholder",
);
const umRecipientCount = document.getElementById("umRecipientCount");
const umSingleUserContainer = document.getElementById("umSingleUserContainer");
const umSingleUserSelect = document.getElementById("umSingleUserSelect");
const umCharCount = document.getElementById("umCharCount");
const umCharCountNumber = document.getElementById("umCharCountNumber");
const umToast = document.getElementById("umToast");
const umToastTitle = document.getElementById("umToastTitle");
const umToastMessage = document.getElementById("umToastMessage");
const umUserToDeleteName = document.getElementById("umUserToDeleteName");

// Initialize
umRender();

// Avatar color generator
function umAvatarColor(name) {
  const colors = [
    "#2563eb",
    "#7c3aed",
    "#06b6d4",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#3b82f6",
  ];
  return colors[name.charCodeAt(0) % colors.length];
}

// Format date
function umFormatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now - date;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Get status badge
function umGetStatusBadge(status, createdAt) {
  const createdDate = new Date(createdAt);
  const now = new Date();
  const diffTime = now - createdDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (status === "inactive")
    return '<span class="um-status-badge um-status-inactive">Inactive</span>';
  if (diffDays < 7)
    return '<span class="um-status-badge um-status-new">New</span>';
  return '<span class="um-status-badge um-status-active">Active</span>';
}

// Render table
function umRender() {
  umTbody.innerHTML = "";
  const start = (umPage - 1) * umPerPage;
  const end = Math.min(start + umPerPage, umFiltered.length);
  const rows = umFiltered.slice(start, end);

  if (rows.length === 0) {
    umTbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 60px 20px;">
          <i class="fas fa-user-slash" style="font-size: 48px; color: #d1d5db; margin-bottom: 16px; display: block;"></i>
          <h3 style="color: #6b7280; margin-bottom: 8px; font-weight: 600;">No users found</h3>
          <p style="color: #9ca3af;">Try adjusting your filters or search query</p>
        </td>
      </tr>`;
  } else {
    rows.forEach((user, i) => {
      const actualIndex = umUsers.findIndex((u) => u.id === user.id);
      const isSelected = user.selected;

      umTbody.innerHTML += `
      <tr class="${isSelected ? "um-selected-row" : ""}">
        <td>
          <div class="um-checkbox-ui ${isSelected ? "um-checked" : ""}" onclick="umToggleUserSelection(${actualIndex})"></div>
        </td>
        <td>
          <div class="um-user-cell">
            <div class="um-user-avatar" style="background:${umAvatarColor(user.name)}">${user.name[0]}</div>
            <div class="um-user-info">
              <h4>${user.name}</h4>
              <p>${user.mobile}</p>
            </div>
          </div>
        </td>
        <td>${umGetStatusBadge(user.status, user.createdAt)}</td>
        <td>${umFormatDate(user.createdAt)}</td>
        <td>
          <div class="um-action-buttons">
            <button class="um-action-btn um-edit-btn" title="Edit" onclick="umEditUser(${actualIndex})">
              <i class="fas fa-edit"></i>
            </button>
            <button class="um-action-btn um-delete-btn" title="Delete" onclick="umShowDeleteModal(${actualIndex})">
              <i class="fas fa-trash"></i>
            </button>
            <button class="um-action-btn um-message-btn" title="Message" onclick="umMessageSingleUser(${actualIndex})">
              <i class="fas fa-comment"></i>
            </button>
          </div>
        </td>
      </tr>`;
    });
  }

  umUpdateSelectionBar();
  umUpdatePaginationInfo();
  umPaginate();
}

// Update selection bar
function umUpdateSelectionBar() {
  umSelectedUsers = umUsers.filter((user) => user.selected);
  umSelectedUsersCount.textContent = umSelectedUsers.length;

  if (umSelectedUsers.length > 0) {
    umSelectionBar.classList.add("um-active");
  } else {
    umSelectionBar.classList.remove("um-active");
  }
}

// Toggle user selection
function umToggleUserSelection(index) {
  umUsers[index].selected = !umUsers[index].selected;
  umRender();
}

// Toggle select all
function umToggleSelectAll() {
  const selectAllCheckbox = document.getElementById("umSelectAllCheckbox");
  const isChecked = !selectAllCheckbox.classList.contains("um-checked");

  const start = (umPage - 1) * umPerPage;
  const rows = umFiltered.slice(start, start + umPerPage);

  rows.forEach((user) => {
    const userIndex = umUsers.findIndex((u) => u.id === user.id);
    if (userIndex !== -1) {
      umUsers[userIndex].selected = isChecked;
    }
  });

  selectAllCheckbox.classList.toggle("um-checked", isChecked);
  umRender();
}

// Clear selection
function umClearSelection() {
  umUsers.forEach((user) => (user.selected = false));
  document.getElementById("umSelectAllCheckbox").classList.remove("um-checked");
  umRender();
}

// Update pagination info
function umUpdatePaginationInfo() {
  const start = (umPage - 1) * umPerPage + 1;
  const end = Math.min(umPage * umPerPage, umFiltered.length);

  umStartRow.textContent = umFiltered.length > 0 ? start : 0;
  umEndRow.textContent = umFiltered.length > 0 ? end : 0;
  umTotalRows.textContent = umFiltered.length;
}

// Pagination
function umPaginate() {
  umPagination.innerHTML = "";
  const total = Math.ceil(umFiltered.length / umPerPage);

  // Previous button
  if (umPage > 1) {
    umPagination.innerHTML += `
      <button class="um-pagination-btn" onclick="umGo(${umPage - 1})">
        <i class="fas fa-chevron-left"></i>
      </button>`;
  }

  // Page numbers
  const maxVisible = 5;
  let startPage = Math.max(1, umPage - 2);
  let endPage = Math.min(total, startPage + maxVisible - 1);

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    umPagination.innerHTML += `
      <button class="um-pagination-btn ${i === umPage ? "um-active-page" : ""}" onclick="umGo(${i})">
        ${i}
      </button>`;
  }

  // Next button
  if (umPage < total) {
    umPagination.innerHTML += `
      <button class="um-pagination-btn" onclick="umGo(${umPage + 1})">
        <i class="fas fa-chevron-right"></i>
      </button>`;
  }
}

function umGo(p) {
  umPage = p;
  umRender();
}

// Apply filters
function umApplyFilters() {
  const query = umSearch.value.toLowerCase();
  const status = document.getElementById("umStatusFilter").value;
  const age = document.getElementById("umAgeFilter").value;
  const dateFrom = document.getElementById("umDateFrom").value;
  const dateTo = document.getElementById("umDateTo").value;

  umFiltered = umUsers.filter((user) => {
    // Search
    if (
      query &&
      !(user.name.toLowerCase().includes(query) || user.mobile.includes(query))
    )
      return false;

    // Status filter
    if (status !== "all" && user.status !== status) return false;

    // Age filter
    if (age !== "all") {
      const createdDate = new Date(user.createdAt);
      const now = new Date();
      const diffTime = now - createdDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (age === "new" && diffDays >= 7) return false;
      if (age === "old" && diffDays < 30) return false;
    }

    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      const userDate = new Date(user.createdAt);
      if (userDate < fromDate) return false;
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      const userDate = new Date(user.createdAt);
      if (userDate > toDate) return false;
    }

    return true;
  });

  // Apply sorting
  umSortUsers();

  umPage = 1;
  umRender();
}

// Filter by status
function umFilterByStatus() {
  umApplyFilters();
}

// Filter by age
function umFilterByAge() {
  umApplyFilters();
}

// Sort users
function umSortUsers() {
  const sortBy = document.getElementById("umSortFilter").value;

  umFiltered.sort((a, b) => {
    if (sortBy === "newest") {
      return new Date(b.createdAt) - new Date(a.createdAt);
    } else if (sortBy === "oldest") {
      return new Date(a.createdAt) - new Date(b.createdAt);
    } else if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  umRender();
}

// Reset filters
function umResetFilters() {
  umSearch.value = "";
  document.getElementById("umStatusFilter").value = "all";
  document.getElementById("umAgeFilter").value = "all";
  document.getElementById("umSortFilter").value = "newest";
  document.getElementById("umDateFrom").value = "";
  document.getElementById("umDateTo").value = "";

  umCurrentFilter = {
    status: "all",
    age: "all",
    dateFrom: "",
    dateTo: "",
    sort: "newest",
  };
  umFiltered = [...umUsers];
  umPage = 1;
  umRender();
}

// Search
umSearch.addEventListener("input", umApplyFilters);

// Modal functions
function umOpenModal(id) {
  document.getElementById(id).classList.add("um-modal-active");
}

function umCloseModal() {
  document
    .querySelectorAll(".um-modal-overlay")
    .forEach((m) => m.classList.remove("um-modal-active"));
  // Reset message modal
  umRecipientTags = [];
  umUpdateRecipientTags();
  document.getElementById("umMessageText").value = "";
  umUpdateCharCount();
}

// Show delete confirmation modal
function umShowDeleteModal(index) {
  umUserToDeleteIndex = index;
  const userName = umUsers[index].name;
  umUserToDeleteName.textContent = userName;
  umOpenModal("umDeleteModal");
}

// Confirm delete
function umConfirmDelete() {
  if (umUserToDeleteIndex !== null) {
    const userName = umUsers[umUserToDeleteIndex].name;
    umUsers.splice(umUserToDeleteIndex, 1);
    umFiltered = [...umUsers];
    umShowToast("User Deleted", `${userName} has been removed`, "warning");
    umRender();
    umCloseModal();
    umUserToDeleteIndex = null;
  }
}

// Add/Edit user
umAddBtn.onclick = () => {
  umEditIndex = null;
  document.getElementById("umUserModalTitle").textContent = "Add New User";
  document.getElementById("umUserName").value = "";
  document.getElementById("umUserMobile").value = "";
  document.getElementById("umUserStatus").value = "active";
  umOpenModal("umUserModal");
};

function umEditUser(index) {
  umEditIndex = index;
  document.getElementById("umUserModalTitle").textContent = "Edit User";
  document.getElementById("umUserName").value = umUsers[index].name;
  document.getElementById("umUserMobile").value = umUsers[index].mobile;
  document.getElementById("umUserStatus").value = umUsers[index].status;
  umOpenModal("umUserModal");
}

function umSaveUser() {
  const name = document.getElementById("umUserName").value.trim();
  const mobile = document.getElementById("umUserMobile").value.trim();
  const status = document.getElementById("umUserStatus").value;

  if (!name || !mobile) {
    umShowToast("Validation Error", "Please fill in all fields", "error");
    return;
  }

  if (umEditIndex === null) {
    // Add new user
    const newId =
      umUsers.length > 0 ? Math.max(...umUsers.map((u) => u.id)) + 1 : 1;
    umUsers.push({
      id: newId,
      name: name,
      mobile: mobile,
      status: status,
      createdAt: new Date().toISOString().split("T")[0],
      selected: false,
    });
    umShowToast("User Added", `${name} has been added successfully`, "success");
  } else {
    // Edit existing user
    umUsers[umEditIndex] = {
      ...umUsers[umEditIndex],
      name: name,
      mobile: mobile,
      status: status,
    };
    umShowToast(
      "User Updated",
      `${name} has been updated successfully`,
      "success",
    );
  }

  umFiltered = [...umUsers];
  umApplyFilters();

  umCloseModal();
}

// Message functionality
umMsgBtn.onclick = () => {
  umOpenMessageModal();
};

function umOpenMessageModal() {
  // Populate single user select
  umPopulateSingleUserSelect();

  // Reset to all users option
  document.getElementById("umAllUsers").checked = true;
  umToggleRecipientType();

  // Update recipient tags based on selection
  umUpdateRecipientTagsFromSelection();

  umOpenModal("umMsgModal");
}

function umToggleRecipientType() {
  const messageOption = document.querySelector(
    'input[name="umMessageOption"]:checked',
  ).value;

  if (messageOption === "single") {
    umSingleUserContainer.style.display = "block";
    umUpdateRecipientTagsFromSelection();
  } else {
    umSingleUserContainer.style.display = "none";
    umUpdateRecipientTagsFromSelection();
  }
}

function umPopulateSingleUserSelect() {
  umSingleUserSelect.innerHTML = '<option value="">Select a user</option>';
  umUsers.forEach((user) => {
    umSingleUserSelect.innerHTML += `<option value="${user.id}">${user.name} (${user.mobile})</option>`;
  });
}

function umAddSingleUserTag() {
  const userId = parseInt(umSingleUserSelect.value);
  if (!userId) return;

  const user = umUsers.find((u) => u.id === userId);
  if (user && !umRecipientTags.some((tag) => tag.id === userId)) {
    umRecipientTags.push({ id: user.id, name: user.name });
    umUpdateRecipientTags();
  }

  umSingleUserSelect.value = "";
}

// Update recipient tags
function umUpdateRecipientTags() {
  umRecipientTagsContainer.innerHTML = "";

  if (umRecipientTags.length === 0) {
    umRecipientPlaceholder.style.display = "flex";
    umRecipientTagsContainer.appendChild(umRecipientPlaceholder);
  } else {
    umRecipientPlaceholder.style.display = "none";

    umRecipientTags.forEach((tag) => {
      const tagElement = document.createElement("div");
      tagElement.className = "um-tag";
      tagElement.innerHTML = `
        ${tag.name}
        <span class="um-tag-remove" onclick="umRemoveTag(${tag.id})">
          <i class="fas fa-times"></i>
        </span>
      `;
      umRecipientTagsContainer.appendChild(tagElement);
    });
  }

  umRecipientCount.textContent = `${umRecipientTags.length} recipient${umRecipientTags.length !== 1 ? "s" : ""} selected`;
}

function umUpdateRecipientTagsFromSelection() {
  const messageOption = document.querySelector(
    'input[name="umMessageOption"]:checked',
  ).value;
  umRecipientTags = [];

  if (messageOption === "all") {
    umUsers.forEach((user) => {
      umRecipientTags.push({ id: user.id, name: user.name });
    });
  } else if (messageOption === "selected") {
    umUsers.forEach((user) => {
      if (user.selected) {
        umRecipientTags.push({ id: user.id, name: user.name });
      }
    });
  }

  umUpdateRecipientTags();
}

function umRemoveTag(userId) {
  umRecipientTags = umRecipientTags.filter((tag) => tag.id !== userId);
  umUpdateRecipientTags();
}

// Message single user
function umMessageSingleUser(index) {
  umOpenMessageModal();
  document.getElementById("umSingleUser").checked = true;
  umToggleRecipientType();

  const user = umUsers[index];
  umRecipientTags = [{ id: user.id, name: user.name }];
  umUpdateRecipientTags();

  umSingleUserSelect.value = user.id;
}

// Send message to selected
function umSendMessageToSelected() {
  umOpenMessageModal();
  document.getElementById("umSelectedUsers").checked = true;
  umToggleRecipientType();
}

// Update character count
function umUpdateCharCount() {
  const text = document.getElementById("umMessageText").value;
  umCharCountNumber.textContent = text.length;

  const charCountElement = document.getElementById("umCharCount");
  charCountElement.classList.remove("um-warning-count", "um-danger-count");

  if (text.length > 900) {
    charCountElement.classList.add("um-danger-count");
  } else if (text.length > 750) {
    charCountElement.classList.add("um-warning-count");
  }
}

// Show toast
function umShowToast(title, message, type = "success") {
  umToastTitle.textContent = title;
  umToastMessage.textContent = message;

  // Set color based on type
  if (type === "error") {
    umToast.style.borderLeftColor = "#ef4444";
    umToast.querySelector("i").className = "fas fa-exclamation-circle";
    umToast.querySelector("i").style.color = "#ef4444";
  } else if (type === "warning") {
    umToast.style.borderLeftColor = "#f59e0b";
    umToast.querySelector("i").className = "fas fa-exclamation-triangle";
    umToast.querySelector("i").style.color = "#f59e0b";
  } else {
    umToast.style.borderLeftColor = "#10b981";
    umToast.querySelector("i").className = "fas fa-check-circle";
    umToast.querySelector("i").style.color = "#10b981";
  }

  umToast.classList.add("um-toast-active");

  // Hide after 4 seconds
  setTimeout(() => {
    umToast.classList.remove("um-toast-active");
  }, 4000);
}

// Send message
function umSendMessage() {
  const messageText = document.getElementById("umMessageText").value.trim();

  if (umRecipientTags.length === 0) {
    umShowToast(
      "No Recipients",
      "Please select at least one recipient",
      "error",
    );
    return;
  }

  if (!messageText) {
    umShowToast("Empty Message", "Please enter a message to send", "error");
    return;
  }

  // Get recipient names
  const recipientNames = umRecipientTags.map((tag) => tag.name);

  // Show success message
  umShowToast(
    "Message Sent!",
    `Your message has been sent to ${umRecipientTags.length} recipient${umRecipientTags.length !== 1 ? "s" : ""}`,
    "success",
  );

  // Log to console
  console.log(`Message sent to: ${recipientNames.join(", ")}`);
  console.log(`Message: ${messageText}`);

  // Close modal and reset
  umCloseModal();
}

// Initialize calendar event listeners
document
  .getElementById("umDateFrom")
  .addEventListener("change", umApplyFilters);
document.getElementById("umDateTo").addEventListener("change", umApplyFilters);
