from datetime import date
import backend

def print_tasks(tasks, overdue_ids=None, empty_message="No tasks found."):
    if not tasks:
        print(empty_message)
        return

    print("\nID   title                     Status       Start        End")
    print("--   ----------------------  -----------  ----------   ----------")

    for task in tasks:
        title_display = task["title"]

        if overdue_ids and task["id"] in overdue_ids:
            title_display += " (!)";

        print(
            f"{task['id']:<4} "
            f"{title_display:<24} "
            f"{task['status']:<12} "
            f"{task['start_date']:<12} "
            f"{task['end_date'] or '-'}"
        )

def list_all_tasks():
    data = backend.load_tasks()
    tasks = data["tasks"]

    overdue_tasks = backend.get_overdue_tasks()
    overdue_ids = {task["id"] for task in overdue_tasks}

    print_tasks(tasks,overdue_ids)

def list_overdue_tasks():
    overdue_tasks = backend.get_overdue_tasks()
    overdue_ids = [task["id"] for task in overdue_tasks]

    print_tasks(overdue_tasks,overdue_ids,empty_message="No overdue Task found 😊")

def list_today_tasks():
    today_task = backend.get_today_tasks()

    print_tasks(today_task,empty_message="No tasks found for today")

def list_tomorrow_tasks():
    tomorrow_tasks = backend.get_tomorrow_tasks()

    print_tasks(tomorrow_tasks,empty_message="No tasks found for tomorrow")

def list_upcomming_tasks():
    upcomming_tasks = list_upcomming_tasks()

    print_tasks(upcomming_tasks,empty_message="No tasks found for upcomming days")

def add_task():
    print("\n--- Add New Task ---")

    while True:
        title = input("Task title: ").strip()
        if title:
            break
        print("Title cannot be empty. Please enter a task title.")

    start_date = input("Start date (YYYY-MM-DD) [default: today]: ").strip()
    if not start_date:
        start_date = date.today().strptime("%Y-%m-%d")

    end_date = input("End date (YYYY-MM-DD) [optional]: ").strip()
    end_date = end_date if end_date else None

    status = input("Status (todo / in progress / completed) [default: todo]: ").strip()
    status = status if status else None

    members_input = input("Members (comma-separated) [optional]: ").strip()
    members = (
        [m.strip() for m in members_input.split(",") if m.strip()]
        if members_input else None
    )

    description = input("Description [optional]: ").strip()

    try:
        task = backend.add_task(
            title=title,
            start_date=start_date,
            end_date=end_date,
            status=status,
            members=members,
            description=description
        )
        print(f"\nTask added successfully (ID: {task['id']})")

    except ValueError as e:
        print(f"Error: {e}")

def view_task():
    try:
        task_id = int(input("Enter Task ID to view: ").strip())
    except ValueError:
        print("Invalid input. Please enter a number.")
        return

    task = backend.get_task_by_id(task_id)
    if not task:
        print(f"No task found with ID {task_id}.")
        return

    print("\n--- Task Details ---")
    print(f"ID         : {task['id']}")
    print(f"Title      : {task['title']}")
    print(f"Start Date : {task['start_date']}")
    print(f"End Date   : {task['end_date'] or '-'}")
    print(f"Status     : {task['status']}")
    print(f"Members    : {', '.join(task['members'])}")
    print(f"Description: {task['description'] or '-'}")

    while True:
        print("\nActions:")
        print("1. Edit this task")
        print("2. Delete this task")
        print("0. Exit")

        choice = input("Enter your choice: ").strip()

        if choice == "1":
            edit_task(task_id)
            break
        elif choice == "2":
            delete_task(task_id)
            print("task Deleted")
            break
        elif choice == "0":
            break
        else:
            print("Invalid choice. Please enter 0, 1, or 2.")

def delete_task(task_id: int):
    confirm = input(f"Are you sure you want to delete task {task_id}? (y/n): ").strip().lower()
    if confirm == "y":
        if backend.delete_task_by_id(task_id):
            print(f"Task {task_id} deleted successfully.")
        else:
            print(f"No task found with ID {task_id}.")
    else:
        print("Deletion cancelled.")

def edit_task(task_id: int):
    task = backend.get_task_by_id(task_id)
    if not task:
        print(f"No task found with ID {task_id}.")
        return

    print("\n--- Edit Task ---")
    print("Leave input blank to keep the current value.\n")

    updates = {}

    new_title = input(f"Title [{task['title']}]: ").strip()
    if new_title:
        updates["title"] = new_title

    new_start = input(f"Start Date [{task['start_date']}]: ").strip()
    if new_start:
        updates["start_date"] = new_start

    new_end = input(f"End Date [{task['end_date'] or '-'}]: ").strip()
    if new_end:
        updates["end_date"] = new_end

    choice = input(
    f"Press 'y' to update status from '{task['status']}' to next stage, "
    f"or 'n' to keep it as is: "
    ).strip().lower()
    if choice == "y":
        updates["status"] = "__NEXT__"
    
    # new_status = input(f"Status [{task['status']}]: ").strip()
    # if new_status:
    #     updates["status"] = new_status

    members_input = input(f"Members (comma-separated) [{', '.join(task['members'])}]: ").strip()
    if members_input:
        updates["members"] = [m.strip() for m in members_input.split(",") if m.strip()]

    new_desc = input(f"Description [{task['description'] or '-'}]: ").strip()
    if new_desc:
        updates["description"] = new_desc

    if not updates:
        print("No changes made.")
        return

    try:
        if backend.edit_task_by_id(task_id, updates):
            print("Task updated successfully.")
        else:
            print("Task not found.")
    except ValueError as e:
        print(f"Error updating task: {e}")

def list_searched_tasks():

    while True:
        keyword = input("Enter a Keyword to search: ").strip()
        if keyword:
            break
        print("Keyword cannot be empty. Please enter a task title.")
    searched_task = backend.get_search_tasks(keyword)
    overdue_tasks = backend.get_overdue_tasks()
    overdue_ids = {task["id"] for task in overdue_tasks}

    print_tasks(searched_task,overdue_ids,empty_message="No tasks found for given keyword ")

def show_menu():
    print("\n--- TO-DO APP ---")
    print("1. List All Tasks")
    print("2. List Overdue Tasks")
    print("3. List Today Tasks")
    print("4. List Tomorrow Tasks")
    print("5. List Upcoming Tasks")
    print("6. Add Task")
    print("7. View Task")
    print("8. Search Task")
    print("9. Exit")

def main():
    while True:
        show_menu()
        choice = input("Enter your choice: ")

        match choice:
            case "1":
                print("\nListing all tasks...")
                list_all_tasks()
            case "2":
                print("\nListing overdue tasks...")
                list_overdue_tasks()
            case "3":
                print("\nListing today's tasks...")
                list_today_tasks
            case "4":
                print("\nListing tomorrow tasks...")
                list_tomorrow_tasks()
            case "5":
                print("\nListing upcomming tasks...")
                list_upcomming_tasks()
            case "6":
                print("\n Adding a new task...")
                add_task()
            case "7":
                print("\nViewing a task...")
                view_task()
            case "8":
                print("\nEnter keyword...")
                list_searched_tasks()
            case "9":
                print("\nExiting app...")
                break
            case _:
                print("Invalid choice. Please try again.")

if __name__ == "__main__":
    main()