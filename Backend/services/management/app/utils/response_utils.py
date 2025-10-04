from fastapi.responses import JSONResponse
from typing import Any

def make_response(success: bool, message: str, data: Any = None, status_code: int = 200):
    """
    Unified response generator for both success and error cases.

    Args:
        success (bool): True for success, False for failure.
        message (str): Message string for the response.
        data (Any, optional): Optional payload or error details.
        status_code (int, optional): HTTP status code (default: 200).

    Returns:
        JSONResponse: formatted API response.
    """
    payload = {"success": success, "message": message}

    # Only include "data" if it's provided
    if data is not None:
        payload["data"] = data

    return JSONResponse(status_code=status_code, content=payload)
