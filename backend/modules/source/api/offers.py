"""
Phygitron 360 — Source Module: Offer Letters API
=================================================
Manages the offer letter approval workflow:
  HR creates → Manager approves/requests changes → HR sends → candidate becomes employee
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io

from backend.core.dependencies import get_current_user, require_permission
from backend.modules.source.services.offer_service import OfferService
from backend.modules.deploy.services.notification_service import add_notification

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/source/offers", tags=["Source - Offers"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class OfferFeedback(BaseModel):
    feedback: Optional[str] = ''


class OfferUpdate(BaseModel):
    role_title: Optional[str] = None
    salary: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    offer_content: Optional[dict] = None


def get_offer_service(user=Depends(get_current_user)):
    return OfferService(tenant_id=user.get('tenant_id', 'public'))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_offers(
    status: Optional[str] = None,
    current_user: dict = Depends(require_permission("source.offers.view")),
    service: OfferService = Depends(get_offer_service),
):
    """List all offer letters for the tenant. Optionally filter by status."""
    offers = service.get_all_offers(status)
    return {"success": True, "data": offers}


@router.get("/{offer_id}")
async def get_offer(
    offer_id: int,
    current_user: dict = Depends(require_permission("source.offers.view")),
    service: OfferService = Depends(get_offer_service),
):
    offer = service.get_offer_by_id(offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return {"success": True, "data": offer}


@router.put("/{offer_id}")
async def update_offer(
    offer_id: int,
    body: OfferUpdate,
    current_user: dict = Depends(require_permission("source.offers.manage")),
    service: OfferService = Depends(get_offer_service),
):
    """HR edits an offer letter (only allowed if pending or changes_requested)."""
    updates = {}
    for field in ("role_title", "salary", "department", "location", "start_date", "offer_content"):
        val = getattr(body, field)
        if val is not None:
            updates[field] = val

    try:
        service.update_offer(offer_id, updates)
        # Notify admins that HR has resubmitted the offer for re-approval
        add_notification(
            title="Offer Resubmitted for Approval",
            message=f"An offer letter (ID: {offer_id}) has been updated and resubmitted for your approval.",
            n_type="AdminAlert",
            tenant_id=current_user.get('tenant_id', 'public')
        )
        return {"success": True, "message": "Offer updated and re-submitted for approval"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as exc:
        logger.exception("Failed to update offer %s: %s", offer_id, exc)
        raise HTTPException(status_code=500, detail="Something went wrong while updating the offer. Please try again.")


@router.post("/{offer_id}/approve")
async def approve_offer(
    offer_id: int,
    current_user: dict = Depends(require_permission("source.offers.approve")),
    service: OfferService = Depends(get_offer_service)
):
    """Manager/admin approves the offer letter."""
    try:
        service.approve_offer(offer_id, current_user["id"])
        add_notification(
            title="Offer Letter Approved",
            message=f"Offer letter (ID: {offer_id}) has been approved and is ready to be sent to the candidate.",
            n_type="AdminAlert",
            tenant_id=current_user.get('tenant_id', 'public')
        )
        return {"success": True, "message": "Offer approved"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as exc:
        logger.exception("Failed to approve offer %s: %s", offer_id, exc)
        raise HTTPException(status_code=500, detail="Something went wrong while approving the offer. Please try again.")


@router.post("/{offer_id}/request-changes")
async def request_changes(
    offer_id: int,
    body: OfferFeedback,
    current_user: dict = Depends(require_permission("source.offers.manage")),
    service: OfferService = Depends(get_offer_service),
):
    """Manager requests changes with feedback text."""
    try:
        service.request_changes(offer_id, body.feedback)
        add_notification(
            title="Offer Changes Requested",
            message=f"Changes have been requested on offer letter (ID: {offer_id}). Feedback: {body.feedback or 'See offer details.'}",
            n_type="AdminAlert",
            tenant_id=current_user.get('tenant_id', 'public')
        )
        return {"success": True, "message": "Changes requested"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as exc:
        logger.exception("Failed to request changes on offer %s: %s", offer_id, exc)
        raise HTTPException(status_code=500, detail="Something went wrong while requesting changes. Please try again.")


@router.post("/{offer_id}/reject")
async def reject_offer(
    offer_id: int,
    body: OfferFeedback,
    current_user: dict = Depends(require_permission("source.offers.approve")),
    service: OfferService = Depends(get_offer_service),
):
    """Manager rejects the offer outright."""
    try:
        service.reject_offer(offer_id, body.feedback)
        add_notification(
            title="Offer Letter Rejected",
            message=f"Offer letter (ID: {offer_id}) has been rejected. Reason: {body.feedback or 'No reason provided.'}",
            n_type="AdminAlert",
            tenant_id=current_user.get('tenant_id', 'public')
        )
        return {"success": True, "message": "Offer rejected"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as exc:
        logger.exception("Failed to reject offer %s: %s", offer_id, exc)
        raise HTTPException(status_code=500, detail="Something went wrong while rejecting the offer. Please try again.")


@router.post("/{offer_id}/send")
async def send_offer(
    offer_id: int,
    current_user: dict = Depends(require_permission("source.offers.manage")),
    service: OfferService = Depends(get_offer_service),
):
    """
    HR sends the approved offer to the candidate.
    This creates an employee record and marks the candidate as Archived.
    """
    try:
        result = service.send_offer(offer_id)
        return {
            "success": True,
            "message": "Offer sent successfully. Onboarding will be initiated separately.",
            "data": result,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as exc:
        logger.exception(f"send_offer({offer_id}) failed: {exc}")
        raise HTTPException(status_code=500, detail="Something went wrong while sending the offer. Please try again.")

@router.get("/{offer_id}/preview")
async def preview_offer(
    offer_id: int,
    current_user: dict = Depends(require_permission("source.offers.view")),
    service: OfferService = Depends(get_offer_service),
):
    """Generate a PDF preview of the offer letter."""
    offer = service.get_offer_by_id(offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
        
    try:
        from backend.common.utils.pdf_utils import generate_ewandz_offer_pdf
        pdf_bytes = generate_ewandz_offer_pdf(offer)
        return StreamingResponse(
            io.BytesIO(pdf_bytes), 
            media_type="application/pdf", 
            headers={"Content-Disposition": f"inline; filename=offer_{offer_id}.pdf"}
        )
    except Exception as exc:
        logger.exception(f"preview_offer({offer_id}) failed: {exc}")
        raise HTTPException(status_code=500, detail="Something went wrong while generating the offer preview. Please try again.")

