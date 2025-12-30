import json
import os
from datetime import date, datetime, timedelta
from typing import List

TASK_FILE = "tasks.json"
USER_FILE = "users.json"
STATUS_FILE = "status.json"
PERMISSION_FILE = "permission.json"


# LOAD FUNCTIONS Started
def load_user():
    if not os.path.exists(USER_FILE):
        return {"next_id": 1, "users": []}
    with open(USER_FILE, "r") as f:
        return json.load(f)


def save_users(data):
    with open(USER_FILE, "w") as f:
        json.dump(data, f, indent=4)


def load_tasks():
    if not os.path.exists(TASK_FILE):
        return {"next_id": 1, "tasks": []}
    with open(TASK_FILE, "r") as f:
        return json.load(f)


def save_tasks(data):
    with open(TASK_FILE, "w") as f:
        json.dump(data, f, indent=4)


def load_status():
    if not os.path.exists(STATUS_FILE):
        return {"next_id": 1, "status": []}
    with open(STATUS_FILE, "r") as f:
        return json.load(f)


def save_status(status_dict):
    with open(STATUS_FILE, "w") as f:
        json.dump(status_dict, f, indent=4)


def load_permission():
    if not os.path.exists(PERMISSION_FILE):
        default_permission = {
            "permissions": {
                "owner": [
                    "add_task",
                    "edit_task",
                    "delete_task",
                    "add_status",
                    "change_status",
                    "full_access",
                ],
                "admin": ["add_task", "edit_task", "delete_task", "add_status"],
                "manager": ["add_task"],
                "dev": ["change_status"],
            }
        }
        with open(PERMISSION_FILE, "w") as f:
            json.dump(default_permission, f, indent=4)

        # Return the default permission we just created
        return default_permission

    # File exists, load it
    with open(PERMISSION_FILE, "r") as f:
        return json.load(f)


# LOAD FUNCTIONS Ended


def check_permission(role, action):
    permission = load_permission()
    role_perm = permission.get("permissions", {}).get(role.lower(), [])
    return action in role_perm or "full_access" in role_perm


def _get_all_tasks():
    return load_tasks()["tasks"]


def _get_all_status():
    return load_status()["status"]


def get_task_by_status(status_id):
    tasks = _get_all_tasks()
    status = get_status_by_id(status_id)

    result = []

    for task in tasks:
        if task["status_id"] == status_id:
            task["status"] = status["name"]
            result.append(task)

    return result


def add_task(
    title: str,
    start_date: str,
    end_date: str | None = None,
    members: List[str] | None = None,
    description: str = "",
    status_id: str = "todo",
    task_created_by: str = "anonymous",
    task_edited_by: str = "anonymous",
):
    data = load_tasks()
    tasks = data["tasks"]
    all_status_id = [status["id"] for status in _get_all_status()]

    status_id = status_id or 2
    if status_id not in all_status_id:
        raise ValueError("Invalid status")

    if not members:
        members = ["Unassigned"]

    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else None
    except ValueError:
        raise ValueError("Dates must be in YYYY-MM-DD format")

    if end_dt and end_dt < start_dt:
        raise ValueError("End date cannot be before start date")

    created_at = datetime.now().strftime("%d %b %Y, %I:%M %p")
    edited_at = datetime.now().strftime("%d %b %Y, %I:%M %p")

    task = {
        "id": data["next_id"],
        "title": title.strip(),
        "status": status_id,
        "start_date": start_date,
        "end_date": end_date,
        "members": members,
        "description": description.strip(),
        "task_created_by": task_created_by,
        "task_edited_by": task_edited_by,
        "created_at": datetime.now().isoformat(),
        "edited_at": datetime.now().isoformat(),
    }

    tasks.append(task)
    data["next_id"] += 1

    with open(TASK_FILE, "w") as f:
        json.dump(data, f, indent=4)

    return task


def get_task_by_id(task_id: int):
    tasks = load_tasks()["tasks"]
    for task in tasks:
        if task["id"] == task_id:
            return task
    return None


def delete_task_by_id(task_id: int) -> bool:
    data = load_tasks()
    tasks = data["tasks"]

    for i, task in enumerate(tasks):
        if task["id"] == task_id:
            del tasks[i]
            with open(TASK_FILE, "w") as f:
                json.dump(data, f, indent=4)
            return True

    return False


