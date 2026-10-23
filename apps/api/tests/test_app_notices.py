from types import SimpleNamespace

from app.app_notices import notice_visible


def test_organization_notice_requires_permission_in_same_workspace():
    notice = SimpleNamespace(enabled=True, audience="organization", organization_id="org-1", target_ids=[])
    member = SimpleNamespace(id="u1", organization_id="org-1")
    outsider = SimpleNamespace(id="u2", organization_id="org-2")
    assert notice_visible(notice, member, True) is True
    assert notice_visible(notice, member, False) is False
    assert notice_visible(notice, outsider, True) is False


def test_user_notice_targets_selected_people():
    notice = SimpleNamespace(enabled=True, audience="users", organization_id="org-1", target_ids=["u1"])
    assert notice_visible(notice, SimpleNamespace(id="u1", organization_id="org-1"), False) is True
    assert notice_visible(notice, SimpleNamespace(id="u2", organization_id="org-1"), True) is False


def test_organization_list_notice_targets_selected_workspaces():
    notice = SimpleNamespace(enabled=True, audience="organizations", organization_id="org-1", target_ids=["org-2"])
    assert notice_visible(notice, SimpleNamespace(id="u1", organization_id="org-2"), True) is True
    assert notice_visible(notice, SimpleNamespace(id="u1", organization_id="org-2"), False) is False
    assert notice_visible(notice, SimpleNamespace(id="u1", organization_id="org-1"), True) is False
