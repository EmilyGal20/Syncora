from app.system_notifications import normalize_system_notifications, should_deliver


def test_policy_defaults_every_type_on():
    policy = normalize_system_notifications(None)
    assert policy["audience"] == "organization"
    assert policy["target_ids"] == []
    assert policy["types"]["task.assigned"] is True
    assert policy["types"]["booking.rejected"] is True


def test_policy_keeps_known_types_only():
    policy = normalize_system_notifications({"types": {"task.assigned": False, "other": False}, "audience": "roles", "target_ids": ["role-1", 3]})
    assert policy["types"]["task.assigned"] is False
    assert policy["types"]["booking.created"] is True
    assert "other" not in policy["types"]
    assert policy["audience"] == "roles"
    assert policy["target_ids"] == ["role-1"]


def test_delivery_requires_receive_and_enabled():
    policy = normalize_system_notifications(None)
    assert should_deliver({"system_notifications.receive"}, "user", set(), policy) is False
    assert should_deliver({"system_notifications.receive", "system_notifications.enabled"}, "user", set(), policy) is True


def test_delivery_respects_selected_people():
    roles = normalize_system_notifications({"audience": "roles", "target_ids": ["role-1"]})
    users = normalize_system_notifications({"audience": "users", "target_ids": ["user-1"]})
    codes = {"system_notifications.receive", "system_notifications.enabled"}
    assert should_deliver(codes, "user-2", {"role-1"}, roles) is True
    assert should_deliver(codes, "user-2", {"role-2"}, roles) is False
    assert should_deliver(codes, "user-1", set(), users) is True
    assert should_deliver(codes, "user-2", set(), users) is False
