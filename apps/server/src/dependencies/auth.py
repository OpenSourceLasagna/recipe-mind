from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .clients import SupabaseClient

security = HTTPBearer()


def get_current_user_id(
    supabase_client: SupabaseClient,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> UUID:
    try:
        claims = supabase_client.auth.get_claims(credentials.credentials)
        if claims is None:
            raise HTTPException(status_code=401, detail="Invalid token: user not found")
        user_id = claims.get("claims").get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=401, detail="Invalid token: user ID not found"
            )
        return UUID(user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication error: {str(e)}")


current_user_id_dep = Depends(get_current_user_id)
type CurrentUserID = Annotated[UUID, current_user_id_dep]
