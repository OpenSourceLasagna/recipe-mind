
from fastapi import APIRouter
from ..dependencies.auth import CurrentUserID, current_user_id_dep


router = APIRouter(prefix="/search", tags=["search"], dependencies=[current_user_id_dep])

@router.get("/")
def search_recipes(current_user_id: CurrentUserID):
    return {"message": "Search for recipes"}
