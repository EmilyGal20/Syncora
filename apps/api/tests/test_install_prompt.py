from app.install_prompt import normalize_install_prompt


def test_install_prompt_defaults():
    assert normalize_install_prompt(None) == {"navbar": True, "notice": True, "message": ""}


def test_install_prompt_clamps_message():
    result = normalize_install_prompt({"navbar": False, "notice": True, "message": "x" * 500})
    assert result["navbar"] is False
    assert result["notice"] is True
    assert len(result["message"]) == 400
