let contactData = [
  {
    id: 1,
    name: "Admin",
    phone: "+91 98765 43210",
    role: "Admin",
    color: "#4361ee",
  },
  {
    id: 2,
    name: "Sales Manager",
    phone: "+91 91234 56789",
    role: "Sales",
    color: "#4cc9f0",
  },
  {
    id: 3,
    name: "Warehouse Head",
    phone: "+91 99887 66554",
    role: "Warehouse",
    color: "#f8961e",
  },
];

let contactToDeleteId = null;
let isContactEditing = false;
let editContactId = null;


// Available roles with colors
const roleColorMapping = {
  Admin: "#4361ee",
  Sales: "#4cc9f0",
  Manager: "#f8961e",
  Warehouse: "#7209b7",
  "Team Member": "#f72585",
};

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  loadSettingsData();
  renderContactsList();
  updateContactsCounter();
  initializeEventListeners();
  initializeToggleSwitches();
});

function loadSettingsData() {
  const savedContactsData = localStorage.getItem("whatsappContactsData");
  const savedSettingsData = localStorage.getItem("whatsappSettingsData");

  if (savedContactsData) {
    contactData = JSON.parse(savedContactsData);
  }

  if (savedSettingsData) {
    const settingsData = JSON.parse(savedSettingsData);
    document.getElementById("masterAlertsToggle").checked =
      settingsData.masterToggle;
    document.getElementById("customerAlertsToggle").checked =
      settingsData.customerToggle;
    document.getElementById("stockAlertsToggle").checked =
      settingsData.adminToggle;
    document.getElementById("stockThresholdInput").value =
      settingsData.stockThreshold;
  }
}

function saveSettingsData() {
  const settingsData = {
    masterToggle: document.getElementById("masterAlertsToggle").checked,
    customerToggle: document.getElementById("customerAlertsToggle").checked,
    adminToggle: document.getElementById("stockAlertsToggle").checked,
    stockThreshold: document.getElementById("stockThresholdInput").value,
  };

  localStorage.setItem("whatsappSettingsData", JSON.stringify(settingsData));
  localStorage.setItem("whatsappContactsData", JSON.stringify(contactData));
}

function renderContactsList() {
  const contactsListContainer = document.getElementById(
    "contactsListContainer",
  );
  const emptyStateContainer = document.getElementById("emptyContactsState");

  if (contactData.length === 0) {
    contactsListContainer.innerHTML = "";
    emptyStateContainer.style.display = "block";
    updateContactsCounter();
    return;
  }

  emptyStateContainer.style.display = "none";
  contactsListContainer.innerHTML = "";

  contactData.forEach((contact) => {
    const contactInitials = getContactInitials(contact.name);
    const roleClass = getRoleClassType(contact.role);

    const contactItemElement = document.createElement("div");
    contactItemElement.className = "contact-item-wrapper";
    contactItemElement.dataset.id = contact.id;

    if (contact.id === editContactId) {
      contactItemElement.innerHTML = `
              <div class="contact-avatar-icon" style="background: ${contact.color}">
                ${contactInitials}
              </div>
              <div class="contact-info-wrapper">
                <input type="text" class="form-input-style" value="${contact.name}" 
                       oninput="updateTemporaryName(${contact.id}, this.value)" 
                       style="margin-bottom: 0.5rem;">
                <input type="tel" class="form-input-style" value="${contact.phone}" 
                       oninput="updateTemporaryPhone(${contact.id}, this.value)"
                       style="margin-bottom: 0.5rem;">
                <select class="form-select-style" onchange="updateTemporaryRole(${contact.id}, this.value)">
                  ${Object.keys(roleColorMapping)
          .map(
            (role) =>
              `<option value="${role}" ${contact.tempRole === role ? "selected" : ""}>${role}</option>`,
          )
          .join("")}
                </select>
              </div>
              <div class="contact-actions-wrapper">
                <button class="contact-action-button" onclick="saveContactChanges(${contact.id})">
                  <i class="fas fa-check"></i>
                </button>
                <button class="contact-action-button delete-action" onclick="cancelContactEdit()">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            `;
    } else {
      contactItemElement.innerHTML = `
              <div class="contact-avatar-icon" style="background: ${contact.color}">
                ${contactInitials}
              </div>
              <div class="contact-info-wrapper">
                <div class="contact-name-text">${contact.name}</div>
                <div class="contact-phone-number">${contact.phone}</div>
                <div class="contact-role-badge ${roleClass}">${contact.role}</div>
              </div>
              <div class="contact-actions-wrapper">
                <button class="contact-action-button" onclick="editContactEntry(${contact.id})">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="contact-action-button delete-action" onclick="showDeleteContactModal(${contact.id})">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            `;
    }

    contactsListContainer.appendChild(contactItemElement);
  });
}

