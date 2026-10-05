"""
Verify Module — Live Monitoring API
===================================
WebSocket Hub for tracking candidates currently taking assessments.
"""

import logging
from typing import Dict, Any, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/verify/live-monitor", tags=["Verify - Live Monitor"])

class ConnectionManager:
    def __init__(self):
        # Maps asm_id to a list of connected WebSockets (Recruiters)
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, asm_id: int):
        await websocket.accept()
        if asm_id not in self.active_connections:
            self.active_connections[asm_id] = []
        self.active_connections[asm_id].append(websocket)
        logger.info(f"Recruiter connected to monitor asm_id {asm_id}")

    def disconnect(self, websocket: WebSocket, asm_id: int):
        if asm_id in self.active_connections:
            self.active_connections[asm_id].remove(websocket)
            if not self.active_connections[asm_id]:
                del self.active_connections[asm_id]

    async def broadcast_event(self, asm_id: int, event: Dict[str, Any]):
        """Broadcast an event (like a strike or status change) to all connected recruiters for this assessment."""
        connections = self.active_connections.get(asm_id, [])
        dead_connections = []
        for connection in connections:
            try:
                await connection.send_json(event)
            except Exception as e:
                logger.warning(f"Error sending to WebSocket: {e}")
                dead_connections.append(connection)
        
        for dead in dead_connections:
            self.disconnect(dead, asm_id)

manager = ConnectionManager()

@router.websocket("/{asm_id}")
async def live_monitor_endpoint(websocket: WebSocket, asm_id: int):
    """
    WebSocket endpoint for HR/Recruiters to listen to live candidate events.
    Verifies session_token from query param or cookie before accepting.
    """
    token = websocket.query_params.get("token") or websocket.cookies.get("session_token")
    if not token:
        await websocket.close(code=4001)
        return

    try:
        from backend.core.database import get_db_connection
        from psycopg2.extras import RealDictCursor
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET search_path TO public")
            cur.execute("SELECT user_id, tenant_id FROM sessions WHERE session_token = %s", (token,))
            sess = cur.fetchone()
            if not sess:
                await websocket.close(code=4001)
                return

            # ── Permission check: verify.monitoring.view ──────────────────
            user_id  = sess["user_id"]
            tenant_id = sess["tenant_id"] or "public"
            cur.execute(f'SET search_path TO "{tenant_id}"')
            cur.execute("SELECT role FROM users WHERE id = %s", (user_id,))
            user_row = cur.fetchone()
            role = (user_row["role"] if user_row else "") or ""

            # super_admin bypass
            has_monitoring = role in ("super_admin", "superadmin")

            if not has_monitoring:
                cur.execute(
                    "SELECT 1 FROM role_permissions WHERE role = %s AND permission = 'verify.monitoring.view'",
                    (role,)
                )
                has_monitoring = cur.fetchone() is not None

            if not has_monitoring:
                cur.execute(
                    "SELECT 1 FROM user_permissions WHERE user_id = %s AND permission = 'verify.monitoring.view' AND granted = TRUE",
                    (user_id,)
                )
                has_monitoring = cur.fetchone() is not None

            if not has_monitoring:
                await websocket.close(code=4003)
                return
    except Exception as e:
        logger.error(f"WebSocket auth error: {e}")
        await websocket.close(code=4000)
        return

    await manager.connect(websocket, asm_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, asm_id)
        logger.info(f"Recruiter disconnected from asm_id {asm_id}")

async def notify_live_monitor(asm_id: int, event_type: str, user_id: int, details: dict = None):
    """Utility to trigger a broadcast. Should be called from assignments/submissions APIs."""
    event = {
        "event_type": event_type,
        "user_id": user_id,
        "details": details or {}
    }
    await manager.broadcast_event(asm_id, event)
