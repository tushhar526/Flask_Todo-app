// ====================================
// GLOBAL STATE
// ====================================
let currentUser = null;
let userPermissions = [];
let STATUSES = [];
let ACTIVE_STATUS = null;
let currentEditingTaskId = null;

const API_URL = 'http://localhost:5000';
const API = {
    statuses: `${API_URL}/status`,
    tasks: `${API_URL}/tasks`,
};


// ====================================
// Initial UI STATE
// ====================================
document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.container');
    const loginModal = document.getElementById('login-modal');

    if (container) container.style.display = 'none';
    if (loginModal) loginModal.style.display = 'none'

    // Check auth after DOM is ready
    checkauth().then(isAuthenticated => {
        if (isAuthenticated) {
            initializeApp();
        }
    });
})


// ====================================
// JWT TOKEN MANAGEMENT
// ====================================
function getToken() {
    return localStorage.getItem('jwt_token');
}

function setToken(token) {
    localStorage.setItem('jwt_token', token);
}

function removeToken() {
    localStorage.removeItem('jwt_token');
}

function getAuthHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

// ====================================
// PERMISSION HELPER FUNCTIONS
// ====================================
function hasPermission(permission) {
    return userPermissions.includes(permission) || userPermissions.includes('full_access');
}

function applyPermissions() {
    // Add Task Button
    const addTaskBtn = document.getElementById('add-task-btn');
    const addTaskContainer = document.querySelector('.add-task-container');

    if (hasPermission('add_task')) {
        if (addTaskBtn) {
            addTaskBtn.style.display = 'flex';
            addTaskBtn.onclick = openModal;
        }
        if (addTaskContainer) addTaskContainer.style.display = 'flex';
    } else {
        if (addTaskBtn) {
            addTaskBtn.style.display = 'none';
            addTaskBtn.onclick = null;
        }
        if (addTaskContainer) addTaskContainer.style.display = 'none';
    }

    // Re-render tasks to show/hide edit/delete buttons
    if (ACTIVE_STATUS) {
        renderTasksForStatus(ACTIVE_STATUS);
    }
}

// ====================================
// AUTHENTICATION FUNCTIONS
// ====================================
async function checkauth() {
    const token = getToken();
    console.log('Token:', token ? 'Exists' : 'Missing');

    if (!token) {
        console.log('No token, showing login modal');
        showLoginModal();
        return false;
    }

    try {
        console.log('Sending verify-token request...');
        const response = await fetch(`${API_URL}/verify-token`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Token verification failed with response:', errorText);
            removeToken();
            showLoginModal();
            return false;
        }

        const data = await response.json();
        console.log('Token valid, user data:', data);

        currentUser = data.user;
        await loadUserPermission();
        hideLoginModal();
        return true;

    } catch (error) {
        console.error('Token verification failed with error:', error);
        removeToken();
        showLoginModal();
        return false;
    }
}

function showLogin() {
    document.getElementById('login-modal').style.display = 'block';
    document.getElementById('signup-modal').style.display = 'none';
}

function showSignup() {
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('signup-modal').style.display = 'block';

    const roleSelect = document.getElementById('signup-role');
    const secretKeyGroup = document.getElementById('secret-key-group');

    if (roleSelect.value === 'admin' || roleSelect.value === 'owner') {
        secretKeyGroup.style.display = 'block';
    } else {
        secretKeyGroup.style.display = 'none';
    }
}

function showLoginModal() {
    showLogin();
    document.querySelector('.container').style.display = 'none';
}

async function loadUserPermission() {
    try {
        const response = await fetch(`${API_URL}/permissions/${currentUser.role}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to load permissions');

        const data = await response.json();
        userPermissions = data.permissions;
        applyPermissions();
    } catch (error) {
        console.error('Error Loading Permissions:', error);
    }
}

// ====================================
// LOGIN/SIGNUP FUNCTIONS
// ====================================
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login Failed');
        }

        const data = await response.json();

        setToken(data.token);
        currentUser = data.user;

        hideLoginModal();

        await loadUserPermission();
        await initializeApp();
    } catch (error) {
        alert(error.message);
    }
});

document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;
    const role = document.getElementById('signup-role').value;
    const secretKey = document.getElementById('secret-key')?.value;

    try {
        const response = await fetch(`${API_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role, secretKey })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Signup Failed');
        }

        const data = await response.json();

        setToken(data.token);
        currentUser = data.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        alert('Account created successfully!');

        document.getElementById('signup-modal').style.display = 'none';
        document.querySelector('.container').style.display = 'flex';

        await loadUserPermission();
        await initializeApp();

    } catch (error) {
        alert(error.message);
    }
});

