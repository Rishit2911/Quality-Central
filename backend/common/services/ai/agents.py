import json
import logging
from typing import List, Dict, Any, Optional
from backend.common.services.ai.base import AIService

logger = logging.getLogger(__name__)

# --- System Prompts ---

# Compressed system prompt — every word saves tokens across thousands of bulk requests.
# Fields pre-extracted by regex (email, phone, github_url, linkedin_url, portfolio_url)
# are injected into the user prompt as hints, so we omit them from the schema below
# to further reduce output token count.
PARSE_RESUME_SYSTEM = """Resume parser. You will receive multiple resumes enclosed in <resume id="X">...</resume> tags.
Respond ONLY with compact valid JSON. Return a single JSON object where keys are the resume IDs, and values are the parsed data. No nulls (use "" or []).
Schema:
{
  "X": {
    "n": "Full Name",
    "e": "Email",
    "p": "Phone",
    "l": "Location",
    "d": "Current Designation",
    "x": 0.0, // total years of experience
    "ln": "LinkedIn URL",
    "pt": "Portfolio URL",
    "s": "AI Profile Summary", // Maximum 250 characters. No more.
    "sk": [{"n": "Skill Name", "l": "expert"}], // Extract EVERY single skill across tools, methodologies, domains, QA practices, testing types.
    "exp": [{"c": "Company Name", "r": "Role", "s": "Start Date", "e": "End Date", "d": "Concise summary of duties and technical tools/skills used"}], // Professional experience only.
    "edu": [{"d": "Degree Name", "c": "College Name", "s": "Start Date YYYY-MM", "e": "End Date YYYY-MM"}], // Education only. No other fields.
    "cert": [{"n": "Certification Name", "i": "Issuer", "y": 2024}], // Certifications
    "cs": ["Suspicious gap in 2020", "Frequent job hopping"] // Confidence signals or red flags (max 2 items)
  }
}
Rules:
1. "s" (AI Profile Summary) MUST be maximum 250 characters.
2. "sk" MUST contain EVERY single skill mentioned in the resume across ALL categories:
   - Technical Tools & Languages (e.g. Python, Java, Playwright, Selenium, Postman, Docker, Git, JIRA)
   - Methodologies & Frameworks (e.g. Agile, Scrum, SDLC, STLC, Sprint-Based Testing, Shift-Left Testing)
   - Domain Knowledge & Compliance (e.g. Healthcare, HIPAA Awareness, EHR, Banking, Fintech, Regulatory Compliance)
   - QA Practices & Deliverables (e.g. Defect Reporting, Test Documentation, Test Planning, Test Cases)
   - Testing Types (e.g. Manual Testing, Regression Testing, Smoke Testing, Sanity Testing, Exploratory Testing, UAT, Integration Testing, System Testing, API Testing, ETL Testing)
   - Cloud, Databases & Architecture (e.g. AWS, S3, Lambda, Glue, PostgreSQL, Snowflake SQL, Microservices, REST APIs)
3. "sk" CRITICAL SPLITTING RULES:
   - Split slashed items into separate skills: "Agile/Scrum" -> "Agile", "Scrum"; "SDLC/STLC" -> "SDLC", "STLC"; "Linux/Bash" -> "Linux", "Bash".
   - Split parenthetical sub-items: "AWS (S3, Glue, Lambda)" -> "AWS", "S3", "Glue", "Lambda".
   - Strip category headers from skills: "Healthcare Domain: HIPAA Awareness" -> "Healthcare", "HIPAA Awareness".
   - Extract at least 30-50 skills if present. Never omit methodologies or domain skills.
4. "exp" elements MUST contain keys "c", "r", "s", "e", and "d". The "d" field MUST capture a concise summary of the duties and SPECIFIC technical tools/skills used.
5. "edu" elements MUST ONLY contain keys "d", "c", "s", and "e". No field of study or other keys.
6. "cs" MUST contain at most 2 critical red flags or confidence signals. Specifically check for and flag any skills listed in the resume that are NEVER mentioned or used in their work experience/projects. If none, return [].
7. Copy pre-extracted fields verbatim if present.
8. You MUST return a key for EVERY <resume id="X"> provided. Do NOT mix up candidate details.
"""

ROLE_FIT_SYSTEM = """You are an expert technical recruiter and talent assessment AI. Your goal is to rigorously score a candidate's fit for a specific job role based on their skills, experience, and background.
Be highly objective and strict. A score of 90-100 means a flawless match across all required skills and experience levels. Penalize heavily for missing core required skills.
Provide a detailed 'summary' explaining exactly why the candidate received their score, highlighting their strongest matching attributes and their most glaring weaknesses or missing requirements.
Respond ONLY with valid JSON.
Return this exact structure:
{
  "score": 0,
  "summary": "",
  "matched_skills": [],
  "missing_skills": [],
  "partially_matched": [{"skill": "", "candidate_level": "", "required_level": ""}],
  "interview_questions": []
}"""

