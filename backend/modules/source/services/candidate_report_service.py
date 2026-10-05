"""
Candidate Report Service
========================
Generates executive-grade candidate shortlist reports as high-resolution
landscape PDFs using ReportLab 4.2.0.
"""

import io
from datetime import datetime
from typing import List, Dict, Any, Optional

from reportlab.lib.pagesizes import landscape, A4
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to compute total page count and draw running header/footer."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        page_width, page_height = landscape(A4)

        # Running Header (pages 2+)
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#4338CA"))
            self.drawString(30, page_height - 20, "CANDIDATE SHORTLIST REPORT")
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748B"))
            self.drawRightString(page_width - 30, page_height - 20, "Phygitron 360 Talent Vault")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(30, page_height - 24, page_width - 30, page_height - 24)

        # Running Footer (all pages)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(30, 24, page_width - 30, 24)

        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(30, 12, "Confidential — Generated for Internal Talent Acquisition Evaluation")
        
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(page_width - 30, 12, page_str)
        self.restoreState()


def _format_skills(skills: Any, max_count: int = 8) -> str:
    """Safely format skills into a readable comma-separated string."""
    if not skills:
        return "—"
    if isinstance(skills, str):
        items = [s.strip() for s in skills.split(",") if s.strip()]
    elif isinstance(skills, list):
        items = []
        for s in skills:
            if isinstance(s, dict):
                items.append(s.get("name") or s.get("skill_name") or "")
            elif isinstance(s, str) and s.strip():
                items.append(s.strip())
    else:
        return "—"

    items = [i for i in items if i]
    if not items:
        return "—"

    if len(items) > max_count:
        return ", ".join(items[:max_count]) + f" (+{len(items) - max_count} more)"
    return ", ".join(items)


