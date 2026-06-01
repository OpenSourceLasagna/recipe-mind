
from fastapi import APIRouter
from ..dependencies.auth import CurrentUserID, current_user_id_dep


router_v1 = APIRouter(prefix="/v1/search", tags=["v1", "search"], dependencies=[current_user_id_dep])

@router_v1.get("/")
def search_recipes(current_user_id: CurrentUserID):
    return {"message": "Search for recipes"}