document.getElementById('signup-role')?.addEventListener('change', function () {
    const secretKeyGroup = document.getElementById('secret-key-group');
    const secretKeyInput = document.getElementById('secret-key');

    if (this.value === 'admin' || this.value === 'owner') {
        secretKeyGroup.style.display = 'block';
        secretKeyInput.required = true;
    } else {
        secretKeyGroup.style.display = 'none';
        secretKeyInput.required = false;
        secretKeyInput.value = '';
    }
});

function hideLoginModal() {
    const loginModal = document.getElementById('login-modal');
    const signupModal = document.getElementById('signup-modal');
    const container = document.querySelector('.container');

    if (loginModal) loginModal.style.display = 'none';
    if (signupModal) signupModal.style.display = 'none';

    if (container) container.style.display = 'flex';
}

function logout() {
    removeToken();
    localStorage.removeItem('currentUser');
    currentUser = null;
    userPermissions = [];
    location.reload();
}

// ====================================
//  STATUS FUNCTIONS WITH PERMISSIONS
// ====================================
async function fetchStatus() {
    const res = await fetch(API.statuses, {
        headers: getAuthHeaders()
    });

    if (!res.ok) {
        if (res.status === 401) {
            logout();
            return;
        }
        throw new Error("Failed to load statuses");
    }

    const data = await res.json();
    STATUSES = data.map(s => ({
        id: s.id,
        name: s.name,
        color: s.color
    }));

    console.warn('STATUSES DONE loading');
    return STATUSES;
}

async function updateStatus(statusId, newName) {
    const payload = {
        id: statusId,
        name: newName
    };

    const res = await fetch(`${API.statuses}/${statusId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        if (res.status === 401) {
            logout();
            return;
        }
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
    }

    return await res.json();
}

async function addStatus(name, color) {
    const res = await fetch(API.statuses, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, color })
    });

    if (!res.ok) {
        if (res.status === 401) {
            logout();
            return;
        }
        const data = await res.json();
        throw new Error(data.error || "Failed to add status");
    }

    return await res.json();
}

async function deleteStatus(statusId) {
    if (!hasPermission('delete_status')) {
        alert('You do not have permission to delete statuses.');
        return false;
    }

    if (!confirm(`Are you sure you want to delete this status?\n\nThis action cannot be undone.`)) {
        return false;
    }

    try {
        const res = await fetch(`${API.statuses}/${statusId}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            if (res.status === 401) {
                logout();
                return false;
            }
            const data = await res.json();
            throw new Error(data.error || "Failed to delete status");
        }

        alert("Status deleted successfully!");

        // Refresh statuses
        await fetchStatus();
        renderStatuses();

        // If the deleted status was active, switch to first status
        if (ACTIVE_STATUS === statusId) {
            ACTIVE_STATUS = STATUSES.length ? STATUSES[0].id : null;
            if (ACTIVE_STATUS) {
                await renderTasksForStatus(ACTIVE_STATUS);
            }
        }

        return true;

    } catch (error) {
        console.error('Error deleting status:', error);
        alert('Failed to delete status: ' + error.message);
        return false;
    }
}

