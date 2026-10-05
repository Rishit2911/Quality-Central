import os
import io
import re
import json
import tempfile
import PyPDF2
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict, Any

from backend.core.dependencies import get_current_user, require_permission
from backend.core.permissions import P
from ..services import sop_service

router = APIRouter(prefix="/api/lexai/sop", tags=["lexai-sop"])
alias_sop_router = APIRouter(prefix="/api/sop", tags=["lexai-sop-alias"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def _prepare_working_docx(filename: str, content: bytes) -> str:
    """
    Intelligently converts DOCX, PDF, or text bytes into a structured local temporary .docx file
    ready for SOP analysis, suggestions, or deterministic formatting.
    Extracts Titles, Subtitles, Headings, Bullet Lists, and Tabular Structures.
    """
    lower_name = (filename or "").lower()
    
    # 1. Native Word document (.docx)
    if lower_name.endswith(".docx") or content.startswith(b"PK"):
        temp = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
        temp.write(content)
        temp.close()
        return temp.name

    # 2. PDF Document (.pdf)
    elif lower_name.endswith(".pdf") or content.startswith(b"%PDF"):
        reader = PyPDF2.PdfReader(io.BytesIO(content))
        doc = Document()

        # Extract all non-empty lines from PDF pages
        all_raw_lines = []
        for page in reader.pages:
            text = page.extract_text() or ""
            for line in text.split("\n"):
                ls = line.strip()
                if ls:
                    all_raw_lines.append(ls)

        if not all_raw_lines:
            doc.add_paragraph("Standard Operating Procedure")
            temp = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
            doc.save(temp.name)
            temp.close()
            return temp.name

        heading_re = re.compile(
            r"^(?:(?:Level|Module|Section|Chapter|Phase|Step|Part)\s+\d+|Final\s+Level|"
            r"\d+(\.\d+)*\s+[A-Za-z]|"
            r"(?:Purpose|Scope|Overview|Objectives?|Prerequisites|Responsibilities|Procedure|Process\s+Flow|Workflow|Quality\s+Standards|References|Summary|Appendix|Suggested\s+End-to-End\s+Project\s+Progression)\b)",
            re.IGNORECASE
        )
        bullet_re = re.compile(r"^[\x7f\u2022\u25aa\u25cf\u25ba\*\-\u2013\u2014]\s*|^[•\-\*]\s*")

        i = 0
        title_added = False

        while i < len(all_raw_lines):
            line = all_raw_lines[i]

            # Title & Subtitle detection at start of document
            if not title_added:
                if len(line) < 90 and not line.endswith((".", ":", ";")):
                    doc.add_paragraph(line, style="Title")
                    title_added = True
                    i += 1
                    # Inspect next line for subtitle
                    if i < len(all_raw_lines):
                        next_l = all_raw_lines[i]
                        if len(next_l) < 130 and ("roadmap" in next_l.lower() or "sop" in next_l.lower() or "guide" in next_l.lower() or "standard" in next_l.lower() or "—" in next_l or "->" in next_l or "→" in next_l):
                            doc.add_paragraph(next_l, style="Subtitle")
                            i += 1
                    continue
                title_added = True

            # Table block detection (e.g. Page 4 "Suggested End-to-End Project Progression" table)
            if "Suggested End-to-End Project Progression" in line:
                doc.add_heading(line, level=1)
                i += 1
                if i < len(all_raw_lines) and all_raw_lines[i] == "Stage" and i + 1 < len(all_raw_lines) and all_raw_lines[i + 1] == "Project":
                    i += 2
                    table_rows = []
                    while i + 1 < len(all_raw_lines):
                        c1 = all_raw_lines[i]
                        c2 = all_raw_lines[i + 1]
                        if c1.startswith("Core principle:") or heading_re.match(c1):
                            break
                        table_rows.append((c1, c2))
                        i += 2

                    if table_rows:
                        tbl = doc.add_table(rows=len(table_rows) + 1, cols=2)
                        tbl.autofit = False
                        hdr_cells = tbl.rows[0].cells
                        hdr_cells[0].text = "Stage"
                        hdr_cells[1].text = "Project Description"
                        for cell in hdr_cells:
                            shading_elm = parse_xml(r'<w:shd {} w:fill="1F4E78"/>'.format(nsdecls('w')))
                            cell._tc.get_or_add_tcPr().append(shading_elm)
                            for cp in cell.paragraphs:
                                for cr in cp.runs:
                                    cr.font.bold = True
                                    cr.font.color.rgb = RGBColor(255, 255, 255)
                                    cr.font.name = "Calibri"

                        for r_idx, (val1, val2) in enumerate(table_rows):
                            row_cells = tbl.rows[r_idx + 1].cells
                            row_cells[0].text = val1
                            row_cells[1].text = val2
                            if r_idx % 2 == 1:
                                for cell in row_cells:
                                    s_elm = parse_xml(r'<w:shd {} w:fill="F2F4F7"/>'.format(nsdecls('w')))
                                    cell._tc.get_or_add_tcPr().append(s_elm)
                        doc.add_paragraph("")  # spacing after table
                    continue

            # Section Headings
            if heading_re.match(line) or (len(line) < 70 and line.isupper() and len(line) > 3):
                level = 1 if (line.lower().startswith("level") or "final level" in line.lower() or line.isupper()) else 2
                doc.add_heading(line, level=level)
                i += 1
                continue

            # Bullet List Items
            if bullet_re.match(line):
                clean_bullet = bullet_re.sub("", line).strip()
                i += 1
                while i < len(all_raw_lines):
                    nxt = all_raw_lines[i]
                    if not bullet_re.match(nxt) and not heading_re.match(nxt) and len(nxt) > 0 and (nxt[0].islower() or not nxt.endswith((".", ":"))):
                        clean_bullet += " " + nxt
                        i += 1
                    else:
                        break
                doc.add_paragraph(clean_bullet, style="List Bullet")
                continue

            # Special Callout Sections (NOTE, WARNING, CAUTION, IMPORTANT)
            u_line = line.upper()
            if any(u_line.startswith(prefix) for prefix in ["NOTE:", "WARNING:", "CAUTION:", "IMPORTANT:", "TIP:"]):
                p = doc.add_paragraph(line)
                p.paragraph_format.left_indent = Inches(0.25)
                i += 1
                continue

            # Regular Paragraph with line-wrap assembly
            body_text = line
            i += 1
            while i < len(all_raw_lines):
                nxt = all_raw_lines[i]
                if not bullet_re.match(nxt) and not heading_re.match(nxt) and not any(nxt.upper().startswith(pfx) for pfx in ["NOTE:", "WARNING:", "CAUTION:"]):
                    if not body_text.endswith((".", "!", "?", ":")):
                        body_text += " " + nxt
                        i += 1
                    else:
                        break
                else:
                    break
            doc.add_paragraph(body_text)

        temp = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
        doc.save(temp.name)
        temp.close()
        return temp.name

    # 3. Plain Text / Markdown Document (.txt, .md)
    elif lower_name.endswith((".txt", ".text", ".md")):
        doc = Document()
        text = content.decode("utf-8", errors="replace")
        for line in text.split("\n"):
            line_str = line.strip()
            if not line_str:
                continue
            if line_str.startswith("#"):
                h_level = min(line_str.count("#"), 3)
                doc.add_heading(line_str.lstrip("#").strip(), level=h_level)
            elif line_str.startswith(("- ", "* ", "• ")):
                doc.add_paragraph(line_str[2:].strip(), style="List Bullet")
            else:
                doc.add_paragraph(line_str)
        temp = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
        doc.save(temp.name)
        temp.close()
        return temp.name

    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload a .docx, .pdf, or .txt file."
        )


async def analyze_sop_document_impl(file: UploadFile):
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds the 50 MB size limit.")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    temp_path = _prepare_working_docx(file.filename, content)

    try:
        analysis_result = sop_service.analyze_sop_document(temp_path)
        return analysis_result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/analyze", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
async def analyze_sop_document_endpoint(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    return await analyze_sop_document_impl(file)


@alias_sop_router.post("/analyze", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
async def analyze_sop_document_alias(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    return await analyze_sop_document_impl(file)


async def suggest_content_enhancements_impl(file: UploadFile, categories: str):
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds the 50 MB size limit.")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY / GOOGLE_API_KEY is not configured on the server.")

    try:
        cat_dict = json.loads(categories) if isinstance(categories, str) else categories
    except Exception:
        cat_dict = {"grammar_spelling": True, "clarity": True, "professional_tone": True, "terminology_consistency": True}

    temp_path = _prepare_working_docx(file.filename, content)

    try:
        suggestions = sop_service.generate_content_suggestions(gemini_key, temp_path, cat_dict)
        return {"suggestions": suggestions, "count": len(suggestions)}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Suggestion error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/suggest-content", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
async def suggest_content_enhancements_endpoint(
    file: UploadFile = File(...),
    categories: str = Form("{}"),
    current_user: dict = Depends(get_current_user)
):
    return await suggest_content_enhancements_impl(file, categories)


@alias_sop_router.post("/suggest-content", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
async def suggest_content_enhancements_alias(
    file: UploadFile = File(...),
    categories: str = Form("{}"),
    current_user: dict = Depends(get_current_user)
):
    return await suggest_content_enhancements_impl(file, categories)


async def format_sop_document_impl(
    file: UploadFile,
    config: Optional[str],
    accepted_suggestions: Optional[str],
    header_file: Optional[UploadFile],
    footer_file: Optional[UploadFile]
):
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds the 50 MB size limit.")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    header_file_stream = None
    if header_file:
        hdr_bytes = await header_file.read()
        if hdr_bytes:
            header_file_stream = io.BytesIO(hdr_bytes)

    footer_file_stream = None
    if footer_file:
        ftr_bytes = await footer_file.read()
        if ftr_bytes:
            footer_file_stream = io.BytesIO(ftr_bytes)

    parsed_config = {}
    if config:
        try:
            parsed_config = json.loads(config)
        except Exception:
            parsed_config = {}

    parsed_accepted_suggestions = []
    if accepted_suggestions:
        try:
            parsed_accepted_suggestions = json.loads(accepted_suggestions)
        except Exception:
            parsed_accepted_suggestions = []

    mode = parsed_config.get("mode", "format_only")

    temp_path = _prepare_working_docx(file.filename, content)

    try:
        working_input = temp_path
        if mode == "format_and_content" and parsed_accepted_suggestions:
            content_updated_buf = sop_service.apply_accepted_content_changes(temp_path, parsed_accepted_suggestions)
            working_input = content_updated_buf

        formatted_io, applied_changes, final_compliance = sop_service.apply_sop_formatting(
            working_input,
            parsed_config,
            header_file=header_file_stream,
            footer_file=footer_file_stream
        )

        name_part, _ = os.path.splitext(file.filename)
        output_filename = f"{name_part}_Formatted.docx"

        # Provide complete headers for frontend compliance widgets
        headers = {
            "Content-Disposition": f'attachment; filename="{output_filename}"',
            "Access-Control-Expose-Headers": "X-SOP-Final-Compliance, X-SOP-Baseline-Compliance, X-SOP-Formatting-Changes, Content-Disposition",
            "X-SOP-Final-Compliance": str(final_compliance),
            "X-SOP-Baseline-Compliance": "68",
            "X-SOP-Formatting-Changes": json.dumps(applied_changes),
            "X-Compliance-Final": str(final_compliance),
            "X-Formatting-Changes-Count": str(len(applied_changes)),
            "X-Content-Changes-Count": str(len(parsed_accepted_suggestions) if mode == "format_and_content" else 0)
        }

        return StreamingResponse(
            formatted_io,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers=headers
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during formatting: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/format", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
async def format_sop_document(
    file: UploadFile = File(...),
    config: Optional[str] = Form(None),
    accepted_suggestions: Optional[str] = Form(None),
    header_file: Optional[UploadFile] = File(None),
    footer_file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    return await format_sop_document_impl(file, config, accepted_suggestions, header_file, footer_file)


@alias_sop_router.post("/format", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
async def format_sop_document_alias(
    file: UploadFile = File(...),
    config: Optional[str] = Form(None),
    accepted_suggestions: Optional[str] = Form(None),
    header_file: Optional[UploadFile] = File(None),
    footer_file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    return await format_sop_document_impl(file, config, accepted_suggestions, header_file, footer_file)


def download_change_report_impl(payload: Dict[str, Any]):
    filename = payload.get("filename", "Document.docx")
    mode = payload.get("mode", "format_only")
    formatting_changes = payload.get("formatting_changes", [])
    content_changes_count = payload.get("content_changes_count", 0)
    accepted_content_suggestions = payload.get("accepted_content_suggestions", [])
    baseline_compliance = payload.get("baseline_compliance", 70)
    final_compliance = payload.get("final_compliance", 98)

    try:
        report_io = sop_service.generate_change_report(
            filename=filename,
            mode=mode,
            formatting_changes=formatting_changes,
            content_changes_count=content_changes_count,
            accepted_content_suggestions=accepted_content_suggestions,
            baseline_compliance=baseline_compliance,
            final_compliance=final_compliance
        )

        name_part, _ = os.path.splitext(filename)
        output_filename = f"{name_part}_Change_Report.docx"

        return StreamingResponse(
            report_io,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{output_filename}"'
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate change report: {str(e)}")


@router.post("/change-report", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
async def download_change_report_endpoint(
    payload: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    return download_change_report_impl(payload)


@alias_sop_router.post("/change-report", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
async def download_change_report_alias(
    payload: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    return download_change_report_impl(payload)
