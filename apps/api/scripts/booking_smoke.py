import datetime
import json
import urllib.error
import urllib.request
from datetime import timedelta, timezone

base = "http://127.0.0.1:8500/api/v1"


def req(method, path, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    body = None if data is None else json.dumps(data).encode()
    request = urllib.request.Request(base + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as response:
            raw = response.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        print("ERROR", method, path, exc.read().decode())
        raise


def main():
    login = req("POST", "/auth/login", {"identifier": "admin", "password": "ChangeMe123!"})
    token = login["access_token"]
    links = req("GET", "/booking-links", token=token)
    print("LINKS", json.dumps(links, default=str)[:900])
    slug = links["personal"][0]["slug"]
    start = (datetime.datetime.now(timezone.utc) + timedelta(days=1)).replace(minute=0, second=0, microsecond=0)
    end = start + timedelta(hours=1)
    created = req(
        "POST",
        f"/public/booking-links/{slug}/requests",
        {
            "guest_name": "Dana Guest",
            "guest_organization": "Acme",
            "guest_email": "dana@example.com",
            "guest_phone": "+15551212",
            "reason": "Project kickoff",
            "notes": "Need 60 minutes",
            "starts_at": start.isoformat(),
            "ends_at": end.isoformat(),
            "timezone": "UTC",
        },
    )
    print("CREATED", created)
    status = req("GET", f"/public/bookings/{created['guest_token']}")
    print("STATUS", status["status"], status["guest_name"])
    bookings = req("GET", "/bookings?status=pending", token=token)
    print("PENDING", len(bookings), bookings[0]["id"])
    approved = req("POST", f"/bookings/{bookings[0]['id']}/approve", {}, token=token)
    print("APPROVED", approved["status"], approved["event_id"])
    events = req("GET", "/events", token=token)
    match = next(event for event in events if event.get("id") == approved["event_id"])
    print("EVENT", match["title"], match["event_type"])
    rejected = req(
        "POST",
        f"/public/booking-links/{slug}/requests",
        {
            "guest_name": "Rejected Guest",
            "guest_organization": "North",
            "guest_email": "reject@example.com",
            "guest_phone": "+15550000",
            "reason": "Overflow",
            "notes": "",
            "starts_at": (start + timedelta(hours=3)).isoformat(),
            "ends_at": (start + timedelta(hours=4)).isoformat(),
            "timezone": "UTC",
        },
    )
    pending = req("GET", "/bookings?status=pending", token=token)
    declined = req("POST", f"/bookings/{pending[0]['id']}/reject", {"reason": "Calendar conflict"}, token=token)
    guest = req("GET", f"/public/bookings/{rejected['guest_token']}")
    print("REJECTED", declined["status"], guest["status"], guest["rejection_reason"])


if __name__ == "__main__":
    main()
