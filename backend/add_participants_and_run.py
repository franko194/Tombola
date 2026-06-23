import httpx
import subprocess
import json

BASE = 'http://127.0.0.1:8001'
client = httpx.Client(timeout=10.0)

participants = [
    {"name": "Alice", "ai_level": 3},
    {"name": "Bob", "ai_level": 2},
]

for p in participants:
    r = client.post(f"{BASE}/sessions/1/participants", json=p)
    print('POST /participants', r.status_code, r.text)

print('\nNow running run_insights_flow.py')
subprocess.run(['python', 'run_insights_flow.py'])
