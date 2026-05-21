"""Agent orchestration — the tool-calling loop and tool registry.

Phase 1: a custom Gemini function-calling loop with built-in tools.
Later phases add webhook / OpenAPI / MCP executors and a Firestore-backed
tool catalog (the "marketplace").
"""
