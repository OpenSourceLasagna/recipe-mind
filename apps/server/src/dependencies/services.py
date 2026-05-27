from typing import Annotated

from fastapi import Depends, Request

from src.schemas.app_services import AppServices

def get_app_services(request: Request) -> AppServices:
    return request.app.state.services

Services = Annotated[AppServices, Depends(get_app_services)]