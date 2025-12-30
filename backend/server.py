import json
import os
import jwt
from datetime import datetime, timedelta
from functools import wraps
import backend as backend
from flask import Flask, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS

from dotenv import load_dotenv

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM")
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", 24))

app = Flask(__name__)


@app.after_request
def after_request(response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add(
        "Access-Control-Allow-Methods", "GET,PUT,POST,PATCH,DELETE,OPTIONS"
    )
    return response


def get_current_user():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        payload = decode_token(token)
        if payload and "user_id" in payload:
            data = backend.load_user()
            user = next(
                (u for u in data.get("users", []) if u.get("id") == payload["user_id"]),
                None,
            )
            if user:
                return user["username"]  # or return full dict if needed
    return "anonymous"


# AUTHENTICATION ENPOINTS Started
def generate_token(user_id, username, role):
    """Generate JWT token for authenticated user"""
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.utcnow(),
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token


def decode_token(token):
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None  # Token expired
    except jwt.InvalidTokenError:
        return None  # Invalid token


def role_required(allowed_roles):
    """Decorator to check if user has required role"""

    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            # Handle OPTIONS
            if request.method == "OPTIONS":
                return f(*args, **kwargs)

            # Verify token first
            token = None
            auth_header = request.headers.get("Authorization")

            if auth_header:
                try:
                    token = auth_header.split(" ")[1]
                except (IndexError, AttributeError):
                    return jsonify({"error": "Invalid token format"}), 401

            if not token:
                return jsonify({"error": "Token is missing"}), 401

            payload = decode_token(token)
            if not payload:
                return jsonify({"error": "Token is invalid or expired"}), 401

            # Check role
            user_role = payload.get("role")
            if user_role not in allowed_roles:
                return jsonify({"error": "Insufficient permissions"}), 403

            # Store user info
            request.current_user = payload
            return f(*args, **kwargs)

        return decorated

    return decorator


@app.route("/signup", methods=["POST"])
def signup():
    try:
        payload = request.json
        username = payload.get("username")
        password = generate_password_hash(payload.get("password"))
        role = payload.get("role", "dev").lower()
        secretKey = payload.get("secretKey")

        # Validate admin/owner role
        if role in ["admin", "owner"]:
            print("Secret key = ", secretKey, " Secret key in env file = ", SECRET_KEY)
            if not secretKey or secretKey != SECRET_KEY:
                return jsonify({"error": "Invalid secret key"}), 403

        # Validate required fields
        if not username or not payload.get("password"):
            return jsonify({"error": "Username and password are required"}), 400

        # Load users
        data = backend.load_user()
        users = data["users"]

        # Check if username exists
        if any(u["username"] == username for u in users):
            return jsonify({"error": "Username already exists"}), 400

        # Create new user
        new_user = {
            "id": data["next_id"],
            "username": username,
            "password": password,
            "role": role,
        }

        users.append(new_user)
        data["next_id"] += 1
        backend.save_users(data)

        # Generate JWT token for auto-login after signup
        token = generate_token(new_user["id"], username, role)

        return (
            jsonify(
                {
                    "message": "User registered successfully",
                    "token": token,
                    "user": {"id": new_user["id"], "username": username, "role": role},
                }
            ),
            201,
        )

    except Exception as e:
        print("Error occurred in registering new user =", str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/login", methods=["POST"])
def login():
    try:
        payload = request.json
        username = payload.get("username")
        password = payload.get("password")

        # Validate required fields
        if not username or not password:
            return jsonify({"error": "Username and password are required"}), 400

        # Load users
        data = backend.load_user()
        users = data["users"]

        # Find user
        user = next((u for u in users if u["username"] == username), None)

        if not user:
            return jsonify({"error": "Invalid username"}), 401

        # Verify password
        if not check_password_hash(user["password"], password):
            return jsonify({"error": "Invalid password"}), 401

        # Generate JWT token
        token = generate_token(user["id"], user["username"], user["role"])

        return (
            jsonify(
                {
                    "message": "Login successful",
                    "token": token,
                    "user": {
                        "id": user["id"],
                        "username": user["username"],
                        "role": user["role"],
                    },
                }
            ),
            200,
        )

    except Exception as e:
        print("Error occurred in logging in the user =", str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/verify-token", methods=["GET", "POST", "OPTIONS"])
def verify_token():
    if request.method == "OPTIONS":
        return "", 200

    try:
        # --- Extract Authorization header ---
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization header missing or invalid"}), 401

        token = auth_header.split(" ", 1)[1]

        # --- Decode token ---
        payload = decode_token(token)
        if not payload or "user_id" not in payload:
            return jsonify({"error": "Invalid or expired token"}), 401

        # --- Lookup user ---
        data = backend.load_user()
        user = next(
            (u for u in data.get("users", []) if u.get("id") == payload["user_id"]),
            None,
        )
        if not user:
            return jsonify({"error": "User not found"}), 404

        # --- Success response ---
        return (
            jsonify(
                {
                    "valid": True,
                    "user": {
                        "id": user["id"],
                        "username": user["username"],
                        "role": user["role"],
                    },
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Error in verify_token: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/permissions/<role>", methods=["GET"])
def get_permissions(role):
    try:
        permissions = backend.load_permission()
        role_perm = permissions.get("permissions", {}).get(role.lower(), [])
        return jsonify({"role": role, "permissions": role_perm}), 200
    except Exception as e:
        print("Error in permissions route is this", str(e))
        return jsonify({"error": str(e)}), 500


# AUTHENTICATION ENPOINTS Ended


# STATUS ENDPOINT Started
@app.route("/status", methods=["GET"])
def get_all_status():
    data = backend.load_status()
    response = data["status"]
    return jsonify(response), 200


@app.route("/status", methods=["POST"])
def add_status():
    """Add a new status with color"""
    try:
        # Check if user has add_status permission
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return jsonify({"error": "No token provided"}), 401

        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=JWT_ALGORITHM)
            user_role = payload.get("role")
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        # Check permission
        if not backend.check_permission(user_role, "add_status"):
            return jsonify({"error": "Permission denied"}), 403

        # Get request data
        payload = request.json
        status_name = payload.get("name")
        status_color = payload.get("color", "#6c757d")  # Default grey color

        if not status_name:
            return jsonify({"error": "Status name is required"}), 400

        # Validate status name (no duplicates, not empty)
        status_name = status_name.strip()
        if not status_name:
            return jsonify({"error": "Status name cannot be empty"}), 400

        all_status = backend._get_all_status()

        existing_names = [status["name"] for status in all_status]
        if status_name in existing_names:
            return jsonify({"error": f"Status '{status_name}' already exists"}), 400

        # Validate color (basic check)
        if not status_color.startswith("#") or len(status_color) != 7:
            return (
                jsonify({"error": "Color must be a valid hex color (e.g., #4CAF50)"}),
                400,
            )

        if not backend.add_status(status_name, status_color):
            return (
                jsonify({"error": "An error occured while adding new status"}),
                400,
            )

        return (
            jsonify(
                {
                    "message": f"Status '{status_name}' added successfully",
                    "status": {"name": status_name, "color": status_color},
                }
            ),
            201,
        )

    except Exception as e:
        print("Error adding status:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/status/<int:status_id>", methods=["DELETE"])
def delete_status(status_id):
    """Delete a status"""
    try:
        # Verify JWT token
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return jsonify({"error": "No token provided"}), 401

        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            user_role = payload.get("role")
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        # Check if user has add_status permission (same permission for delete)
        if not backend.check_permission(user_role, "add_status"):
            return jsonify({"error": "Permission denied"}), 403

        success = backend.delete_status(status_id)

        if not success[0]:
            print("Error in deleting status = ", success[1])
            return jsonify({"message": success[1]}), 400

        return jsonify({"message": "Status deleted successfully"}), 200

    except Exception as e:
        print("Error deleting status:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/status/<int:id>", methods=["PUT"])
def update_status_name(id):
    data = request.json
    id = data.get("id")
    name = data.get("name")

    if not id or not name:
        return jsonify(({"error": "Invalid Data for Status name update"}))

    try:
        success = backend.update_status(id, name)
        if not success:
            return jsonify({"Error": "Status not found"}), 404
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# STATUS ENDPOINT Ended


# TASKS ENDPOINTS Started
@app.route("/tasks", methods=["GET"])
def get_tasks():
    """Get all tasks organized by category"""
    try:
        data = {
            "overdue": backend.get_overdue_tasks(),
            "today": backend.get_today_tasks(),
            "tomorrow": backend.get_tomorrow_tasks(),
            "upcoming": backend.get_upcomming_tasks(),
        }
        print("Sending this data from the backend = ", data)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/tasks/by_status/<int:status_id>", methods=["GET"])
def get_tasks_by_category(status_id):
    try:
        tasks = backend.get_task_by_status(status_id)
        return jsonify(tasks), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/tasks", methods=["POST"])
def create_task():
    """Create a new task"""
    try:
        payload = request.json

        if not payload.get("title"):
            return jsonify({"error": "Title is required"}), 400
        if not payload.get("start_date"):
            return jsonify({"error": "Start date is required"}), 400

        current_user = get_current_user()

        task = backend.add_task(
            title=payload.get("title"),
            start_date=payload.get("start_date"),
            end_date=payload.get("end_date"),
            members=payload.get("members"),
            description=payload.get("description", ""),
            status=payload.get("status", "todo"),
            task_created_by=current_user,
            task_edited_by=current_user,
        )
        return jsonify(task), 201
    except ValueError as e:
        print("Error occurred in create_task = ", e)
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print("Error occurred in create_task = ", e)
        return jsonify({"error": str(e)}), 500


@app.route("/tasks/<int:task_id>", methods=["PUT", "PATCH"])
def update_task(task_id):
    """Update a task by ID"""
    try:
        updates = request.json

        if not updates:
            return jsonify({"error": "No updates provided"}), 400

        # Get current user from JWT token
        current_user = get_current_user()

        # Always add/overwrite the task_edited_by field with current user
        updates["task_edited_by"] = current_user
        updates["edited_at"] = datetime.now().strftime("%d %b %Y, %I:%M %p")

        success = backend.edit_task_by_id(task_id, updates)

        if success:
            updated_task = backend.get_task_by_id(task_id)
            return jsonify(updated_task), 200
        else:
            return jsonify({"error": "Task not found"}), 404
    except ValueError as e:
        print("Error occurred in update_task = ", str(e))
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print("Error occurred in update_task = ", str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/tasks/<int:task_id>", methods=["GET"])
def get_task(task_id):
    """Get a specific task by ID"""
    try:
        task = backend.get_task_by_id(task_id)
        if task:
            return jsonify(task), 200
        else:
            return jsonify({"error": "Task not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/tasks/<int:task_id>/status", methods=["PATCH"])
def change_task_status(task_id):
    """Change only the status of a task (for Dev users with change_status permission)"""
    try:
        # Verify JWT token
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return jsonify({"error": "No token provided"}), 401

        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=JWT_ALGORITHM)
            user_role = payload.get("role")
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        # Check if user has change_status permission
        if not backend.check_permission(user_role, "change_status"):
            return jsonify({"error": "Permission denied"}), 403

        payload = request.json
        new_status = payload.get("status")

        if not new_status:
            return jsonify({"error": "Status is required"}), 400

        # Update only the status field
        success = backend.edit_task_by_id(task_id, {"status": new_status})

        if success:
            updated_task = backend.get_task_by_id(task_id)
            return jsonify(updated_task), 200
        else:
            return jsonify({"error": "Task not found"}), 404

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    """Delete a task by ID"""
    try:
        success = backend.delete_task_by_id(task_id)

        if success:
            return jsonify({"message": "Task deleted successfully"}), 200
        else:
            return jsonify({"error": "Task not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/tasks/search", methods=["GET"])
def search_tasks():
    """Search tasks by keyword in title"""
    try:
        keyword = request.args.get("q", "")

        if not keyword:
            return jsonify({"error": "Search keyword 'q' is required"}), 400

        results = backend.get_search_tasks(keyword)
        return jsonify(results), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# TASKS ENDPOINTS Ended


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy"}), 200


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