function addNewContact() {
  const nameInputField = document.getElementById("contactNameInput");
  const phoneInputField = document.getElementById("contactPhoneInput");
  const roleSelectField = document.getElementById("contactRoleSelect");

  const contactName = nameInputField.value.trim();
  const contactPhone = phoneInputField.value.trim();
  const contactRole = roleSelectField.value;

  if (!contactName) {
    showNotificationToast("Please enter a contact name", "error");
    nameInputField.focus();
    return;
  }

  if (!contactPhone) {
    showNotificationToast("Please enter a phone number", "error");
    phoneInputField.focus();
    return;
  }

  if (!validatePhoneNumber(contactPhone)) {
    showNotificationToast("Please enter a valid phone number", "error");
    phoneInputField.focus();
    return;
  }

  if (contactData.some((c) => c.phone === contactPhone)) {
    showNotificationToast("This phone number is already registered", "error");
    return;
  }

  if (contactData.length >= 10) {
    showNotificationToast("Maximum 10 contacts allowed", "warning");
    return;
  }

  const newContactEntry = {
    id:
      contactData.length > 0
        ? Math.max(...contactData.map((c) => c.id)) + 1
        : 1,
    name: contactName,
    phone: contactPhone,
    role: contactRole,
    color:
      roleColorMapping[contactRole] || getColorFromContactName(contactName),
    tempName: contactName,
    tempPhone: contactPhone,
    tempRole: contactRole,
  };

  contactData.push(newContactEntry);
  saveSettingsData();
  renderContactsList();
  updateContactsCounter();

  // Reset form
  nameInputField.value = "";
  phoneInputField.value = "";
  roleSelectField.value = "Team Member";
  nameInputField.focus();

  showNotificationToast("Contact added successfully", "success");
}

function editContactEntry(id) {
  isContactEditing = true;
  editContactId = id;

  const contact = contactData.find((c) => c.id === id);
  if (contact) {
    contact.tempName = contact.name;
    contact.tempPhone = contact.phone;
    contact.tempRole = contact.role;

    // Update form fields
    document.getElementById("contactNameInput").value = contact.name;
    document.getElementById("contactPhoneInput").value = contact.phone;
    document.getElementById("contactRoleSelect").value = contact.role;

    // Update button text
    document.getElementById("addContactButton").innerHTML =
      '<i class="fas fa-save"></i> Update Contact';
    document.getElementById("cancelEditButton").style.display = "block";
  }

  renderContactsList();
  showNotificationToast("Edit mode enabled", "info");
}

function updateTemporaryName(id, value) {
  const contact = contactData.find((c) => c.id === id);
  if (contact) contact.tempName = value;
}

function updateTemporaryPhone(id, value) {
  const contact = contactData.find((c) => c.id === id);
  if (contact) contact.tempPhone = value;
}

function updateTemporaryRole(id, value) {
  const contact = contactData.find((c) => c.id === id);
  if (contact) contact.tempRole = value;
}

