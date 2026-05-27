from supabase import Client
from openai import OpenAI

class AppServices():
    def __init__(self, supabase_client: Client, openai_client: OpenAI):
        self.supabase_client = supabase_client
        self.openai_client = openai_client