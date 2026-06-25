import json
import os
import re
from pathlib import Path
from typing import Any

import httpx

DEFAULT_CLOUD_AI_URL = "https://ollama.com/v1/chat/completions"
DEFAULT_CLOUD_AI_MODEL = "minimax-m3:cloud"

FACILITATOR_SYSTEM_PROMPT = """Eres el agente Facilitador IA Friday.
Actuas como facilitador senior de workshops de innovacion con IA generativa para equipos corporativos.
Tu criterio combina balance de equipos, claridad de negocio, potencial de IA generativa, calidad de pitch,
aprendizaje del workshop y recomendaciones accionables.
Respondes en espanol claro, ejecutivo y practico. Evitas relleno, tecnicismos innecesarios y promesas exageradas.
Cuando se te pida JSON, devuelves solo JSON valido, sin markdown ni texto adicional."""


def load_dotenv() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_dotenv()


def first_env(*names: str) -> str:
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return ""


def get_cloud_config() -> tuple[str, str, str]:
    api_key = first_env("CLOUD_AI_API_KEY", "OLLAMA_API_KEY", "OPENAI_API_KEY")
    endpoint = first_env("CLOUD_AI_URL", "OLLAMA_CLOUD_URL", "OLLAMA_API_URL", "OPENAI_BASE_URL")
    model = first_env("CLOUD_AI_MODEL", "OLLAMA_MODEL", "OPENAI_MODEL") or DEFAULT_CLOUD_AI_MODEL

    if endpoint and endpoint.rstrip("/").endswith("/v1"):
        endpoint = endpoint.rstrip("/") + "/chat/completions"
    if api_key and not endpoint:
        endpoint = DEFAULT_CLOUD_AI_URL

    return endpoint, api_key, model


def normalize_cloud_url(endpoint: str) -> str:
    normalized = endpoint.strip().rstrip("/")
    if normalized.endswith("/api"):
        return normalized + "/generate"
    if normalized.endswith("/v1/chat/completions") or normalized.endswith("/chat/completions"):
        return normalized
    if normalized.endswith("/generate"):
        return normalized
    return normalized


def parse_cloud_response(data: Any, raw_text: str) -> dict[str, Any]:
    def _strip_code_fence(s: str) -> str:
        if not isinstance(s, str):
            return s
        text = s.strip()
        if text.startswith("```") and text.endswith("```"):
            inner = text[3:]
            if inner.startswith("json"):
                inner = inner[4:]
            if inner.startswith("\n"):
                inner = inner[1:]
            inner = inner.rstrip("`\n\r ")
            return inner.strip()
        return text

    def _extract_json_like(s: str) -> str | None:
        if not isinstance(s, str):
            return None
        match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", s, flags=re.S)
        if match:
            return match.group(1)
        start = s.find("{")
        end = s.rfind("}")
        if start != -1 and end != -1 and end > start:
            return s[start:end + 1]
        return None

    if isinstance(data, dict) and {"summary", "strengths", "recommendations"}.issubset(data.keys()):
        return data

    if isinstance(data, dict):
        if "choices" in data and isinstance(data["choices"], list) and data["choices"]:
            first_choice = data["choices"][0]
            if isinstance(first_choice, dict):
                message = first_choice.get("message")
                if isinstance(message, dict) and "content" in message:
                    content = message["content"]
                    try:
                        parsed = json.loads(_strip_code_fence(content))
                        if isinstance(parsed, dict):
                            return parsed
                    except json.JSONDecodeError:
                        inner = _extract_json_like(content) or _strip_code_fence(content)
                        if inner:
                            try:
                                parsed = json.loads(inner)
                                if isinstance(parsed, dict):
                                    return parsed
                            except json.JSONDecodeError:
                                pass
                    if isinstance(content, str):
                        return {"summary": content, "strengths": [], "recommendations": []}
                if "text" in first_choice and isinstance(first_choice["text"], str):
                    try:
                        parsed = json.loads(_strip_code_fence(first_choice["text"]))
                        if isinstance(parsed, dict):
                            return parsed
                    except json.JSONDecodeError:
                        inner = _extract_json_like(first_choice["text"]) or _strip_code_fence(first_choice["text"])
                        if inner:
                            try:
                                parsed = json.loads(inner)
                                if isinstance(parsed, dict):
                                    return parsed
                            except json.JSONDecodeError:
                                pass

        content = data.get("output") or data.get("text") or data.get("response") or data.get("output_text") or data.get("content")
        if isinstance(content, dict):
            if {"summary", "strengths", "recommendations"}.issubset(content.keys()):
                return content
            content = content.get("text", "")
        if isinstance(content, str) and content.strip():
            try:
                parsed = json.loads(_strip_code_fence(content))
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                inner = _extract_json_like(content) or _strip_code_fence(content)
                if inner:
                    try:
                        parsed = json.loads(inner)
                        if isinstance(parsed, dict):
                            return parsed
                    except json.JSONDecodeError:
                        pass

        result = data.get("result")
        if isinstance(result, list) and result:
            first = result[0]
            if isinstance(first, dict):
                return parse_cloud_response(first, raw_text)
            if isinstance(first, str):
                try:
                    parsed = json.loads(first)
                    if isinstance(parsed, dict):
                        return parsed
                except json.JSONDecodeError:
                    pass

    if isinstance(data, str):
        try:
            parsed = json.loads(_strip_code_fence(data))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            inner = _extract_json_like(data) or _strip_code_fence(data)
            if inner:
                try:
                    parsed = json.loads(inner)
                    if isinstance(parsed, dict):
                        return parsed
                except json.JSONDecodeError:
                    pass

    try:
        parsed = json.loads(_strip_code_fence(raw_text))
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        inner = _extract_json_like(raw_text) or _strip_code_fence(raw_text)
        if inner:
            try:
                parsed = json.loads(inner)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass

    raise ValueError("Could not parse cloud AI response into JSON")


def run_facilitator_json(prompt: str, *, temperature: float = 0.3) -> dict[str, Any]:
    endpoint, api_key, model = get_cloud_config()
    if not endpoint or not api_key:
        raise RuntimeError("Cloud AI is not configured")

    endpoint = normalize_cloud_url(endpoint)
    is_chat = endpoint.endswith("/v1/chat/completions") or endpoint.endswith("/chat/completions")
    if is_chat:
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": FACILITATOR_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
        }
    else:
        body = {
            "model": model,
            "prompt": f"{FACILITATOR_SYSTEM_PROMPT}\n\n{prompt}",
            "temperature": temperature,
            "stream": False,
        }

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    with httpx.Client(timeout=60.0, verify=False) as client:
        response = client.post(endpoint, json=body, headers=headers)
        response.raise_for_status()
        data = response.json()

    return parse_cloud_response(data, response.text)
