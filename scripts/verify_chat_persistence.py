import urllib.request
import urllib.error
import json
import time

def post_json(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'User-Agent': 'ORCA-Verification'}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.status, json.loads(resp.read().decode())

def get_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'ORCA-Verification'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def run_chat_test(title, message_text):
    print("\n======================================================")
    print(f"=== {title} ===")
    print("======================================================")
    status, chat_resp = post_json('http://localhost:4000/api/v1/chat/message', {
        'message': message_text
    })
    conv_id = chat_resp.get('conversation_id')
    aid = chat_resp.get('triggered_analysis_id')
    print(f"POST /api/v1/chat/message -> status: {status}")
    print("Initial Chat Response:")
    print(json.dumps(chat_resp, indent=2))

    print(f"\nWaiting for analysis {aid} to complete...")
    for _ in range(30):
        time.sleep(2)
        st, a_data = get_json(f"http://localhost:4000/api/v1/analysis/{aid}")
        curr_status = a_data.get('status')
        if curr_status in ['completed', 'failed']:
            print(f"Analysis {aid} finished with status: {curr_status} (HTTP {st})")
            print("Analysis Result JSON:")
            print(json.dumps(a_data, indent=2))
            break

    # Check GET /api/v1/chat/:id
    c_st, conv = get_json(f"http://localhost:4000/api/v1/chat/{conv_id}")
    print(f"\nGET /api/v1/chat/{conv_id} -> HTTP {c_st}")
    print("Conversation Messages count:", len(conv.get('messages', [])))
    for idx, m in enumerate(conv.get('messages', [])):
        print(f"  [{idx}] role: {m.get('role')} | content: {m.get('content')}")

    # Check GET /api/v1/chat/:id/history
    h_st, hist = get_json(f"http://localhost:4000/api/v1/chat/{conv_id}/history")
    print(f"\nGET /api/v1/chat/{conv_id}/history -> HTTP {h_st}")
    print(json.dumps(hist, indent=2))


if __name__ == "__main__":
    # Test A: No-place query
    run_chat_test("TEST A: No-Place Chat Query", "how high can waves get in a cyclone?")

    # Test B: Inland Chat Query (Nagpur)
    run_chat_test("TEST B: Inland Chat Query (Nagpur)", "Can I take a boat out in Nagpur?")

    # Test C: Normal Place Chat Query (Kochi)
    run_chat_test("TEST C: Normal Place Chat Query (Kochi)", "Can I go fishing in Kochi today?")