function renderStatuses() {
    const bar = document.getElementById("status-bar");
    bar.innerHTML = "";

    STATUSES.forEach((status, idx) => {
        const tab = document.createElement("div");
        tab.className = "tab";
        tab.style.position = "relative";
        tab.style.overflow = "hidden";

        // Make draggable if user has add_status permission
        if (hasPermission('add_status')) {
            tab.draggable = true;
            tab.style.cursor = "grab";
        }

        if (idx === 0) {
            tab.classList.add("active");
            ACTIVE_STATUS = status.id;
        }

        tab.dataset.statusKey = status.id;
        tab.dataset.statusIndex = idx;

        // Create status name span
        const statusNameSpan = document.createElement("span");
        statusNameSpan.textContent = status.name;
        statusNameSpan.style.flex = "1";
        tab.appendChild(statusNameSpan);

        // Add delete button if user has add_status permission
        if (hasPermission('add_status')) {
            const delBtn = document.createElement("button");
            delBtn.className = "status-del-btn";
            delBtn.textContent = "×";
            delBtn.title = "Delete status";

            Object.assign(delBtn.style, {
                position: "absolute",
                right: "-2rem",
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255, 68, 68, 0.2)",
                border: "none",
                color: "#ff4444",
                fontSize: "1rem",
                cursor: "pointer",
                padding: "0.25rem 0.5rem",
                lineHeight: "1",
                transition: "all 0.3s ease",
                borderRadius: "0.25rem",
                zIndex: "10"
            });

            delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteStatus(status.id);
            });

            tab.appendChild(delBtn);

            // Show delete button on tab hover
            tab.addEventListener("mouseenter", () => {
                delBtn.style.right = "0.5rem";
                delBtn.style.background = "rgba(255, 68, 68, 0.3)";
            });

            tab.addEventListener("mouseleave", () => {
                delBtn.style.right = "-2rem";
                delBtn.style.background = "rgba(255, 68, 68, 0.2)";
            });

            // Drag and drop handlers
            tab.addEventListener("dragstart", (e) => {
                tab.style.opacity = "0.5";
                tab.style.cursor = "grabbing";
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/html", idx.toString());
            });

            tab.addEventListener("dragend", (e) => {
                tab.style.opacity = "1";
                tab.style.cursor = "grab";
            });

            tab.addEventListener("dragover", (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
            });

            tab.addEventListener("drop", async (e) => {
                e.preventDefault();
                const draggedIndex = parseInt(e.dataTransfer.getData("text/html"));
                const droppedIndex = parseInt(tab.dataset.statusIndex);

                if (draggedIndex !== droppedIndex) {
                    const [draggedStatus] = STATUSES.splice(draggedIndex, 1);
                    STATUSES.splice(droppedIndex, 0, draggedStatus);

                    await saveStatusOrder();
                    renderStatuses();
                }
            });
        }

        tab.addEventListener("click", (e) => {
            if (tab.querySelector("input")) return;

            document
                .querySelectorAll(".tab")
                .forEach(t => t.classList.remove("active"));

            tab.classList.add("active");
            ACTIVE_STATUS = tab.dataset.statusKey;
            renderTasksForStatus(tab.dataset.statusKey);
        });

        // Only allow rename if user has rename_status permission
        if (hasPermission('rename_status')) {
            tab.addEventListener("dblclick", (e) => {
                if (e.target.classList.contains('status-del-btn')) return;
                enableStatusRename(tab, status.id, status.name);
            });
        }

        bar.appendChild(tab);
    });

    // Only show + button if user has add_status permission
    if (hasPermission('add_status')) {
        const addBtn = document.createElement("div");
        addBtn.className = "tab add-tab";
        addBtn.textContent = "+";
        addBtn.addEventListener("click", openAddStatusModal);
        bar.appendChild(addBtn);

        const allTabs = bar.querySelectorAll('.tab:not(.add-tab)');
        allTabs.forEach(tab => {
            tab.style.borderRadius = '0';
        });

        addBtn.style.borderRadius = "0rem 1.5rem 1.5rem 0rem";

    } else {
        if (STATUSES.length > 0) {
            const lastTab = bar.lastElementChild;
            if (lastTab) {
                lastTab.style.borderRadius = "0rem 1.5rem 1.5rem 0rem";
            }
        }
    }

    if (STATUSES.length > 0) {
        const firstTab = bar.firstElementChild;
        if (firstTab) {
            firstTab.style.borderRadius = "1.5rem 0rem 0rem 1.5rem";
        }
    }

    populateStatusDropdown();
}