EXTRACT_JD_SKILLS_SYSTEM = """You are an expert technical recruiter AI.
Your goal is to parse a raw Job Description (JD) and extract a comprehensive, normalized list of required and preferred skills.
Assign each skill one of these 2 levels based on how critical it is to the role:
- 'required'  : Absolutely must-have. Candidate cannot do the job without this (core languages, main frameworks, essential domain experience).
- 'preferred' : Nice to have / bonus, secondary tools, complementary knowledge, soft skills.
CRITICAL RULES:
- Primary programming languages, core architecture, and mandatory qualifications for the role MUST be 'required'.
- Soft skills (Communication, Leadership, Problem solving), secondary tools, and bonus tech MUST be 'preferred'.
- Break down broad terms into specific measurable skills.
Respond ONLY with valid JSON.
Return this exact structure:
{
  "skills": [
    {"name": "Skill Name", "level": "required | preferred"}
  ]
}"""

FEEDBACK_SYSTEM = """You are an assessment feedback AI. Generate personalised learning feedback.
Respond ONLY with valid JSON.
Return this exact structure:
{
  "summary": "",
  "strengths": [],
  "improvement_areas": [],
  "study_recommendations": [],
  "weak_skill_ids": []
}"""

GENERATE_OFFER_LETTER_SYSTEM = """You are a professional HR assistant.
Write a warm, personalized internship or job offer letter for the company specified in the details (e.g. ACER, Phygitron 360).
The letter should be professional yet human-like, unique for each candidate.
Respond ONLY with valid JSON.
Return this structure:
{
  "subject": "Offer for [Position] - [Candidate Name]",
  "salutation": "Dear [Name],",
  "body_paragraphs": ["paragraph 1", "paragraph 2", "paragraph 3"],
  "closing": "Sincerely,",
  "signatory_name": "HR Operations Team",
  "signatory_title": "Manager - Talent Acquisition"
}"""

class AIAgents:
    def __init__(self):
        self.ai = AIService()

    async def parse_resume(self, resume_text: str) -> Dict[str, Any]:
        """Parse resume text with AI. Pre-extracts trivial fields locally to save tokens."""
        pre = self.ai.pre_extract_resume(resume_text)
        prompt = self.ai.build_bulk_prompt(resume_text, pre)
        result = await self.ai.generate_json(
            prompt=prompt,
            system_prompt=PARSE_RESUME_SYSTEM
        )
        # Ensure pre-extracted fields are not lost if LLM skipped them
        mapping = {
            "email": "e",
            "phone": "p",
            "linkedin_url": "ln",
            "portfolio_url": "pt",
            "experience_years_total": "x"
        }
        for field, value in pre.items():
            if value:
                short_key = mapping.get(field)
                if short_key and not result.get(short_key) and not result.get(field):
                    result[short_key] = value
                elif not short_key and not result.get(field):
                    result[field] = value
        return result

    async def score_role_fit(self, candidate_profile: Dict, job_role_profile: Dict) -> Dict[str, Any]:
        """Score a candidate's fit for a job role using full profiles for context."""
        prompt = json.dumps({
            "candidate": {
                "name": candidate_profile.get("full_name"),
                "designation": candidate_profile.get("current_designation"),
                "experience_years": candidate_profile.get("total_experience_years"),
                "skills": candidate_profile.get("skills_list", []), # Formatted skills list
                "summary": candidate_profile.get("ai_summary")
            },
            "job_role": {
                "title": job_role_profile.get("title"),
                "description": job_role_profile.get("description"),
                "required_skills": job_role_profile.get("required_skills"),
                "min_experience": job_role_profile.get("min_experience")
            }
        })
        return await self.ai.generate_json(
            prompt=f"Act as an expert technical recruiter. Thoroughly analyze and score this candidate's fit for the job role based on the data provided. Be rigorous and objective. Rank the candidate from 1 to 100, where 100 is a perfect unicorn match.\n\n{prompt}",
            system_prompt=ROLE_FIT_SYSTEM
        )

    async def extract_jd_skills(self, description: str, title: str = "") -> List[Dict[str, str]]:
        """Extract a structured list of skills from a raw Job Description."""
        prompt = json.dumps({
            "job_title": title,
            "job_description": description
        })
        result = await self.ai.generate_json(
            prompt=f"Extract required skills from this Job Description:\n\n{prompt}",
            system_prompt=EXTRACT_JD_SKILLS_SYSTEM
        )
        return result.get("skills", [])

    async def generate_assessment_feedback(self, questions: List[Dict], answers: Dict, scores: Dict, total_score: float, passed: bool) -> Dict[str, Any]:
        """Generate personalised learning feedback for an assessment."""
        prompt = json.dumps({
            "questions": questions,
            "candidate_answers": answers,
            "scores_per_question": scores,
            "total_score": total_score,
            "passed": passed
        })
        return await self.ai.generate_json(
            prompt=f"Generate assessment feedback:\n\n{prompt}",
            system_prompt=FEEDBACK_SYSTEM
        )

    async def generate_offer_letter(self, candidate_name: str, details: Dict) -> Dict[str, Any]:
        """Generate a personalized offer letter."""
        prompt = json.dumps({
            "candidate_name": candidate_name,
            "details": details
        })
        return await self.ai.generate_json(
            prompt=f"Generate a personalized offer letter for:\n\n{prompt}",
            system_prompt=GENERATE_OFFER_LETTER_SYSTEM
        )
