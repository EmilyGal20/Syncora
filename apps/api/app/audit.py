import logging

import httpx

from .config import get_settings
from .models import User

logger = logging.getLogger(__name__)


async def record_audit(user: User, action: str, entity: str, entity_id: str, metadata: dict | None = None) -> None:
    settings = get_settings()
    payload = {
        "organizationId": user.organization_id,
        "actorId": user.id,
        "action": action,
        "entity": entity,
        "entityId": entity_id,
        "metadata": metadata or {},
    }
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            response = await client.post(
                f"{settings.audit_service_url}/internal/audit",
                json=payload,
                headers={"X-Service-Key": settings.audit_service_key},
            )
            response.raise_for_status()
    except httpx.HTTPError:
        logger.warning("Audit service unavailable for %s", action)
