from typing import Annotated

from fastapi import Depends

from src.core.config import get_settings
from src.schemas.settings import Settings


EnvSettings = Annotated[Settings, Depends(get_settings)]