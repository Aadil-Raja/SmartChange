"""
Timing middleware to measure API response times.
"""
import time
import sys
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class DetailedTimingMiddleware(BaseHTTPMiddleware):
    """
    Enhanced timing middleware with detailed metrics.
    
    Adds response headers:
    - X-Process-Time: Total time in seconds
    - X-Process-Time-Ms: Total time in milliseconds
    
    Prints detailed timing to terminal for specific endpoints.
    """
    
    # Endpoints to track in detail
    TRACKED_ENDPOINTS = [
        "/chat/respond-v2",
        "/chat/respond",
    ]
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Get request details
        method = request.method
        path = request.url.path
        is_tracked = any(endpoint in path for endpoint in self.TRACKED_ENDPOINTS)
        
        # Process request
        response = await call_next(request)
        
        # Calculate time
        process_time = time.time() - start_time
        process_time_ms = process_time * 1000
        
        # Add headers
        response.headers["X-Process-Time"] = f"{process_time:.3f}"
        response.headers["X-Process-Time-Ms"] = f"{process_time_ms:.0f}"
        
        # Detailed logging for tracked endpoints
        if is_tracked:
            # Color code based on response time
            if process_time < 1.0:
                level = "🟢"  # Fast
                color_name = "FAST"
            elif process_time < 3.0:
                level = "🟡"  # Medium
                color_name = "MEDIUM"
            else:
                level = "🔴"  # Slow
                color_name = "SLOW"
            
            # Print to terminal (stderr)
            print(f"\n{'='*80}", file=sys.stderr)
            print(f"{level} [TIMING - {color_name}]", file=sys.stderr)
            print(f"  Endpoint: {method} {path}", file=sys.stderr)
            print(f"  Status: {response.status_code}", file=sys.stderr)
            print(f"  Time: {process_time:.3f}s ({process_time_ms:.0f}ms)", file=sys.stderr)
            print(f"{'='*80}\n", file=sys.stderr)
        
        return response
