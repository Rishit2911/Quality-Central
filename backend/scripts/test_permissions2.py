from backend.core.permissions import require_permission
import inspect

checker = require_permission(["deploy.employees.view_list", "deploy.employees.view_team"])
# This checker takes (current_user). Let's mock a user.

current_user = {
    "roles": ["org_admin"],
    "permissions": {
        "deploy.employees.view_list": True
    }
}
try:
    checker(current_user=current_user)
    print("SUCCESS")
except Exception as e:
    print(f"FAILED: {e}")
