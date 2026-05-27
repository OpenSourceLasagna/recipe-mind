
from fastapi import APIRouter
from ..dependencies.auth import CurrentUserID, current_user_id_dep  

router = APIRouter(prefix="/users", tags=["users"], dependencies=[current_user_id_dep])

@router.get("/")
def get_current_user_profile(current_user_id: CurrentUserID):
    return {"message": "Current user information"}

@router.get("/{user_id}")
def get_user_profile(user_id: str, current_user_id: CurrentUserID):
    # TODO encrypt / decrypt user_id
    return {"message": f"User information for ID: {user_id}"}

@router.put("/")
def update_user_profile(user_id: str, updated_data: dict[str, str], current_user_id: CurrentUserID):
    return {"message": f"User information updated for ID: {user_id}"}