def generate_candidate_report_pdf(
    candidates: List[Dict[str, Any]],
    job_role_title: Optional[str] = None,
    filters_summary: Optional[Dict[str, Any]] = None,
    company_name: Optional[str] = "Phygitron 360"
) -> bytes:
    """
    Generates a PDF byte stream containing an executive landscape report
    of the provided candidates (typically top 20).
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=30,
        rightMargin=30,
        topMargin=25,
        bottomMargin=32
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#1E1B4B"),
        spaceAfter=2
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#64748B")
    )
    meta_label_style = ParagraphStyle(
        'MetaLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#312E81"),
        alignment=TA_RIGHT
    )
    meta_val_style = ParagraphStyle(
        'MetaVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#475569"),
        alignment=TA_RIGHT
    )

    # Table cell styles
    th_style = ParagraphStyle(
        'TableHeader',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=TA_CENTER
    )
    th_left_style = ParagraphStyle(
        'TableHeaderLeft',
        parent=th_style,
        alignment=TA_LEFT
    )

    td_rank = ParagraphStyle('TDRank', fontName='Helvetica-Bold', fontSize=9, leading=11, textColor=colors.HexColor("#1E1B4B"), alignment=TA_CENTER)
    td_name = ParagraphStyle('TDName', fontName='Helvetica-Bold', fontSize=8.5, leading=11, textColor=colors.HexColor("#0F172A"))
    td_sub = ParagraphStyle('TDSub', fontName='Helvetica', fontSize=7.5, leading=9.5, textColor=colors.HexColor("#64748B"))
    td_desig = ParagraphStyle('TDDesig', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=colors.HexColor("#1E293B"))
    td_score = ParagraphStyle('TDScore', fontName='Helvetica-Bold', fontSize=9, leading=11, alignment=TA_CENTER)
    td_ratio = ParagraphStyle('TDRatio', fontName='Helvetica', fontSize=7.5, leading=9, textColor=colors.HexColor("#64748B"), alignment=TA_CENTER)
    td_skills_match = ParagraphStyle('TDSkillsMatch', fontName='Helvetica', fontSize=7, leading=8.5, textColor=colors.HexColor("#065F46"))
    td_skills_miss = ParagraphStyle('TDSkillsMiss', fontName='Helvetica', fontSize=7, leading=8.5, textColor=colors.HexColor("#991B1B"))
    td_center = ParagraphStyle('TDCenter', fontName='Helvetica', fontSize=7.5, leading=9.5, textColor=colors.HexColor("#334155"), alignment=TA_CENTER)

    story = []

    # 1. Header Banner
    now_str = datetime.utcnow().strftime("%B %d, %Y • %I:%M %p UTC")
    role_display = job_role_title or "General Talent Pool (All Roles)"

    filter_desc_parts = []
    if filters_summary:
        if filters_summary.get("tags"):
            tags = filters_summary["tags"]
            tag_str = ", ".join(tags) if isinstance(tags, list) else str(tags)
            filter_desc_parts.append(f"Tags: {tag_str}")
        if filters_summary.get("exp_range"):
            filter_desc_parts.append(f"Exp: {filters_summary['exp_range']}")
        if filters_summary.get("location"):
            filter_desc_parts.append(f"Loc: {filters_summary['location']}")
        if filters_summary.get("sort_by"):
            sort_lbl = {
                "required_score": "Required Fit (High → Low)",
                "preferred_score": "Preferred Fit (High → Low)",
                "newest": "Newest Added",
                "experience": "Total Experience"
            }.get(filters_summary["sort_by"], filters_summary["sort_by"])
            filter_desc_parts.append(f"Sort: {sort_lbl}")

    filter_desc = " | ".join(filter_desc_parts) if filter_desc_parts else "Standard Filters"

    header_table_data = [
        [
            [
                Paragraph("CANDIDATE SHORTLIST REPORT", title_style),
                Paragraph(f"Top {len(candidates)} Candidates • ATS Match & Skill Breakdown", subtitle_style),
                Paragraph(f"<font color='#4338CA'><b>Organization:</b></font> {company_name}", subtitle_style),
            ],
            [
                Paragraph(f"<b>Target Role:</b> {role_display}", meta_label_style),
                Paragraph(f"<b>Generated:</b> {now_str}", meta_val_style),
                Paragraph(f"<b>Active Filters:</b> {filter_desc}", meta_val_style),
            ]
        ]
    ]

    header_table = Table(header_table_data, colWidths=[450, 331])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 6))

    # 2. Executive KPI Cards Strip
    total_cand = len(candidates)
    req_scores = [c.get("required_score") for c in candidates if c.get("required_score") is not None]
    pref_scores = [c.get("preferred_score") for c in candidates if c.get("preferred_score") is not None]

    avg_req = f"{round(sum(req_scores) / len(req_scores), 1)}%" if req_scores else "N/A"
    avg_pref = f"{round(sum(pref_scores) / len(pref_scores), 1)}%" if pref_scores else "N/A"

    top_cand_name = "—"
    top_cand_score = ""
    if candidates:
        top_c = candidates[0]
        top_cand_name = top_c.get("full_name") or "Candidate #1"
        if top_c.get("required_score") is not None:
            top_cand_score = f" ({round(top_c['required_score'])}% Req)"

    kpi_data = [
        [
            Paragraph(f"<font size='7' color='#64748B'><b>TOTAL EVALUATED</b></font><br/><font size='12' color='#1E1B4B'><b>{total_cand} Candidates</b></font><br/><font size='7' color='#94A3B8'>Ranked Shortlist</font>", styles['Normal']),
            Paragraph(f"<font size='7' color='#64748B'><b>AVG REQUIRED FIT</b></font><br/><font size='12' color='#4338CA'><b>{avg_req}</b></font><br/><font size='7' color='#94A3B8'>Strict Role Match</font>", styles['Normal']),
            Paragraph(f"<font size='7' color='#64748B'><b>AVG PREFERRED FIT</b></font><br/><font size='12' color='#7C3AED'><b>{avg_pref}</b></font><br/><font size='7' color='#94A3B8'>Bonus Competencies</font>", styles['Normal']),
            Paragraph(f"<font size='7' color='#64748B'><b>TOP RANKED CANDIDATE</b></font><br/><font size='10' color='#0F172A'><b>{top_cand_name[:22]}</b></font><br/><font size='7' color='#059669'><b>{top_cand_score}</b></font>", styles['Normal']),
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[195, 195, 195, 196])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#E2E8F0")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 10))

    # 3. Main Candidates Table
    # Widths sum to 781 pt (landscape A4 width 841.89 - margins 60 = 781.89)
    col_widths = [26, 145, 110, 78, 78, 78, 134, 132]

    table_rows = [
        [
            Paragraph("#", th_style),
            Paragraph("CANDIDATE", th_left_style),
            Paragraph("ROLE & EXP", th_left_style),
            Paragraph("STATUS & LOC", th_style),
            Paragraph("REQUIRED", th_style),
            Paragraph("PREFERRED", th_style),
            Paragraph("MATCHED SKILLS", th_left_style),
            Paragraph("MISSING SKILLS", th_left_style),
        ]
    ]

    for idx, c in enumerate(candidates, 1):
        name = c.get("full_name") or "Unknown Candidate"
        email = c.get("email") or "—"
        phone = c.get("phone") or ""

        cand_info_flowables = [
            Paragraph(name, td_name),
            Paragraph(email, td_sub)
        ]
        if phone and phone != "—":
            cand_info_flowables.append(Paragraph(phone, td_sub))

        desig = c.get("current_designation") or "Not Specified"
        exp_years = c.get("total_experience_years")
        exp_str = f"{exp_years} yrs exp" if exp_years is not None else "Exp: —"

        role_flowables = [
            Paragraph(desig, td_desig),
            Paragraph(exp_str, td_sub)
        ]

        status = c.get("status") or "New"
        loc = c.get("location") or "—"
        loc_flowables = [
            Paragraph(f"<b>{status}</b>", td_center),
            Paragraph(loc, td_sub)
        ]

        # Required Score & Ratio
        req_tot = c.get("required_total") or 0
        req_mat = c.get("required_matched") or 0
        req_pct = c.get("required_score")
        if req_pct is not None:
            req_pct_val = round(float(req_pct))
            color_hex = "#047857" if req_pct_val >= 75 else ("#B45309" if req_pct_val >= 40 else "#6B7280")
            req_score_p = Paragraph(f"<font color='{color_hex}'><b>{req_pct_val}%</b></font>", td_score)
            req_ratio_p = Paragraph(f"{req_mat}/{req_tot} matched" if req_tot > 0 else "—", td_ratio)
        else:
            req_score_p = Paragraph("—", td_score)
            req_ratio_p = Paragraph("Not Scored", td_ratio)

        # Preferred Score & Ratio
        pref_tot = c.get("preferred_total") or 0
        pref_mat = c.get("preferred_matched") or 0
        pref_pct = c.get("preferred_score")
        if pref_pct is not None:
            pref_pct_val = round(float(pref_pct))
            color_hex = "#7C3AED" if pref_pct_val >= 75 else ("#B45309" if pref_pct_val >= 40 else "#6B7280")
            pref_score_p = Paragraph(f"<font color='{color_hex}'><b>{pref_pct_val}%</b></font>", td_score)
            pref_ratio_p = Paragraph(f"{pref_mat}/{pref_tot} matched" if pref_tot > 0 else "—", td_ratio)
        else:
            pref_score_p = Paragraph("—", td_score)
            pref_ratio_p = Paragraph("Not Scored", td_ratio)

        # Matched & Missing Skills
        ats_detail = c.get("ats_detail") or {}
        matched_skills = c.get("matched_skills") or ats_detail.get("matched_skills") or []
        missing_skills = c.get("missing_skills") or ats_detail.get("missing_skills") or []

        matched_txt = _format_skills(matched_skills, max_count=7)
        missing_txt = _format_skills(missing_skills, max_count=6)

        table_rows.append([
            Paragraph(f"#{idx}", td_rank),
            cand_info_flowables,
            role_flowables,
            loc_flowables,
            [req_score_p, req_ratio_p],
            [pref_score_p, pref_ratio_p],
            Paragraph(matched_txt, td_skills_match),
            Paragraph(missing_txt, td_skills_miss),
        ])

    cand_table = Table(table_rows, colWidths=col_widths, repeatRows=1)
    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#312E81")),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]

    # Alternating row backgrounds
    for r_idx in range(1, len(table_rows)):
        bg = colors.HexColor("#FFFFFF") if r_idx % 2 != 0 else colors.HexColor("#F8FAFC")
        table_style.append(('BACKGROUND', (0, r_idx), (-1, r_idx), bg))

    cand_table.setStyle(TableStyle(table_style))
    story.append(cand_table)

    # Build PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    return buf.getvalue()