function saveContactChanges(id) {
  const contact = contactData.find((c) => c.id === id);
  if (!contact) return;

  const newName = contact.tempName.trim();
  const newPhone = contact.tempPhone.trim();
  const newRole = contact.tempRole;

  if (!newName) {
    showNotificationToast("Contact name cannot be empty", "error");
    return;
  }

  if (!newPhone) {
    showNotificationToast("Phone number cannot be empty", "error");
    return;
  }

  if (!validatePhoneNumber(newPhone)) {
    showNotificationToast("Please enter a valid phone number", "error");
    return;
  }

  if (contactData.some((c) => c.phone === newPhone && c.id !== id)) {
    showNotificationToast("This phone number is already registered", "error");
    return;
  }

  contact.name = newName;
  contact.phone = newPhone;
  contact.role = newRole;
  contact.color = roleColorMapping[newRole] || getColorFromContactName(newName);

  // Reset form
  document.getElementById("contactNameInput").value = "";
  document.getElementById("contactPhoneInput").value = "";
  document.getElementById("contactRoleSelect").value = "Team Member";
  document.getElementById("addContactButton").innerHTML =
    '<i class="fas fa-plus"></i> Add Contact';
  document.getElementById("cancelEditButton").style.display = "none";

  isContactEditing = false;
  editContactId = null;

  saveSettingsData();
  renderContactsList();
  showNotificationToast("Contact updated successfully", "success");
}

function cancelContactEdit() {
  // Reset form
  document.getElementById("contactNameInput").value = "";
  document.getElementById("contactPhoneInput").value = "";
  document.getElementById("contactRoleSelect").value = "Team Member";
  document.getElementById("addContactButton").innerHTML =
    '<i class="fas fa-plus"></i> Add Contact';
  document.getElementById("cancelEditButton").style.display = "none";

  isContactEditing = false;
  editContactId = null;

  renderContactsList();
  showNotificationToast("Edit cancelled", "warning");
}

function showDeleteContactModal(id) {
  contactToDeleteId = id;
  document.getElementById("deleteContactModal").classList.add("show-modal");
}

function confirmContactDelete() {
  if (contactToDeleteId) {
    contactData = contactData.filter((c) => c.id !== contactToDeleteId);
    saveSettingsData();
    renderContactsList();
    updateContactsCounter();
    showNotificationToast("Contact deleted successfully", "success");
  }
  hideModalOverlay();
}

function getRoleClassType(role) {
  const roleClassMapping = {
    Admin: "admin-role",
    Sales: "sales-role",
    Manager: "manager-role",
    Warehouse: "warehouse-role",
    "Team Member": "team-member-role",
  };
  return roleClassMapping[role] || "team-member-role";
}



function updateContactsCounter() {
  const contactsCount = contactData.length;
  document.getElementById("contactsCounter").textContent =
    `${contactsCount} contact${contactsCount !== 1 ? "s" : ""}`;

  const addButtonElement = document.getElementById("addContactButton");
  if (contactsCount >= 10) {
    addButtonElement.disabled = true;
    addButtonElement.innerHTML = '<i class="fas fa-ban"></i> Maximum Reached';
  } else {
    addButtonElement.disabled = false;
    addButtonElement.innerHTML = '<i class="fas fa-plus"></i> Add Contact';
  }
}

function getContactInitials(name) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

function getColorFromContactName(name) {
  const colorPalette = [
    "#4361ee",
    "#4cc9f0",
    "#f8961e",
    "#7209b7",
    "#f72585",
    "#06d6a0",
  ];
  let hashValue = 0;
  for (let i = 0; i < name.length; i++) {
    hashValue = name.charCodeAt(i) + ((hashValue << 5) - hashValue);
  }
  return colorPalette[Math.abs(hashValue) % colorPalette.length];
}

function validatePhoneNumber(phone) {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
}

