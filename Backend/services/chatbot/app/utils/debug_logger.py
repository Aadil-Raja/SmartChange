# app/utils/debug_logger.py
"""
Centralized debug logging utility for performance optimization.

This module provides a simple way to enable/disable debug logs across the entire application.
When DEBUG_ENABLED=false, all debug_log() calls become no-ops with zero performance overhead.

Usage:
    from app.utils.debug_logger import debug_log
    
    debug_log("Starting retrieval", "HYBRID")
    debug_log(f"Processing {count} items", "RETRIEVER")

Configuration:
    # Disable ALL logs (production/performance testing)
    DEBUG_LOGS=false
    
    # Enable ALL logs (development)
    DEBUG_LOGS=true
    
    # Enable only specific modules (targeted debugging)
    DEBUG_LOGS=true
    DEBUG_HYBRID=true
    DEBUG_RETRIEVER=false
"""
import sys
import os

# ============================================================================
# CONFIGURATION
# ============================================================================

# Master switch - set to false to disable ALL debug logging
DEBUG_ENABLED = os.getenv('DEBUG_LOGS', 'false').lower() == 'true'

# File logging switch - set to false to disable file logging (separate from terminal logs)
FILE_LOGGING_ENABLED = os.getenv('DEBUG_FILE_LOGGING', 'false').lower() == 'true'

# Module-specific flags (only checked if DEBUG_ENABLED=true)
# Set individual modules to false to silence them while keeping others enabled
MODULE_FLAGS = {
    'HYBRID': os.getenv('DEBUG_HYBRID', 'true').lower() == 'true',
    'RETRIEVER': os.getenv('DEBUG_RETRIEVER', 'true').lower() == 'true',
    'DECOMPOSER': os.getenv('DEBUG_DECOMPOSER', 'true').lower() == 'true',
    'MERGER': os.getenv('DEBUG_MERGER', 'true').lower() == 'true',
    'CHUNKS': os.getenv('DEBUG_CHUNKS', 'true').lower() == 'true',
    'MULTI-DOC': os.getenv('DEBUG_MULTIDOC', 'true').lower() == 'true',
    'FALLBACK': os.getenv('DEBUG_FALLBACK', 'true').lower() == 'true',
    'INVOKE_LLM': os.getenv('DEBUG_INVOKE_LLM', 'true').lower() == 'true',
    'LOGGER': os.getenv('DEBUG_LOGGER', 'true').lower() == 'true',
    'PREFETCH': os.getenv('DEBUG_PREFETCH', 'true').lower() == 'true',
    'TOOL': os.getenv('DEBUG_TOOL', 'true').lower() == 'true',
    'TOOL V2': os.getenv('DEBUG_TOOL_V2', 'true').lower() == 'true',
}

# ============================================================================
# PUBLIC API
# ============================================================================

def debug_log(message: str, module: str = ""):
    """
    Print debug message only if debugging is enabled.
    
    This function has ZERO performance overhead when DEBUG_ENABLED=false.
    The message string won't even be formatted if debugging is disabled.
    
    Args:
        message: The message to log (can include f-string formatting)
        module: Module name (e.g., "HYBRID", "RETRIEVER")
                If empty, prints without module prefix
    
    Examples:
        debug_log("Starting retrieval", "HYBRID")
        debug_log(f"Processing {count} items", "RETRIEVER")
        debug_log("Generic message")  # No module prefix
    """
    if not DEBUG_ENABLED:
        return  # Fast exit - no string formatting or I/O
    
    # Check module-specific flag if module is specified
    if module and not MODULE_FLAGS.get(module, True):
        return
    
    # Print with module prefix
    if module:
        print(f"[{module}] {message}", file=sys.stderr)
    else:
        print(message, file=sys.stderr)


def set_debug_mode(enabled: bool):
    """
    Enable or disable debug logging at runtime.
    
    Args:
        enabled: True to enable debug logs, False to disable
    
    Example:
        from app.utils.debug_logger import set_debug_mode
        set_debug_mode(False)  # Disable all logs
    """
    global DEBUG_ENABLED
    DEBUG_ENABLED = enabled


def set_module_debug(module: str, enabled: bool):
    """
    Enable or disable debug logging for a specific module at runtime.
    
    Args:
        module: Module name (e.g., "HYBRID", "RETRIEVER")
        enabled: True to enable, False to disable
    
    Example:
        from app.utils.debug_logger import set_module_debug
        set_module_debug("HYBRID", False)  # Silence hybrid retrieval logs
    """
    if module in MODULE_FLAGS:
        MODULE_FLAGS[module] = enabled


def is_debug_enabled(module: str = None) -> bool:
    """
    Check if debug logging is enabled.
    
    Args:
        module: Optional module name to check
    
    Returns:
        True if debugging is enabled for the module (or globally if no module specified)
    
    Example:
        if is_debug_enabled("HYBRID"):
            # Do expensive debug computation
            debug_log(f"Complex data: {expensive_operation()}", "HYBRID")
    """
    if not DEBUG_ENABLED:
        return False
    
    if module:
        return MODULE_FLAGS.get(module, True)
    
    return True


def is_file_logging_enabled() -> bool:
    """
    Check if file logging is enabled.
    
    Returns:
        True if file logging is enabled
    
    Example:
        if is_file_logging_enabled():
            # Write to log file
            logger.log_to_file(data)
    """
    return FILE_LOGGING_ENABLED


# ============================================================================
# INITIALIZATION
# ============================================================================

# Print startup message if debugging is enabled
if DEBUG_ENABLED:
    enabled_modules = [m for m, enabled in MODULE_FLAGS.items() if enabled]
    print(f"[DEBUG] Debug logging ENABLED for modules: {', '.join(enabled_modules)}", file=sys.stderr)
else:
    print("[DEBUG] Debug logging DISABLED (set DEBUG_LOGS=true to enable)", file=sys.stderr)
