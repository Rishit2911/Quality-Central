import asyncio
import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from backend.core.dependencies import get_current_user
from backend.modules.deploy.services.notification_service import NotificationService
from backend.core.notification_manager import notification_manager

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

def get_service():
    return NotificationService()

@router.get("")
def get_my_notifications(user=Depends(get_current_user), service: NotificationService = Depends(get_service)):
    # Check if user has permission to see global admin notifications
    user_perms = user.get('permissions', {})
    is_admin_viewer = user_perms.get('deploy.notifications.view_admin', False)
    
    if is_admin_viewer:
        return service.get_admin_notifications()
    return service.get_user_notifications(
        employee_code=user.get('employee_code'),
        user_id=user.get('id')
    )

@router.get("/unread-count")
def get_unread_count(user=Depends(get_current_user), service: NotificationService = Depends(get_service)):
    user_perms = user.get('permissions', {})
    is_admin_viewer = user_perms.get('deploy.notifications.view_admin', False)
    emp_code = user.get('employee_code')
    user_id = user.get('id')
    return {"count": service.get_unread_count(emp_code, is_admin_viewer, user_id=user_id)}

@router.get("/unread-details")
def get_unread_details(user=Depends(get_current_user), service: NotificationService = Depends(get_service)):
    user_perms = user.get('permissions', {})
    is_admin_viewer = user_perms.get('deploy.notifications.view_admin', False)
    emp_code = user.get('employee_code')
    user_id = user.get('id')
    
    # We want ALL relevant unread notifications
    if is_admin_viewer:
        unread = service.get_admin_notifications(limit=100, unread_only=True)
    else:
        unread = service.get_user_notifications(emp_code, limit=100, unread_only=True, user_id=user_id)
        
    return {"count": len(unread), "items": unread}

@router.post("/{notif_id}/read")
def mark_read(notif_id: int, user=Depends(get_current_user), service: NotificationService = Depends(get_service)):
    service.mark_read(notif_id)
    return {"success": True}

@router.post("/read-all")
def mark_all_read(user=Depends(get_current_user), service: NotificationService = Depends(get_service)):
    user_perms = user.get('permissions', {})
    is_admin_viewer = user_perms.get('deploy.notifications.view_admin', False)
    service.mark_all_read(user.get('employee_code'), is_admin_viewer, user_id=user.get('id'))
    return {"success": True}


# ── Real-time SSE stream ──────────────────────────────────────────────────────

@router.get("/stream")
async def notification_stream(user=Depends(get_current_user)):
    """
    Server-Sent Events endpoint.
    The browser keeps this connection open and receives pushed events the
    instant a notification is written to the database — no polling required.

    Protocol:
      event: notification   → a new notification payload (JSON)
      event: ping           → heartbeat every 25s (keeps proxies from timing out)
    """
    user_perms = user.get('permissions', {})
    is_admin = user_perms.get('deploy.notifications.view_admin', False)
    emp_code = user.get('employee_code')
    user_id = user.get('id')

    queue = await notification_manager.connect_user(emp_code, user_id, is_admin)

    async def event_generator():
        try:
            while True:
                try:
                    # Wait up to 25 seconds for a real notification, then send ping
                    payload = await asyncio.wait_for(queue.get(), timeout=25.0)
                    data = json.dumps(payload, default=str)
                    yield f"event: notification\ndata: {data}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat — keeps the connection alive through load balancers
                    yield "event: ping\ndata: ping\n\n"
        except asyncio.CancelledError:
            # Client disconnected
            pass
        finally:
            await notification_manager.disconnect_user(emp_code, user_id, is_admin, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable Nginx buffering
            "Connection": "keep-alive",
        },
    )
