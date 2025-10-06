# app/utils/response_utils.py
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from typing import Any

def make_response(
    success: bool,
    message: str,
    data: Any = None,
    next_action: str | None = None,
    status_code: int = 200,
):
    """
    Unified response with optional next_action.
    """
    payload = {"success": success, "message": message}
    if data is not None:
        payload["data"] = data
    if next_action is not None:          # <-- only include when provided
        payload["next_action"] = next_action
    return JSONResponse(status_code=status_code, content=jsonable_encoder(payload))