function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.tab:not(.dragging):not(.add-tab)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function saveStatusOrder() {
    if (!hasPermission('add_status')) {
        alert('You do not have permission to reorder statuses.');
        return;
    }

    try {
        const statusOrder = STATUSES.map(s => s.id);

        const res = await fetch(`${API.statuses}/reorder`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({ order: statusOrder })
        });

        if (!res.ok) {
            if (res.status === 401) {
                logout();
                return;
            }
            const data = await res.json();
            throw new Error(data.error || "Failed to save status order");
        }

        console.log('Status order saved successfully');
    } catch (error) {
        console.error('Error saving status order:', error);
        alert('Failed to save status order: ' + error.message);
        await fetchStatus();
        renderStatuses();
    }
}

function enableStatusRename(tabEl, statusId, oldStatusName) {
    if (!hasPermission('rename_status')) {
        alert('You do not have permission to rename statuses.');
        return;
    }

    if (tabEl.querySelector("input")) return;

    const input = document.createElement("input");
    input.type = "text";
    input.value = oldStatusName;
    input.className = "status-edit-input";

    Object.assign(input.style, {
        padding: "6px 12px",
        fontSize: "14px",
        fontWeight: "500",
        border: "0px",
        borderRadius: "6px",
        outline: "none",
        backgroundColor: "transparent",
        color: "white",
        boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
        transition: "all 0.2s ease",
        minWidth: "120px",
        fontFamily: "inherit"
    });

    tabEl.textContent = "";
    tabEl.appendChild(input);
    input.focus();
    input.select();

    async function commit() {
        const newName = input.value.trim();

        if (!newName || newName === oldStatusName) {
            tabEl.textContent = oldStatusName;
            return;
        }

        try {
            await updateStatus(statusId, newName);

            const status = STATUSES.find(s => s.id === statusId);
            if (status) {
                status.name = newName;
            }

            renderStatuses();
            renderTasksForStatus(ACTIVE_STATUS);

        } catch (err) {
            alert(err.message);
            tabEl.textContent = oldStatusName;
        }
    }

    let isCommitting = false;

    input.addEventListener("blur", async () => {
        if (isCommitting) return;
        isCommitting = true;
        await commit();
    });

    input.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (isCommitting) return;
            isCommitting = true;
            input.blur();
            await commit();
        }
        if (e.key === "Escape") {
            isCommitting = true;
            input.blur();
            tabEl.textContent = oldStatusName;
        }
    });
}

// ====================================
//  TASK FUNCTIONS WITH PERMISSIONS
// ====================================
async function fetchTasks(status_id) {
    console.log("Fetching tasks for status ID:", status_id);
    if (!status_id) return [];

    const res = await fetch(
        `${API.tasks}/by_status/${encodeURIComponent(status_id)}`,
        { headers: getAuthHeaders() }
    );

    if (!res.ok) {
        if (res.status === 401) {
            logout();
            return [];
        }
        throw new Error("Failed to load tasks");
    }

    return await res.json();
}

