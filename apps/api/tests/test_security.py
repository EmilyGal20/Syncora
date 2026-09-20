from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.dependencies import assert_tenant, permission_codes
from app.security import create_access_token, decode_access_token, hash_password, verify_password


def test_passwords_are_hashed_and_verified():
    encoded = hash_password("CorrectHorseBatteryStaple!")
    assert "CorrectHorseBatteryStaple!" not in encoded
    assert verify_password("CorrectHorseBatteryStaple!", encoded)
    assert not verify_password("incorrect", encoded)


def test_access_token_carries_tenant_boundary():
    token = create_access_token("user-a", "org-a")
    claims = decode_access_token(token)
    assert claims["sub"] == "user-a"
    assert claims["org"] == "org-a"


def test_tenant_mismatch_is_hidden_as_not_found():
    with pytest.raises(HTTPException) as error:
        assert_tenant("org-b", SimpleNamespace(organization_id="org-a", is_platform_admin=False))
    assert error.value.status_code == 404


def test_permissions_are_aggregated_across_roles():
    user = SimpleNamespace(roles=[SimpleNamespace(permissions=[SimpleNamespace(code="users.view")]), SimpleNamespace(permissions=[SimpleNamespace(code="tasks.view")])])
    assert permission_codes(user) == {"users.view", "tasks.view"}

