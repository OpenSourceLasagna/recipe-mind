import logging
import sys
from fastapi import FastAPI, HTTPException, status
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import Request
from fastapi import HTTPException
from supabase.client import PostgrestAPIError
import nltk
from dotenv import load_dotenv

from src import models # pyright: ignore[reportUnusedImport]
from src.dependencies.clients import OpenAIClient, SupabaseClient, initialize_global_clients
from src.routers import recipe_management, recipe_search, users
from src.core.config import get_settings
from src.schemas.health_check import HealthCheckResponse

load_dotenv(override=True)

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
        initialize_global_clients()
        logger.info("Services initialized successfully")
        nltk.download('wordnet') # type: ignore    
        logger.info('nltk Wordnet initalized successfully')
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

app.include_router(users.router_v1)
app.include_router(recipe_management.router_v1)
app.include_router(recipe_search.router_v1)


@app.get("/health", response_model=HealthCheckResponse)
async def health_check(supabase_client: SupabaseClient, openai_client: OpenAIClient):
    """Perform health checks on critical services."""
    supabase_status = "healthy"
    openai_status = "healthy"

    try:
        if supabase_client is None: # type: ignore
            supabase_status = "disconnected"
        supabase_client.postgrest.from_table("recipes").select("*").limit(1).execute()
    except PostgrestAPIError as e:
        permission_denied_code = "42501"
        if not e.code == permission_denied_code:
            logger.warning(f"Supabase health check failed: {e}")
            supabase_status = "unhealthy"
    except Exception as e:
        logger.warning(f"Supabase health check failed: {e}")
        supabase_status = "unhealthy"

    try:
        if openai_client is None: # type: ignore
            openai_status = "disconnected"
        else:
            openai_client.models.list()
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

