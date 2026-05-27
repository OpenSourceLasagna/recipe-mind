import logging
import sys
from fastapi import FastAPI, HTTPException, status
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import Request
from fastapi import HTTPException
from postgrest import CountMethod
from supabase import create_client
from supabase.client import PostgrestAPIError
from openai import OpenAI

from src.dependencies.services import Services

from src.routers import recipe_management, recipe_search, users
from src.core.config import get_settings
from src.schemas.app_services import AppServices
from src.schemas.health_check import HealthCheckResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize critical services on startup and perform cleanup on shutdown."""
    logger.info("Starting Recipe Mind API...")
    try:
        supabase = create_client(settings.supabase_url, settings.supabase_key)
        openai_client = None # OpenAI(api_key=settings.openai_api_key)
        # openai_client.models.list()
        app.state.services = AppServices(supabase_client=supabase, openai_client=openai_client) 
        logger.info("Services initialized successfully")
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise

    logger.info("Recipe Mind API started successfully")
    yield
    logger.info("Recipe Mind API is shutting down")
    

app = FastAPI(
    title="Recipe Mind API",
    description="RAG-powered recipe search backend with vector embeddings",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(recipe_management.router)
app.include_router(recipe_search.router)


@app.get("/health", response_model=HealthCheckResponse)
async def health_check(services: Services):
    """Perform health checks on critical services."""
    supabase_status = "healthy"
    openai_status = "healthy"

    try:
        if not hasattr(services, "supabase_client"):
            supabase_status = "disconnected"
        services.supabase_client.postgrest.from_table("recipes").select("*").limit(1).execute()
    except PostgrestAPIError as e:
        permission_denied_code = "42501"
        if not e.code == permission_denied_code:
            logger.warning(f"Supabase health check failed: {e}")
            supabase_status = "unhealthy"
    except Exception as e:
        logger.warning(f"Supabase health check failed: {e}")
        supabase_status = "unhealthy"

    try:
        if not hasattr(services, "openai_client"):
            openai_status = "disconnected"
        else:
            services.openai_client.models.list()
    except Exception as e:
        logger.warning(f"OpenAI health check failed: {e}")
        openai_status = "unhealthy"

    overall_status = "healthy" if supabase_status == "healthy" and openai_status == "healthy" else "degraded"

    return HealthCheckResponse(
        status=overall_status,
        base_provider=supabase_status == "healthy",
        ai=openai_status == "healthy"
    )


# Root endpoint
@app.get("/")
async def root():
    return {
        "name": "Recipe Mind API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }

from fastapi import Request

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions."""
    logger.warning(f"HTTPException: {exc.detail} (status_code={exc.status_code}) - Path: {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.error(f"Unexpected error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )

