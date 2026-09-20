from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.dependencies import access_scope, assert_tenant, permission_codes
from app.routers.phase2 import task_visible
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


def test_direct_deny_overrides_role_scope():
    permission = SimpleNamespace(code="tasks.view")
    user = SimpleNamespace(is_platform_admin=False, roles=[], _access_grants=[SimpleNamespace(permission=permission, principal_type="role", effect="allow", scope="TEAM"), SimpleNamespace(permission=permission, principal_type="user", effect="deny", scope="OWN")])
    assert access_scope(user, "tasks.view") is None


def test_task_visibility_enforces_owner_and_tenant():
    user = SimpleNamespace(id="user-a", organization_id="org-a", team_id="team-a", department_id="dept-a")
    own = SimpleNamespace(organization_id="org-a", assignee_id="user-a", creator_id="other", team_id=None, department_id=None)
    other = SimpleNamespace(organization_id="org-a", assignee_id="user-b", creator_id="user-b", team_id="team-b", department_id="dept-b")
    foreign = SimpleNamespace(organization_id="org-b", assignee_id="user-a", creator_id="user-a", team_id="team-a", department_id="dept-a")
    assert task_visible(own, user, "OWN")
    assert not task_visible(other, user, "OWN")
    assert not task_visible(foreign, user, "ORGANIZATION")
