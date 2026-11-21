"""Tests for the websocket side of the remote card."""

import pytest
import voluptuous as vol

from custom_components.tuya_selfhost.remote_card import _code


def test_saved_codes_must_be_ir_or_rf():
    assert _code("9QspBgAC") == "9QspBgAC"
    assert _code("rf:anything") == "rf:anything"
    with pytest.raises(vol.Invalid):
        _code("not base64!")
