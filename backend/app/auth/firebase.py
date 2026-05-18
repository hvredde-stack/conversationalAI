"""Firebase Admin SDK initialization and token verification."""

import firebase_admin
from firebase_admin import auth, credentials

from app.config import get_settings

_initialized = False


def init_firebase() -> None:
    global _initialized
    if _initialized:
        return
    settings = get_settings()
    # Application Default Credentials picks up GOOGLE_APPLICATION_CREDENTIALS
    # locally, or the attached service account on Cloud Run.
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})
    _initialized = True


def verify_id_token(id_token: str) -> dict:
    """Verify a Firebase ID token. Returns the decoded claims.

    Raises firebase_admin.auth.InvalidIdTokenError on bad tokens.
    """
    init_firebase()
    return auth.verify_id_token(id_token)


def set_custom_claims(uid: str, claims: dict) -> None:
    """Attach custom claims (business_id, role) to a user's ID token.

    Note: clients must re-fetch their ID token (force refresh) to see new claims.
    """
    init_firebase()
    auth.set_custom_user_claims(uid, claims)
