

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .services import get_app_services

security = HTTPBearer()
    
def get_current_user_id(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)) -> UUID:
    try:
        return get_current_user_id_from_supabase(request, credentials)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication error: {str(e)}")
    
def get_current_user_id_from_supabase(request: Request, credentials: HTTPAuthorizationCredentials) -> UUID:
    services = get_app_services(request)
    supabase = services.supabase_client
    claims = supabase.auth.get_claims(credentials.credentials)
    if claims is None:
        raise HTTPException(status_code=401, detail="Invalid token: user not found")
    user_id = claims.get('claims').get('sub')
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token: user ID not found")
    return UUID(user_id)

current_user_id_dep = Depends(get_current_user_id)
type CurrentUserID = Annotated[UUID, current_user_id_dep]