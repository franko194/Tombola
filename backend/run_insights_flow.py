import os
import sys
import httpx
import json

BASE = os.environ.get('BASE_URL') or 'http://127.0.0.1:8001'
SESSION_ID = int(os.environ.get('SESSION_ID') or 1)
NUM_TEAMS = int(os.environ.get('NUM_TEAMS') or 2)

print('Using base URL:', BASE)
print('Session id:', SESSION_ID)

client = httpx.Client(timeout=20.0)

# 1) Check teams
teams_url = f"{BASE}/sessions/{SESSION_ID}/teams"
print('\n1) GET', teams_url)
resp = client.get(teams_url)
if resp.status_code == 404:
    print('Session not found (404). Create a session first or use a different SESSION_ID.')
    sys.exit(2)
if resp.status_code != 200:
    print('Failed to get teams:', resp.status_code, resp.text)
    sys.exit(3)

teams = resp.json()
print('Teams response:', json.dumps(teams, indent=2, ensure_ascii=False)[:1000])
if not teams.get('teams'):
    print('\nNo teams present — generating', NUM_TEAMS, 'teams')
    gen_url = f"{BASE}/sessions/{SESSION_ID}/teams/generate"
    r2 = client.post(gen_url, json={"number_of_teams": NUM_TEAMS})
    if r2.status_code != 200:
        print('Failed to generate teams:', r2.status_code, r2.text)
        sys.exit(4)
    teams = r2.json()
    print('Generated teams:', json.dumps(teams, indent=2, ensure_ascii=False)[:1000])
else:
    print('\nTeams already exist, skipping generation.')

# 2) Request insights
insights_url = f"{BASE}/sessions/{SESSION_ID}/teams/insights"
print('\n2) POST', insights_url)
r3 = client.post(insights_url)
print('Status:', r3.status_code)
try:
    body = r3.json()
    print('AI response JSON:', json.dumps(body, indent=2, ensure_ascii=False))
except Exception:
    print('AI response text:', r3.text)
    sys.exit(5)

print('\nDone')
