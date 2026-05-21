"""TenantContext — the only authoritative source of business_id and role.

Built from a verified Firebase ID token. Never accept business_id/role from
request bodies or query strings — read them here.
"""

from dataclasses import dataclass
from typing import Literal

Role = Literal["owner", "admin", "manager", "staff", "customer"]
ROLE_LEVELS: dict[str, int] = {
    "customer": 0,
    "staff": 1,
    "manager": 2,
    "admin": 3,
    "owner": 4,
}


@dataclass(frozen=True)
class TenantContext:
    uid: str               # Firebase user ID
    email: str | None
    business_id: str | None  # None on first sign-in before business is created
    role: Role | None
    is_platform_admin: bool = False

    def require_business(self) -> str:
        if not self.business_id:
            raise PermissionError("User is not associated with a business yet.")
        return self.business_id

    def require_role(self, minimum: Role) -> None:
        if self.role is None or ROLE_LEVELS[self.role] < ROLE_LEVELS[minimum]:
            raise PermissionError(
                f"Requires role '{minimum}' or higher (have '{self.role}')."
            )

    def require_platform_admin(self) -> None:
        if not self.is_platform_admin:
            raise PermissionError("Platform admin only.")


def context_from_claims(claims: dict) -> TenantContext:
    return TenantContext(
        uid=claims["uid"],
        email=claims.get("email"),
        business_id=claims.get("business_id"),
        role=claims.get("role"),
        is_platform_admin=bool(claims.get("is_platform_admin", False)),
    )
