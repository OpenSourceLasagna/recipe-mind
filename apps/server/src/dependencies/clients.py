from typing import Annotated

from fastapi import Depends
from openai import AsyncOpenAI
from supabase import Client, create_client

from src.core.config import get_settings


def initialize_global_clients():
    global supabase_client, openai_client

    settings = get_settings()

    supabase_client = create_client(settings.supabase_url, settings.supabase_key)

    openai_client = AsyncOpenAI(api_key=settings.openai_api_key)


def get_openai_client() -> AsyncOpenAI:
    if openai_client is None:  # type: ignore
        raise RuntimeError("OpenAI client was accessed before initialization!")
    return openai_client


def get_supabase_client() -> Client:
    if supabase_client is None:  # type: ignore
        raise RuntimeError("Supabase client was accessed before initialization!")
    return supabase_client


OpenAIClient = Annotated[AsyncOpenAI, Depends(get_openai_client)]
SupabaseClient = Annotated[Client, Depends(get_supabase_client)]
