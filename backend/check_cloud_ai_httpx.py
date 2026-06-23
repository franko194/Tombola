import httpx

url = 'https://ollama.com/v1/chat/completions'
headers = {
    'Authorization': 'Bearer tu_api_key_de_ia_aqui',
    'Content-Type': 'application/json',
}
payload = {
    'model': 'minimax-m3:cloud',
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
