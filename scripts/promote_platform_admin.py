"""Grant the platform-admin custom claim to a Firebase user.

Usage:
  python scripts/promote_platform_admin.py <email>

Requires:
  - firebase-admin installed (`pip install firebase-admin`)
  - GOOGLE_APPLICATION_CREDENTIALS pointing to backend/service-account.json
    (set automatically if you've run scripts/bootstrap.ps1)

The user must SIGN OUT AND SIGN BACK IN after promotion for the new claim to
appear in their ID token. Alternatively the frontend force-refreshes the
token after a brief delay.
"""

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
KEY_PATH = REPO_ROOT / "backend" / "service-account.json"
if KEY_PATH.exists() and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(KEY_PATH)

try:
    import firebase_admin
    from firebase_admin import auth, credentials
except ImportError:
    print("Install firebase-admin first:  pip install firebase-admin", file=sys.stderr)
    sys.exit(1)


def main(email: str) -> None:
    project_id = (
        os.environ.get("FIREBASE_PROJECT_ID")
        or os.environ.get("GCP_PROJECT_ID")
        or "conversational-ai-496700"
    )
    firebase_admin.initialize_app(credentials.ApplicationDefault(), {"projectId": project_id})

    user = auth.get_user_by_email(email)
    existing_claims = user.custom_claims or {}
    new_claims = {**existing_claims, "is_platform_admin": True}
    auth.set_custom_user_claims(user.uid, new_claims)
    print(f"Promoted {email} (uid {user.uid}) to platform admin.")
    print("They must sign out and sign back in for the claim to appear in their token.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/promote_platform_admin.py <email>")
        sys.exit(1)
    main(sys.argv[1])
