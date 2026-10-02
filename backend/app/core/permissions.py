"""Role names and permission helpers (RBAC)."""
from fastapi import HTTPException, status

ROLE_ADMIN = "Admin"
ROLE_DEVELOPER = "Developer"
ROLE_VIEWER = "Viewer"

ALL_ROLES = (ROLE_ADMIN, ROLE_DEVELOPER, ROLE_VIEWER)
EDITOR_ROLES = (ROLE_ADMIN, ROLE_DEVELOPER)

ROLE_DESCRIPTIONS = {
    ROLE_ADMIN: "Full access: users, environments, all flags incl. protected environments",
    ROLE_DEVELOPER: "Create and manage flags and rollouts in non-protected environments",
    ROLE_VIEWER: "Read-only access to flags, dashboards, analytics and audit logs",
}


def ensure_env_write_access(user, environment) -> None:
    """Protected environments (e.g. Production) can only be changed by Admins."""
    if environment.is_protected and user.role.name != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Environment '{environment.name}' is protected. Only Admins can modify it.",
        )
