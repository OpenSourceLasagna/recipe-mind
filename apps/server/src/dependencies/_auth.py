from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

from src.core.config import get_settings

security = HTTPBearer()

supabase_jwt = get_settings().supabase_jwt_secret

supabase_audience = "authenticated"

def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            supabase_jwt,
            algorithms=["ES256"],
            audience=supabase_audience
        )
        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token: user ID not found")
        
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token validation error: {str(e)}")
    

current_user_id_dep = Depends(get_current_user_id)
CurrentUserID = Annotated[str, current_user_id_dep]