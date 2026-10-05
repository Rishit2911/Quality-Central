import re
import os
import base64
import requests
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from backend.core.dependencies import get_current_user, require_permission
from backend.core.permissions import P

router = APIRouter(prefix="/api/lexai/speech-to-text", tags=["lexai-voice"])
alias_voice_router = APIRouter(prefix="/api/speech-to-text", tags=["lexai-voice-alias"])

async def speech_to_text_impl(audio: UploadFile):
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY / GOOGLE_API_KEY is missing.")

    try:
        audio_bytes = await audio.read()
        audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')

        mime_type = "audio/webm"
        if audio.filename and audio.filename.endswith(".mp3"):
            mime_type = "audio/mp3"
        elif audio.filename and audio.filename.endswith(".wav"):
            mime_type = "audio/wav"

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"

        payload = {
            "contents": [{
                "parts": [
                    {"text": "Transcribe this audio clip precisely. Return ONLY the raw spoken words. Do NOT include any sound event tags like <noise>, <laughter>, or <silence>. Do not add any introductory or concluding remarks."},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": audio_b64
                        }
                    }
                ]
            }],
            "generationConfig": {
                "temperature": 0.0,
            }
        }

        response = requests.post(url, json=payload)
        response.raise_for_status()

        data = response.json()

        try:
            transcription = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            transcription = re.sub(r'<[^>]+>', '', transcription).strip()
            return {"text": transcription}
        except (KeyError, IndexError):
            raise HTTPException(status_code=500, detail="Failed to parse Gemini response: " + str(data))

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", dependencies=[Depends(require_permission(P.LEXAI_VOICE_USE))])
async def speech_to_text(audio: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    return await speech_to_text_impl(audio)

@alias_voice_router.post("/", dependencies=[Depends(require_permission(P.LEXAI_VOICE_USE))])
async def speech_to_text_alias(audio: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    return await speech_to_text_impl(audio)
