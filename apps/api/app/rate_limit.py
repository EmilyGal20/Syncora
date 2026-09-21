from collections import defaultdict, deque
from time import monotonic

from fastapi import HTTPException, Request


class SlidingWindowLimiter:
    def __init__(self):
        self._attempts: dict[str, deque[float]] = defaultdict(deque)

    def check(self, request: Request, bucket: str, limit: int, window_seconds: int) -> None:
        address = request.client.host if request.client else "unknown"
        key = f"{bucket}:{address}"
        now = monotonic()
        attempts = self._attempts[key]
        while attempts and attempts[0] <= now - window_seconds:
            attempts.popleft()
        if len(attempts) >= limit:
            raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
        attempts.append(now)


public_limiter = SlidingWindowLimiter()