def get_status_by_id(status_id: int):
    all_status = _get_all_status()

    for status in all_status:
        if status["id"] == status_id:
            return status


def delete_status(status_id: int) -> tuple[bool, str]:
    """
    Delete a status only if no tasks are using it
    Returns: (success: bool, message: str)
    """
    sdata = _get_all_status()
    tdata = load_tasks()
    tasks = tdata["tasks"]

    status_found = None
    for existing_status in sdata:
        if existing_status["id"] == status_id:
            status_found = existing_status["id"]
            break

    if not status_found:
        return False, f"Status '{status_id}' not found"

    tasks_using_status = []
    for task in tasks:
        if task["status_id"] == status_id:
            tasks_using_status.append(task)

    if tasks_using_status:
        task_count = len(tasks_using_status)
        task_examples = [t["title"] for t in tasks_using_status[:3]]
        message = f"Cannot delete status '{status_found}' because {task_count} task(s) are using it."
        if task_examples:
            message += f" Examples: {', '.join(task_examples)}..."
        return False, message

    data = load_status()
    all_status = data["status"]

    for i, status in enumerate(all_status):
        if status["id"] == status_id:
            del all_status[i]
            with open(STATUS_FILE, "w") as f:
                json.dump(data, f, indent=4)
            break

    return True, f"Status '{status_found}' deleted successfully"


def add_status(name: str, color: str):
    data = load_status()
    all_status = data["status"]

    status = {"id": data["next_id"], "name": name, "color": color}
    all_status.append(status)
    data["next_id"] += 1

    with open(STATUS_FILE, "w") as f:
        json.dump(data, f, indent=4)

    return True


def edit_task_by_id(task_id: int, updates: dict) -> bool:
    """Edit a task by ID - simplified version"""
    data = load_tasks()
    tasks = data["tasks"]
    sdata = load_status()

    for task in tasks:
        if task["id"] == task_id:
            # Apply all updates directly (assuming frontend sends validated data)
            for key, value in updates.items():
                # Only update allowed fields
                allowed_fields = {
                    "title",
                    "status",
                    "start_date",
                    "end_date",
                    "members",
                    "description",
                    "task_edited_by",
                }
                if key in allowed_fields:
                    task[key] = value

            task["edited_at"] = datetime.now().isoformat()

            if "task_edited_by" in updates:
                task["task_edited_by"] = updates["task_edited_by"]

            with open(TASK_FILE, "w") as f:
                json.dump(data, f, indent=4)
            return True

    return False


def get_search_tasks(keyword: str):
    """
    Search tasks by title/title containing the keyword (case-insensitive).
    Returns a list of matching tasks.
    """
    keyword = keyword.lower()
    tasks = _get_all_tasks()

    result = []
    for task in tasks:
        if keyword in task["title"].lower():
            result.append(task)

    return result


def update_status(id: int, new_name: str) -> bool:
    all_status = _get_all_status()

    new_name = new_name.strip()

    if not new_name:
        raise ValueError("New status name cannot be empty")

    data = load_status()
    all_status = data["status"]

    for i, status in enumerate(all_status):
        if status["id"] == id:
            status["name"] = new_name
            break
    return True


# unsed functions start
def get_overdue_tasks():
    tasks = _get_all_tasks("task")
    today = date.today()

    overdue = []
    for task in tasks:
        start_date = datetime.strptime(task["start_date"], "%Y-%m-%d").date()
        if start_date < today and task["status"].lower() != "completed":
            overdue.append(task)
    return overdue


def _get_tasks_by_date(target_date):
    tasks = _get_all_tasks("task")

    result = []
    for task in tasks:
        start_date = datetime.strptime(task["start_date"], "%Y-%m-%d").date()
        if start_date == target_date:
            result.append(task)

    return result


def get_today_tasks():
    return _get_tasks_by_date(date.today())


def get_tomorrow_tasks():
    return _get_tasks_by_date(date.today() + timedelta(days=1))


def get_upcomming_tasks():
    tasks = _get_all_tasks("task")

    tomorrow = date.today() + timedelta(days=1)

    upcomming_tasks = []

    for task in tasks:
        start_date = datetime.strptime(task["start_date"], "%Y-%m-%d").date()
        if start_date > tomorrow:
            upcomming_tasks.append(task)

    return upcomming_tasks


# unsed functioin end