let isRendering = false;
async function renderTasksForStatus(statusId = null) {
    if (isRendering) {
        return;
    }

    isRendering = true;

    try {
        const container = document.querySelector(".task-list-wrapper");
        if (!container) return;

        container.innerHTML = "";

        const addTaskContainer = document.querySelector('.add-task-container');
        if (addTaskContainer) {
            addTaskContainer.style.display = hasPermission('add_task') ? 'flex' : 'none';
        }

        const tasks = await fetchTasks(statusId);

        if (!tasks || tasks.length === 0) {
            const empty = document.createElement("div");
            empty.className = "task";
            empty.innerHTML = statusId
                ? `<span class="task-header">No tasks in this status</span>`
                : `<span class="task-header">No tasks</span>`;
            empty.style.textAlign = "center";
            container.appendChild(empty);
            return;
        }

        tasks.forEach(task => {
            const taskDiv = document.createElement("div");
            taskDiv.className = "task";

            const statusMeta = STATUSES.find(s => s.name === task.status);
            const statusColor = statusMeta ? statusMeta.color : "grey";
            const statusName = statusMeta ? statusMeta.name : "Unknown";

            const taskHeader = document.createElement("div");
            taskHeader.className = "task-header";

            const expandBtn = document.createElement("button");
            expandBtn.className = "expand-btn";
            expandBtn.textContent = "›";
            expandBtn.onclick = function () { toggleExpand(this); };

            const taskName = document.createElement("span");
            taskName.className = "task-name";
            taskName.textContent = task.title || `Task #${task.id}`;

            const statusChip = document.createElement("span");
            statusChip.className = "status-chip";
            statusChip.style.background = statusColor;
            // statusChip.textContent = statusName;

            if (hasPermission('change_status') && !hasPermission('edit_task')) {
                statusChip.style.cursor = "pointer";
                statusChip.title = "Click to change status";
                statusChip.onclick = function () { openStatusChangeModal(task.id, task.title, task.status); };
            }

            const taskActions = document.createElement("div");
            taskActions.className = "task-actions";

            if (hasPermission('edit_task')) {
                const editBtn = document.createElement("button");
                editBtn.textContent = "Edit";
                editBtn.onclick = function () { editTask(task.id); };
                taskActions.appendChild(editBtn);
            }

            if (hasPermission('delete_task')) {
                const deleteBtn = document.createElement("button");
                deleteBtn.textContent = "Delete";
                deleteBtn.onclick = function () { deleteTask(task.id); };
                taskActions.appendChild(deleteBtn);
            }

            taskHeader.appendChild(expandBtn);
            taskHeader.appendChild(taskName);
            taskHeader.appendChild(statusChip);

            if (taskActions.children.length > 0) {
                taskHeader.appendChild(taskActions);
            }

            const taskDetails = document.createElement("div");
            taskDetails.className = "task-details";
            taskDetails.innerHTML = `
                <p><strong>Description:</strong> ${task.description || "No description"}</p>
                <p><strong>Start Date:</strong> ${task.start_date || "—"}</p>
                <p><strong>End Date:</strong> ${task.end_date || "Not set"}</p>
                <p><strong>Status:</strong> ${task.status}</p>
                <p><strong>Members:</strong> ${(task.members && task.members.join(", ")) || "Unassigned"}</p>
                <p><strong>Created By:</strong> ${task.task_created_by || "Unassigned"}</p>
                <p><strong>Edited By:</strong> ${task.task_edited_by || "Unassigned"}</p>
            `;

            taskDiv.appendChild(taskHeader);
            taskDiv.appendChild(taskDetails);
            container.appendChild(taskDiv);
        });
    } finally {
        isRendering = false;
    }
}

function toggleExpand(button) {
    button.classList.toggle('expanded');
    const task = button.closest('.task');
    const taskDetails = task.querySelector('.task-details');

    task.classList.toggle('expanded');
    taskDetails.classList.toggle('show');
}

