import httpx

def check(url, name):
    try:
        r = httpx.get(url, timeout=5)
        print(f"{name} -> status: {r.status_code}")
        text = r.text
        if len(text) > 400:
            text = text[:400] + '...'
        print(text)
    except Exception as e:
        print(f"{name} -> ERROR: {type(e).__name__} {e}")

if __name__ == '__main__':
    check('http://127.0.0.1:8001/health', 'BACKEND /health')
    check('http://127.0.0.1:5173/', 'FRONTEND /')
