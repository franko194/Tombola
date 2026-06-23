import os
from pathlib import Path
import json
import httpx

# Load backend/.env manually if present
env_path = Path(__file__).resolve().parent / '.env'
if env_path.exists():
    for line in env_path.read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.strip().startswith('#'):
            key, value = line.split('=', 1)
            os.environ.setdefault(key.strip(), value.strip())

url = os.environ.get('CLOUD_AI_URL')
api_key = os.environ.get('CLOUD_AI_API_KEY')
model = os.environ.get('CLOUD_AI_MODEL', 'minimax-m3:cloud')

if not url or not api_key:
    raise SystemExit('Missing CLOUD_AI_URL or CLOUD_AI_API_KEY in backend/.env')

payload = {
    'model': model,
    'messages': [
        {
            'role': 'user',
            'content': 'Actua como facilitador senior de workshops de innovacion con IA y responde solo con un JSON de prueba',
        }
    ],
    'temperature': 0.3,
}
headers = {
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json',
}

print('URL:', url)
print('MODEL:', model)
print('Using verify=False for SSL check')

try:
    response = httpx.post(url, json=payload, headers=headers, timeout=30.0, verify=False)
    print('Status code:', response.status_code)
    print('Response body:', response.text[:1200])
except Exception as exc:
    print('Request failed:', type(exc).__name__, exc)
