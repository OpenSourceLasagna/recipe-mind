
from fastapi import APIRouter

from ..dependencies.auth import CurrentUserID, current_user_id_dep


router = APIRouter(prefix="/recipes", tags=["recipes"], dependencies=[current_user_id_dep])

@router.post("/", tags=["recipes"])
def create_recipe(current_user_id: CurrentUserID):
    return {"message": "Recipe created successfully"}

@router.get("/{recipe_id}", tags=["recipes"])
def get_recipe(recipe_id: str, current_user_id: CurrentUserID):
    return {"message": f"Recipe information for ID: {recipe_id}"}

@router.put("/{recipe_id}", tags=["recipes"])
def update_recipe(recipe_id: str, current_user_id: CurrentUserID):
    return {"message": f"Recipe with ID: {recipe_id} updated successfully"}

@router.delete("/{recipe_id}", tags=["recipes"])
def delete_recipe(recipe_id: str, current_user_id: CurrentUserID):
    return {"message": f"Recipe with ID: {recipe_id} deleted successfully"}
