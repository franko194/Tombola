import os
from pathlib import Path
import json
import httpx
import certifi

# load .env from repository root (backend/.env)
env_path = Path(__file__).resolve().parent / '.env'
if env_path.exists():
    for raw in env_path.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        k = k.strip(); v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v

url = os.environ.get('CLOUD_AI_URL')
api_key = os.environ.get('CLOUD_AI_API_KEY')
model = os.environ.get('CLOUD_AI_MODEL', 'minimax-m3:cloud')

print('URL:', url)
print('MODEL:', model)
print('Using certifi bundle:', certifi.where())

if not url or not api_key:
    print('Missing CLOUD_AI_URL or CLOUD_AI_API_KEY')
    raise SystemExit(1)

is_chat = url.endswith('/v1/chat/completions') or url.endswith('/chat/completions')
if is_chat:
    body = {
        'model': model,
        'messages': [{'role': 'user', 'content': 'Hola'}],
        'temperature': 0.3,
    }
else:
    body = {
        'model': model,
        'prompt': 'Hola',
        'temperature': 0.3,
    }

headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}

try:
    resp = httpx.post(url, json=body, headers=headers, timeout=30.0, verify=certifi.where())
    print('Status:', resp.status_code)
    print('Text:', resp.text[:4000])
except Exception as e:
    print('Error:', type(e).__name__, e)
    raise