function showNotificationToast(message, type = "success") {
  const toastElement = document.getElementById("notificationToast");
  const iconType =
    type === "success"
      ? "fa-check-circle"
      : type === "error"
        ? "fa-exclamation-circle"
        : type === "warning"
          ? "fa-exclamation-triangle"
          : "fa-info-circle";

  toastElement.innerHTML = `
          <i class="fas ${iconType}"></i>
          <span>${message}</span>
        `;
  toastElement.className = `toast-notification ${type}-toast`;
  toastElement.classList.add("show-toast");

  setTimeout(() => {
    toastElement.classList.remove("show-toast");
  }, 4000);
}

function hideModalOverlay() {
  document.querySelectorAll(".modal-overlay").forEach((modal) => {
    modal.classList.remove("show-modal");
  });
  contactToDeleteId = null;
}

function confirmLogout() {
  showNotificationToast("Logged out successfully", "success");
  hideModalOverlay();
  setTimeout(() => {
    window.location.href = "/login";
  }, 1500);
}

function initializeToggleSwitches() {
  // Get all toggle elements
  const masterToggleElement = document.getElementById("masterAlertsToggle");
  const customerToggleElement = document.getElementById("customerAlertsToggle");
  const adminToggleElement = document.getElementById("stockAlertsToggle");

  // Set initial state based on master toggle
  function updateToggleStates() {
    const isMasterActive = masterToggleElement.checked;

    // Enable/disable child toggles
    customerToggleElement.disabled = !isMasterActive;
    adminToggleElement.disabled = !isMasterActive;

    // If master is off, turn off child toggles
    if (!isMasterActive) {
      customerToggleElement.checked = false;
      adminToggleElement.checked = false;
    }

    // Update toggle slider appearance
    updateToggleAppearance(customerToggleElement);
    updateToggleAppearance(adminToggleElement);

    // Save to localStorage
    saveSettingsData();
  }

  // Update toggle slider visual state
  function updateToggleAppearance(toggle) {
    const sliderElement = toggle.nextElementSibling;
    if (toggle.disabled) {
      sliderElement.style.opacity = "0.5";
    } else {
      sliderElement.style.opacity = "1";
    }
  }

  // Initialize toggle states
  updateToggleStates();

  // Add event listeners
  masterToggleElement.addEventListener("change", function () {
    updateToggleStates();
    showNotificationToast(
      `WhatsApp alerts ${this.checked ? "enabled" : "disabled"}`,
      "info",
    );
  });

  customerToggleElement.addEventListener("change", function () {
    saveSettingsData();
    showNotificationToast(
      `Customer bill alerts ${this.checked ? "enabled" : "disabled"}`,
      "info",
    );
  });

  adminToggleElement.addEventListener("change", function () {
    saveSettingsData();
    showNotificationToast(
      `Low stock alerts ${this.checked ? "enabled" : "disabled"}`,
      "info",
    );
  });

  // Also add click events for the toggle sliders
  document.querySelectorAll(".toggle-switch-slider").forEach((slider) => {
    slider.addEventListener("click", function () {
      const toggleElement = this.previousElementSibling;
      toggleElement.click();
    });
  });
}

function initializeEventListeners() {
  document
    .getElementById("stockThresholdInput")
    .addEventListener("change", function () {
      saveSettingsData();
      showNotificationToast(
        `Stock threshold updated to ${this.value} units`,
        "success",
      );
    });

  document
    .getElementById("stockThresholdInput")
    .addEventListener("input", function () {
      // Real-time validation
      if (this.value < 1) this.value = 1;
      if (this.value > 1000) this.value = 1000;
    });

  document
    .getElementById("contactNameInput")
    .addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        if (isContactEditing) {
          saveContactChanges(editContactId);
        } else {
          addNewContact();
        }
      }
    });

  document
    .getElementById("contactPhoneInput")
    .addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        if (isContactEditing) {
          saveContactChanges(editContactId);
        } else {
          addNewContact();
        }
      }
    });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isContactEditing) {
      cancelContactEdit();
    }
  });
}