async function editTask(taskId) {
    if (!hasPermission('edit_task')) {
        alert('You do not have permission to edit tasks.');
        return;
    }

    try {
        console.log('Editing task ID:', taskId);

        const response = await fetch(`${API_URL}/tasks/${taskId}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to fetch task');

        const task = await response.json();
        console.log('Task data loaded:', task);

        currentEditingTaskId = taskId;

        document.getElementById('task-title').value = task.title;
        document.getElementById('task-description').value = task.description || '';
        document.getElementById('task-start-date').value = task.start_date;
        document.getElementById('task-end-date').value = task.end_date || '';
        document.getElementById('task-status').value = task.status;
        document.getElementById('task-members').value = task.members.join(', ');

        document.getElementById('modal-title').textContent = 'Edit Task';
        document.getElementById('modal-submit-btn').textContent = 'Update Task';

        populateStatusDropdown();

        const statusSelect = document.getElementById('task-status');
        if (statusSelect) {
            statusSelect.value = task.status;
        }

        console.log('Opening modal for editing...');
        document.getElementById('add-task-modal').style.display = 'block';

    } catch (error) {
        console.error('Error fetching task:', error);
        alert('Failed to load task for editing.');
    }
}

async function deleteTask(taskId) {
    if (!hasPermission('delete_task')) {
        alert('You do not have permission to delete tasks.');
        return;
    }

    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
        const response = await fetch(`${API_URL}/tasks/${taskId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to delete task');

        alert('Task deleted successfully!');
        await renderTasksForStatus(ACTIVE_STATUS);
    } catch (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task.');
    }
}

// ====================================
// MODAL FUNCTIONS
// ====================================
function populateStatusDropdown() {
    const statusSelect = document.getElementById("task-status");
    if (!statusSelect) return;

    statusSelect.innerHTML = "";

    STATUSES.forEach(status => {
        const option = document.createElement("option");
        option.value = status.id;
        option.textContent = status.name;
        statusSelect.appendChild(option);
    });

    if (ACTIVE_STATUS) {
        statusSelect.value = ACTIVE_STATUS;
    }

    if (!hasPermission('edit_task') && !hasPermission('add_task')) {
        statusSelect.disabled = !hasPermission('change_status');
    }
}

function openAddStatusModal() {
    if (!hasPermission('add_status')) {
        alert('You do not have permission to add statuses.');
        return;
    }

    const modal = document.getElementById('add-status-modal');

    document.getElementById('new-status-name').value = '';
    document.getElementById('new-status-color').value = '#4CAF50';

    modal.style.display = 'block';

    setTimeout(() => {
        document.getElementById('new-status-name').focus();
    }, 100);
}

let currentStatusChangeTask = null;

function openStatusChangeModal(taskId, taskTitle, currentStatusId) {
    currentStatusChangeTask = {
        id: taskId,
        title: taskTitle,
        currentStatus: currentStatusId
    };

    const modal = document.getElementById('status-change-modal');
    const currentStatusMeta = STATUSES.find(s => s.id === currentStatusId);

    document.getElementById('task-id-display').value = taskId;
    document.getElementById('task-title-display').value = taskTitle;
    document.getElementById('current-status-display').value = currentStatusMeta ? currentStatusMeta.name : 'Unknown';

    populateStatusDropdownForChange(currentStatusId);

    modal.style.display = 'block';

    setTimeout(() => {
        document.getElementById('new-status-select').focus();
    }, 100);
}

function populateStatusDropdownForChange(currentStatusId) {
    const statusSelect = document.getElementById('new-status-select');
    if (!statusSelect) return;

    statusSelect.innerHTML = '';

    STATUSES.forEach(status => {
        const option = document.createElement('option');
        option.value = status.id;
        option.textContent = status.name;
        statusSelect.appendChild(option);
    });

    if (statusSelect.options.length > 0) {
        statusSelect.selectedIndex = 0;
    }
}

function closeStatusChangeModal() {
    const modal = document.getElementById('status-change-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentStatusChangeTask = null;

    document.getElementById('change-status-form')?.reset();
}

document.getElementById('change-status-form')?.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!currentStatusChangeTask) {
        alert('No task selected for status change.');
        return;
    }

    const newStatusId = document.getElementById('new-status-select').value;
    const newStatusMeta = STATUSES.find(s => s.id === parseInt(newStatusId));

    if (!newStatusId) {
        alert('Please select a new status.');
        return;
    }

    const userConfirmed = confirm(`Change status of task "${currentStatusChangeTask.title}" to "${newStatusMeta?.name || 'Unknown'}"?`);
    if (!userConfirmed) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/tasks/${currentStatusChangeTask.id}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: parseInt(newStatusId) })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `Server responded with ${response.status}`);
        }

        const updatedTask = await response.json();

        alert(`Status updated successfully to "${newStatusMeta?.name || 'Unknown'}"`);
        closeStatusChangeModal();

        if (ACTIVE_STATUS) {
            await renderTasksForStatus(ACTIVE_STATUS);
        }

    } catch (error) {
        console.error('Full error object:', error);
        alert(`Failed to update status: ${error.message}`);
    }
});

window.addEventListener('click', function (event) {
    const modal = document.getElementById('status-change-modal');
    if (event.target === modal) {
        closeStatusChangeModal();
        closeModal()
    }
});

function openModal() {
    if (!hasPermission('add_task')) {
        alert('You do not have permission to add tasks.');
        return;
    }

    const modal = document.getElementById('add-task-modal');
    currentEditingTaskId = null;

    document.querySelector('.modal-content h2').textContent = 'Add New Task';
    document.querySelector('.submit-btn').textContent = 'Add Task';

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    document.getElementById('task-start-date').value = `${year}-${month}-${day}`;

    populateStatusDropdown();
    modal.style.display = 'block';
}

