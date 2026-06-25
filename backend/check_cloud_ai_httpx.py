import httpx
import os

url = os.environ.get("CLOUD_AI_URL")
api_key = os.environ.get("CLOUD_AI_API_KEY")
model = os.environ.get("CLOUD_AI_MODEL", "minimax-m3:cloud")
if not url or not api_key:
    raise SystemExit("Missing CLOUD_AI_URL or CLOUD_AI_API_KEY")

headers = {
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json',
}
payload = {
    'model': model,
    'messages': [{'role': 'user', 'content': 'Actua como facilitador senior de workshops de innovacion con IA y responde solo con un JSON de prueba'}],
    'temperature': 0.3,
}

print('Endpoint:', url)
print('Request body:', payload)
try:
    response = httpx.post(url, json=payload, headers=headers, timeout=30.0, verify=False)
    print('Status:', response.status_code)
    print('Response text:', response.text[:1000])
except Exception as error:
    print('Request failed:', type(error).__name__, error)
