from fastapi import APIRouter, HTTPException, Request

from ..dependencies.auth import CurrentUserID, current_user_id_dep
from ..observability import audit
from ..schemas.user import UpdateUserRequest

router_v1 = APIRouter(
    prefix="/v1/users", tags=["v1", "users"], dependencies=[current_user_id_dep]
)


@router_v1.get("/")
def get_current_user_profile(current_user_id: CurrentUserID):
    return {"message": "Current user information"}


@router_v1.get("/{user_id}")
def get_user_profile(
    request: Request,
    user_id: str,
    current_user_id: CurrentUserID,
):
    if str(current_user_id) != user_id:
        audit.authz_denied(
            request,
            resource="user",
            owner_id=str(current_user_id),
        )
        raise HTTPException(
            status_code=403, detail="Not authorized to access this user"
        )
    return {"message": f"User information for ID: {user_id}"}


@router_v1.put("/")
def update_user_profile(
    updated_data: UpdateUserRequest,
    current_user_id: CurrentUserID,
):
    return {"message": f"User information updated for ID: {current_user_id}"}
