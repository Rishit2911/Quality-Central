"""
notification_manager.py
=======================
In-memory SSE connection manager for real-time in-app notifications.

Each connected browser tab gets its own asyncio.Queue.
When a notification is written to the DB (sync code), push_sync() bridges
to the main async event loop using run_coroutine_threadsafe().

Single-process solution suitable for the current Uvicorn deployment.
For multi-worker deployments, swap queues for Redis Pub/Sub channels.
"""

import asyncio
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class NotificationConnectionManager:
    def __init__(self):
        # employee_code -> list of asyncio.Queue
        self._user_queues: Dict[str, List[asyncio.Queue]] = {}
        # user_id (int) -> list of asyncio.Queue
        self._uid_queues: Dict[int, List[asyncio.Queue]] = {}
        # Admin broadcast queues
        self._admin_queues: List[asyncio.Queue] = []

    # ── Connection lifecycle ─────────────────────────────────────────────────

    async def connect_user(
        self,
        employee_code: Optional[str],
        user_id: Optional[int],
        is_admin: bool,
    ) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)

        if is_admin:
            self._admin_queues.append(queue)
        else:
            if employee_code:
                self._user_queues.setdefault(employee_code, []).append(queue)
            if user_id:
                self._uid_queues.setdefault(user_id, []).append(queue)

        logger.debug(
            "SSE connect | emp=%s uid=%s admin=%s | total_admin=%d",
            employee_code, user_id, is_admin, len(self._admin_queues),
        )
        return queue

    async def disconnect_user(
        self,
        employee_code: Optional[str],
        user_id: Optional[int],
        is_admin: bool,
        queue: asyncio.Queue,
    ):
        if is_admin:
            try:
                self._admin_queues.remove(queue)
            except ValueError:
                pass
        else:
            if employee_code and employee_code in self._user_queues:
                try:
                    self._user_queues[employee_code].remove(queue)
                except ValueError:
                    pass
                if not self._user_queues[employee_code]:
                    del self._user_queues[employee_code]
            if user_id and user_id in self._uid_queues:
                try:
                    self._uid_queues[user_id].remove(queue)
                except ValueError:
                    pass
                if not self._uid_queues[user_id]:
                    del self._uid_queues[user_id]

        logger.debug(
            "SSE disconnect | emp=%s uid=%s admin=%s",
            employee_code, user_id, is_admin,
        )

    # ── Async push helpers ───────────────────────────────────────────────────

    async def _push_to_queue(self, queue: asyncio.Queue, payload: dict):
        try:
            queue.put_nowait(payload)
        except asyncio.QueueFull:
            logger.warning("SSE queue full — dropping notification for a slow client")

    async def push_to_employee(self, employee_code: str, payload: dict):
        for q in list(self._user_queues.get(employee_code, [])):
            await self._push_to_queue(q, payload)

    async def push_to_user_id(self, user_id: int, payload: dict):
        for q in list(self._uid_queues.get(user_id, [])):
            await self._push_to_queue(q, payload)

    async def push_to_admins(self, payload: dict):
        for q in list(self._admin_queues):
            await self._push_to_queue(q, payload)

    # ── Sync bridge (call from service/repo sync code) ────────────────────────

    def push_sync(
        self,
        payload: dict,
        employee_code: Optional[str] = None,
        user_id: Optional[int] = None,
        is_admin_alert: bool = False,
    ):
        """
        Thread-safe: callable from synchronous service/repo code.
        Schedules the async push on the main event loop.
        """
        import backend.core.database as _db  # lazy import to avoid circular deps

        loop: Optional[asyncio.AbstractEventLoop] = getattr(_db, "main_loop", None)
        if loop is None or not loop.is_running():
            logger.debug("SSE push skipped — no running event loop yet")
            return

        if is_admin_alert or (employee_code is None and user_id is None):
            asyncio.run_coroutine_threadsafe(self.push_to_admins(payload), loop)
        else:
            if employee_code:
                asyncio.run_coroutine_threadsafe(
                    self.push_to_employee(employee_code, payload), loop
                )
            if user_id:
                asyncio.run_coroutine_threadsafe(
                    self.push_to_user_id(user_id, payload), loop
                )


# ── Singleton ────────────────────────────────────────────────────────────────

notification_manager = NotificationConnectionManager()
