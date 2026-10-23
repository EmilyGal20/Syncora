from fastapi import Request
from starlette.datastructures import Headers

from app.origin import public_app_origin


def _request(headers: dict[str, str]) -> Request:
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "headers": Headers(headers).raw,
        "client": ("127.0.0.1", 123),
        "server": ("127.0.0.1", 8500),
    }
    return Request(scope)


def test_origin_header_wins_over_localhost_settings():
    request = _request({"origin": "http://192.168.1.20:8600"})
    assert public_app_origin(request) == "http://192.168.1.20:8600"


def test_api_port_is_rewritten_to_app_port():
    request = _request({"host": "10.0.0.8:8500"})
    assert public_app_origin(request) == "http://10.0.0.8:8600"


def test_phone_lan_origin_keeps_app_port():
    request = _request({"origin": "http://192.168.1.20:8765"})
    assert public_app_origin(request) == "http://192.168.1.20:8765"
