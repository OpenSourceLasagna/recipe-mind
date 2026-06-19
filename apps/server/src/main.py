import logging
import os
import sys
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

import nltk  # pyright: ignore[reportMissingTypeStubs]

from src.core.config import get_settings
from src.database.db import async_engine
from src.dependencies.clients import initialize_global_clients
from src.dependencies import clients as _clients_module
from src.middleware.rate_limit import _HealthReadyRateLimit
from src.middleware.request_id import (
    REQUEST_ID_HEADER,
    RequestIdMiddleware,
    get_request_id,
)
from src.middleware.security_headers import SecurityHeadersMiddleware
from src.observability.request_context import set_current_request
from src.routers import ai_chef, recipe_management, recipe_search, users
from src.schemas.health_check import LivenessResponse, ReadinessResponse

load_dotenv(override=False)


def _validate_production_config() -> None:
    if os.environ.get("ENV") == "production" and settings.debug:
        raise RuntimeError("DEBUG=true is not allowed in production. Set DEBUG=false.")


_validate_production_config()

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
        nltk.download("wordnet")  # type: ignore
        logger.info("nltk Wordnet initalized successfully")
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise

    logger.info("Recipe Mind API started successfully")
    yield
    logger.info("Recipe Mind API is shutting down")


_ALLOWED_CORS_METHODS = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
_ALLOWED_CORS_HEADERS = [
    "Authorization",
    "Content-Type",
    "X-Requested-With",
    "X-Request-Id",
]


def _validate_cors_origins(cors_origins: set[str]) -> None:
    if "*" in cors_origins:
        raise ValueError(
            "CORS_ORIGINS='*' is not allowed with allow_credentials=True. "
            "Specify explicit origins."
        )


_validate_cors_origins(settings.cors_origins)

_docs_enabled = os.environ.get("ENV", "development") != "production"

app = FastAPI(
    title="Recipe Mind API",
    description="RAG-powered recipe search backend with vector embeddings",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(settings.trusted_hosts))
app.add_middleware(RequestIdMiddleware)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    set_current_request(request)
    try:
        return await call_next(request)
    finally:
        set_current_request(None)


app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=_ALLOWED_CORS_METHODS,
    allow_headers=_ALLOWED_CORS_HEADERS,
)

app.include_router(users.router_v1)
app.include_router(recipe_management.router_v1)
app.include_router(recipe_search.router_v1)
app.include_router(ai_chef.router_v1)


async def _check_database() -> str:
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return "healthy"
    except Exception as e:
        logger.warning("health.database_check_failed: %s", type(e).__name__)
        return "unhealthy"


def _check_openai() -> str:
    return (
        "healthy"
        if getattr(_clients_module, "openai_client", None) is not None
        else "unhealthy"
    )


def _check_supabase() -> str:
    return (
        "healthy"
        if getattr(_clients_module, "supabase_client", None) is not None
        else "unhealthy"
    )


@app.get("/health/live", response_model=LivenessResponse)
async def liveness() -> LivenessResponse:
    return LivenessResponse()


@app.get(
    "/health/ready",
    response_model=ReadinessResponse,
    dependencies=[_HealthReadyRateLimit],
)
async def readiness(response: Response) -> ReadinessResponse:
    database = await _check_database()
    ai = _check_openai()
    supabase = _check_supabase()

    all_healthy = database == ai == supabase == "healthy"
    response.status_code = (
        status.HTTP_200_OK if all_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
    )

    return ReadinessResponse(
        status="ready" if all_healthy else "not_ready",
        database=database,  # type: ignore[arg-type]
        ai=ai,  # type: ignore[arg-type]
        supabase=supabase,  # type: ignore[arg-type]
    )


@app.get("/health")
async def health_alias(response: Response) -> ReadinessResponse:
    return await readiness(response)


@app.get("/")
async def root():
    return {
        "name": "Recipe Mind API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": {
            "live": "/health/live",
            "ready": "/health/ready",
        },
    }


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions."""
    request_id = get_request_id(request) or "-"
    logger.warning(
        "http_exception status=%s path=%s request_id=%s category=%s",
        exc.status_code,
        request.url.path,
        request_id,
        exc.__class__.__name__,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={REQUEST_ID_HEADER: request_id} if request_id != "-" else {},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors without leaking request bodies."""
    request_id = get_request_id(request) or "-"
    logger.warning(
        "validation_error path=%s request_id=%s error_count=%s",
        request.url.path,
        request_id,
        len(exc.errors()),
    )
    return JSONResponse(
        status_code=422,
        content={"detail": "Invalid request"},
        headers={REQUEST_ID_HEADER: request_id} if request_id != "-" else {},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    request_id = get_request_id(request) or "-"
    logger.error(
        "unhandled_exception path=%s request_id=%s exc_type=%s",
        request.url.path,
        request_id,
        type(exc).__name__,
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
        headers={REQUEST_ID_HEADER: request_id} if request_id != "-" else {},
    )
