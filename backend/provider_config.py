import os

DEFAULT_PROVIDER_BASE_URLS: dict[str, str] = {
    "openai": "https://api.openai.com/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/",
    "google": "https://generativelanguage.googleapis.com/v1beta/openai/",
    "moonshot": "https://api.moonshot.cn/v1",
    "deepseek": "https://api.deepseek.com/v1",
}

PROVIDER_BASE_URL_ENV_KEYS: dict[str, str] = {
    "openai": "OPENAI_BASE_URL",
    "gemini": "GEMINI_BASE_URL",
    "google": "GEMINI_BASE_URL",
    "moonshot": "MOONSHOT_BASE_URL",
    "deepseek": "DEEPSEEK_BASE_URL",
}


def normalize_provider_name(provider: str | None) -> str:
    return (provider or "").strip().lower()


def resolve_provider_base_url(provider: str | None) -> str | None:
    normalized_provider = normalize_provider_name(provider)
    if not normalized_provider:
        return None

    env_key = PROVIDER_BASE_URL_ENV_KEYS.get(normalized_provider)
    if env_key:
        configured_url = os.getenv(env_key, "").strip()
        if configured_url:
            return configured_url

    return DEFAULT_PROVIDER_BASE_URLS.get(normalized_provider)