function closeModal() {
    const modal = document.getElementById('add-task-modal');
    const form = document.getElementById('add-task-form');

    modal.style.display = 'none';
    form.reset();
    currentEditingTaskId = null;
}

// ====================================
// FORM SUBMISSION WITH PERMISSIONS
// ====================================
document.getElementById('add-task-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (currentEditingTaskId && !hasPermission('edit_task')) {
        alert('You do not have permission to edit tasks.');
        return;
    }

    if (!currentEditingTaskId && !hasPermission('add_task')) {
        alert('You do not have permission to add tasks.');
        return;
    }

    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-description').value.trim();
    const startDate = document.getElementById('task-start-date').value;
    const endDate = document.getElementById('task-end-date').value;
    const status = parseInt(document.getElementById('task-status').value);
    const membersInput = document.getElementById('task-members').value.trim();
    const members = membersInput ? membersInput.split(',').map(m => m.trim()) : ['Unassigned'];

    const taskData = {
        title,
        description,
        start_date: startDate,
        end_date: endDate || null,
        status,
        members
    };

    try {
        let response;

        if (currentEditingTaskId) {
            response = await fetch(`${API_URL}/tasks/${currentEditingTaskId}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(taskData)
            });

            if (!response.ok) throw new Error('Failed to update task');
            alert('Task updated successfully!');
        } else {
            response = await fetch(`${API_URL}/tasks`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(taskData)
            });

            if (!response.ok) throw new Error('Failed to create task');
            alert('Task added successfully!');
        }

        closeModal();
        await renderTasksForStatus(ACTIVE_STATUS);
    } catch (error) {
        console.error('Error saving task:', error);
        alert('Failed to save task. Please try again.');
    }
});

document.getElementById('save-status-btn')?.addEventListener('click', async () => {
    const nameInput = document.getElementById('new-status-name');
    const colorInput = document.getElementById('new-status-color');

    const name = nameInput.value.trim();
    const color = colorInput.value;

    if (!name) {
        alert('Please enter a status name');
        nameInput.focus();
        return;
    }

    try {
        const saveBtn = document.getElementById('save-status-btn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Adding...';
        saveBtn.disabled = true;

        await addStatus(name, color);

        document.getElementById('add-status-modal').style.display = 'none';

        await fetchStatus();
        renderStatuses();

        alert(`Status "${name}" added successfully!`);

    } catch (error) {
        alert('Failed to add status: ' + error.message);
    } finally {
        const saveBtn = document.getElementById('save-status-btn');
        saveBtn.textContent = 'Add Status';
        saveBtn.disabled = false;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('save-status-btn')?.addEventListener('click', async () => {
        const nameInput = document.getElementById('new-status-name');
        const colorInput = document.getElementById('new-status-color');

        const name = nameInput.value.trim();
        const color = colorInput.value;

        if (!name) {
            alert('Please enter a status name');
            nameInput.focus();
            return;
        }

        try {
            const saveBtn = document.getElementById('save-status-btn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Adding...';
            saveBtn.disabled = true;

            await addStatus(name, color);

            document.getElementById('add-status-modal').style.display = 'none';

            await fetchStatus();
            renderStatuses();

            alert(`Status "${name}" added successfully!`);

        } catch (error) {
            alert('Failed to add status: ' + error.message);
        } finally {
            const saveBtn = document.getElementById('save-status-btn');
            saveBtn.textContent = 'Add Status';
            saveBtn.disabled = false;
        }
    });

    document.getElementById('cancel-status-btn')?.addEventListener('click', () => {
        document.getElementById('add-status-modal').style.display = 'none';
    });

    document.getElementById('add-status-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'add-status-modal') {
            e.target.style.display = 'none';
        }
    });

    document.getElementById('new-status-name')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('save-status-btn').click();
        }
    });
});

// ====================================
// INITIALIZATION
// ====================================
async function initializeApp() {
    try {
        await fetchStatus();
        ACTIVE_STATUS = STATUSES.length ? STATUSES[0].id : null;
        renderStatuses();
        await renderTasksForStatus(ACTIVE_STATUS);
        applyPermissions();
    } catch (err) {
        console.error(err);
        alert("Failed to initialize app.");
    }
}
