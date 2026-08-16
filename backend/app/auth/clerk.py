"""Clerk JWT verification for FastAPI.

Verifies the `Authorization: Bearer <token>` header by decoding the Clerk
session token using the Clerk JWKS public key. Provides a reusable FastAPI
dependency (`get_current_user`) that returns the Clerk user id.
"""
import os
from typing import Dict, Any

import httpx
import jwt  # PyJWT
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Fetch the Clerk JWKS keys from Clerk's well-known endpoint.
CLERK_JWKS_URL = "https://{frontend_api}/.well-known/jwks.json"


def _jwks_uri() -> str:
    frontend_api = os.getenv(
        "CLERK_FRONTEND_API",
        "your-clerk-instance.clerk.accounts.dev",
    )
    return f"https://{frontend_api}/.well-known/jwks.json"


def _get_public_keys() -> Dict[str, Any]:
    """Fetch and cache the Clerk JWKS public keys."""
    try:
        resp = httpx.get(_jwks_uri(), timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:  # pragma: no cover - networking/fallback
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not fetch Clerk JWKS keys.",
        ) from exc


_bearer = HTTPBearer(auto_error=False)


def verify_clerk_token(
    credentials: HTTPAuthorizationCredentials | None,
) -> Dict[str, Any]:
    """Verify a Clerk session JWT and return its decoded claims."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    jwks = _get_public_keys()

    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")

    key = None
    for k in jwks.get("keys", []):
        if k.get("kid") == kid:
            key = jwt.algorithms.RSAAlgorithm.from_jwk(k)
            break

    if key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to find matching Clerk signing key.",
        )

    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=os.getenv("CLERK_JWT_AUDIENCE", "fastapi"),
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
        ) from exc

    return claims


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    """FastAPI dependency returning the authenticated Clerk user id."""
    claims = verify_clerk_token(credentials)
    return claims.get("sub", "anonymous")
