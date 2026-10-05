import os
import re
import json
import time
import threading
from dotenv import load_dotenv

# Load explicitly from backend/ folder or fallback to root
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), '.env')
load_dotenv(dotenv_path=env_path)

# ---------------------------------------------------------------------------
# Global per-provider rate limiters (token bucket, thread-safe)
# Groq free tier: 30 RPM → we cap at 28 to stay safe
# Gemini free tier: 15 RPM → we cap at 13 to stay safe
# ---------------------------------------------------------------------------

class _TokenBucketLimiter:
    """Thread-safe token bucket rate limiter used across all workers."""
    def __init__(self, rpm: int, burst: float = 1.0):
        self._capacity = burst  # Strict spacing by default to prevent TPM bursts
        self._tokens = burst
        self._refill_rate = rpm / 60.0   # tokens per second
        self._lock = threading.Lock()
        self._last_refill = time.monotonic()

    def acquire(self, block: bool = True) -> bool:
        """Consume one token. Blocks until a token is available if block=True."""
        while True:
            with self._lock:
                now = time.monotonic()
                elapsed = now - self._last_refill
                self._tokens = min(self._capacity, self._tokens + elapsed * self._refill_rate)
                self._last_refill = now
                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return True
            if not block:
                return False
            time.sleep(0.5)   # wait half a second then re-check


_GROQ_LIMITER   = _TokenBucketLimiter(rpm=int(os.getenv("GROQ_RPM_LIMIT", "28")))
_GEMINI_LIMITER = _TokenBucketLimiter(rpm=int(os.getenv("GEMINI_RPM_LIMIT", "13")))

def _get_gemini_key_list() -> list[str]:
    keys = []
    multi = os.getenv("GEMINI_API_KEYS", "")
    if multi:
        keys.extend([k.strip().strip("'\"") for k in multi.split(",") if k.strip().strip("'\"")])
    for single_var in ["GOOGLE_API_KEY", "GOOGLE_API_KEY_SELF"]:
        v = os.getenv(single_var, "").strip().strip("'\"")
        if v and v not in keys:
            keys.append(v)
    return keys

_gemini_keys = _get_gemini_key_list()
_GEMINI_CONCURRENCY = threading.Semaphore(max(len(_gemini_keys), 1))


# ---------------------------------------------------------------------------
# Key rotation helper
# ---------------------------------------------------------------------------

class _KeyPool:
    """Round-robin key pool. On 429, rotates to the next key."""
    def __init__(self, keys: list[str]):
        self._keys = [k.strip().strip("'\"") for k in keys if k.strip().strip("'\"")]
        self._idx = 0
        self._lock = threading.Lock()

    def current(self) -> str | None:
        if not self._keys:
            return None
        return self._keys[self._idx % len(self._keys)]

    def rotate(self):
        with self._lock:
            self._idx = (self._idx + 1) % max(len(self._keys), 1)

    def __bool__(self):
        return bool(self._keys)


def _parse_key_list(env_var: str, single_var: str) -> list[str]:
    """Support both GROQ_API_KEYS=k1,k2 (multi) and GROQ_API_KEY=k1 (single)."""
    multi = os.getenv(env_var, "")
    keys = [k.strip().strip("'\"") for k in multi.split(",") if k.strip().strip("'\"")]
    if not keys:
        single = os.getenv(single_var, "")
        if single.strip():
            keys = [single.strip().strip("'\"")]
    return keys


# ---------------------------------------------------------------------------
# Lightweight regex pre-extractor
# Pulls trivial fields from raw text before sending to LLM.
# This lets us shrink the LLM JSON schema and save tokens.
# ---------------------------------------------------------------------------

def _split_items_smart(text: str) -> list[str]:
    """Split by comma or bullet, but ignore commas inside parentheses."""
    items = []
    current = []
    paren_depth = 0
    for char in text:
        if char == "(":
            paren_depth += 1
            current.append(char)
        elif char == ")":
            paren_depth = max(0, paren_depth - 1)
            current.append(char)
        elif char in [",", "•", "|", "▪", "·"] and paren_depth == 0:
            item = "".join(current).strip()
            if item:
                items.append(item)
            current = []
        else:
            current.append(char)
    last = "".join(current).strip()
    if last:
        items.append(last)
    return items


PROSE_PATTERNS = [
    re.compile(r"\b(?:skills?\s+(?:for|in)|experience\s+(?:in|with)|knowledge\s+of|validation\s+across|understanding\s+of|working\s+knowledge|hands[- ]on|proficient\s+in|familiar\s+with|responsible\s+for|worked\s+(?:on|with)|used\s+(?:for|to|in)|built\s+(?:with|using)|expertise\s+in|ability\s+to|exposure\s+to)\b", re.I),
    re.compile(r"\b(?:across|within|between|among|throughout|such\s+as|as\s+well\s+as)\b", re.I),
]
TRAILING_GENERIC_PAT = re.compile(r"^(.*?)\s+(?:databases?|technologies|tools?|environments?)$", re.I)
ADJECTIVES_KEEP = {"relational", "distributed", "embedded", "in-memory", "graph", "object-oriented", "cloud", "nosql"}
LEADING_NOISE_PAT = re.compile(r"^(?:and|or|with|for|in|across|using|including|such\s+as|to|of|&)\s+", re.I)
SECTION_NOISE = {
    "phone", "email", "address", "education", "experience", "work history",
    "summary", "objective", "references", "projects", "certifications",
    "hobbies", "personal details", "profile", "curriculum vitae", "resume"
}


def _clean_and_validate_skill(item: str) -> str | None:
    """
    Sanitize and validate a candidate skill:
    - Strips surrounding bullets, punctuation, and whitespace
    - Strips leading noise words/conjunctions (e.g., 'and MySQL' -> 'MySQL')
    - Cleans trailing generic nouns (e.g., 'MySQL databases' -> 'MySQL')
    - Rejects prose descriptions or sentence fragments (e.g., 'skills for backend validation across Oracle')
    - Rejects strings with > 4 words or pure numbers/symbols
    """
    if not item or not isinstance(item, str):
        return None

    # Strip surrounding bullets, punctuation, whitespace
    cand = item.strip().strip(".,;:!?-•*▪►● \t\n\r")

    # Strip leading noise / conjunctions / prepositions
    cand = LEADING_NOISE_PAT.sub("", cand).strip().strip(".,;:!?-•*▪►● \t\n\r")

    # Length constraints
    if not cand or len(cand) < 2 or len(cand) > 45:
        return None

    # Reject if too many words (real skills are 1-4 words)
    words = cand.split()
    if len(words) > 4:
        return None

    # Reject section titles / resume structure labels
    if cand.lower() in SECTION_NOISE:
        return None

    # Check for prose / sentence fragment patterns
    for pat in PROSE_PATTERNS:
        if pat.search(cand):
            return None

    # Clean trailing generic noun ("MySQL databases" -> "MySQL", "Selenium tool" -> "Selenium")
    m = TRAILING_GENERIC_PAT.match(cand)
    if m:
        rem = m.group(1).strip()
        if len(rem) >= 2 and rem.lower() not in ADJECTIVES_KEEP:
            cand = rem

    # Reject pure numbers or special symbols
    if re.match(r"^[\d\W_]+$", cand):
        return None

    return cand


def _extract_skills_section(text: str) -> list[str]:
    """
    Deterministically scan resume text for skills declarations
    (e.g., 'Technical Skills', 'Core Competencies', 'Skills & Tools')
    and parse multi-category bulleted/comma-separated lists.
    Captures methodologies, domain knowledge, QA practices, frameworks, and tools.
    """
    skills = set()
    section_patterns = [
        r"(?:TECHNICAL\s+SKILLS|CORE\s+COMPETENCIES|SKILLS\s*&?\s*TOOLS|SKILLS|AREAS\s+OF\s+EXPERTISE)[\s\S]*?(?=(?:EXPERIENCE|PROFESSIONAL\s+EXPERIENCE|WORK\s+HISTORY|EMPLOYMENT|EDUCATION|PROJECTS|$))"
    ]
    section_text = ""
    for pat in section_patterns:
        m = re.search(pat, text, re.I)
        if m:
            section_text = m.group(0)
            break

    source_text = section_text if section_text else text

    for line in source_text.splitlines():
        line = line.strip()
        if not line or len(line) < 3:
            continue

        # Strip leading bullets or numbering
        line = re.sub(r"^[\s•\*\-▪►●\d\.\)]+", "", line).strip()

        # Check for Category: Items structure
        if ":" in line:
            cat, rest = line.split(":", 1)
            cleaned_cat = _clean_and_validate_skill(cat)
            if cleaned_cat and cleaned_cat.lower() not in SECTION_NOISE:
                skills.add(cleaned_cat)
            raw_items = _split_items_smart(rest)
        else:
            raw_items = _split_items_smart(line)

        for item in raw_items:
            item = item.strip()
            if not item:
                continue

            # Handle parenthetical: "AWS (S3, Glue, Lambda)" or "User Acceptance Testing (UAT)"
            m_paren = re.search(r"^(.*?)\s*\((.*?)\)$", item)
            if m_paren:
                head = _clean_and_validate_skill(m_paren.group(1))
                if head:
                    skills.add(head)
                inside = m_paren.group(2).strip()
                for sub in re.split(r"[,/]+", inside):
                    cleaned_sub = _clean_and_validate_skill(sub)
                    if cleaned_sub:
                        skills.add(cleaned_sub)
                cleaned_item = _clean_and_validate_skill(item)
                if cleaned_item:
                    skills.add(cleaned_item)
                continue

            # Handle slashes: "Agile/Scrum", "SDLC/STLC", "CI/CD"
            if "/" in item and not item.lower().startswith("http"):
                parts = [p.strip() for p in item.split("/")]
                if len(parts) >= 2 and all(len(p.split()) == 1 for p in parts):
                    for p in parts:
                        cleaned_p = _clean_and_validate_skill(p)
                        if cleaned_p:
                            skills.add(cleaned_p)
                cleaned_item = _clean_and_validate_skill(item)
                if cleaned_item:
                    skills.add(cleaned_item)
                continue

            cleaned = _clean_and_validate_skill(item)
            if cleaned:
                skills.add(cleaned)

    return sorted(skills)


def _pre_extract(text: str) -> dict:
    """Extract easy fields locally so the LLM focuses on hard ones only."""
    out = {}
    # Email
    m = re.search(r'[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}', text)
    if m:
        out["email"] = m.group(0).lower()

    # Phone — handles +91 9876543210, (123) 456-7890, 123-456-7890, etc.
    m = re.search(
        r'(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{4,5}',
        text
    )
    if m:
        candidate = re.sub(r'[^\d+]', '', m.group(0))
        if 8 <= len(candidate) <= 15:
            out["phone"] = m.group(0).strip()

    # LinkedIn
    m = re.search(r'linkedin\.com/in/[\w\-]+', text, re.I)
    if m:
        out["linkedin_url"] = "https://" + m.group(0)

    # GitHub
    m = re.search(r'github\.com/[\w\-]+', text, re.I)
    if m:
        out["github_url"] = "https://" + m.group(0)

    # Portfolio / personal website (not linkedin/github)
    m = re.search(
        r'https?://(?!(?:www\.)?(?:linkedin|github|twitter|facebook|instagram))[\w\-]+\.[\w.\-/]+',
        text, re.I
    )
    if m:
        out["portfolio_url"] = m.group(0).rstrip("/.,")

    # Total years of experience (enhanced to handle years/months and total experience labels)
    experience_years = 0.0
    
    # Pattern 1: X Years Y Months
    m_ym = re.search(r'(\d+)\s*years?\s*(?:and\s+)?(\d+)\s*months?', text, re.I)
    if m_ym:
        try:
            years = float(m_ym.group(1))
            months = float(m_ym.group(2))
            experience_years = round(years + months / 12.0, 1)
        except ValueError:
            pass
            
    # Pattern 2: Total Experience: X Years / X.Y Years
    if experience_years == 0.0:
        m_tot = re.search(r'(?:total\s+)?experience\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*years?', text, re.I)
        if m_tot:
            try:
                experience_years = round(float(m_tot.group(1)), 1)
            except ValueError:
                pass
                
    # Pattern 3: X+ Years Exp
    if experience_years == 0.0:
        m_exp = re.search(r'(\d+(?:\.\d+)?)\s*\+?\s*years?\s+(?:of\s+)?(?:experience|exp)\b', text, re.I)
        if m_exp:
            try:
                experience_years = round(float(m_exp.group(1)), 1)
            except ValueError:
                pass

    out["experience_years_total"] = experience_years

    # Deterministic multi-category skills extraction
    detected_skills = _extract_skills_section(text)
    if detected_skills:
        out["skills"] = detected_skills

    return out


# ---------------------------------------------------------------------------
# Main AI Service
# ---------------------------------------------------------------------------

class AIService:
    """
    Provider-independent AI service with:
    - Multi-key rotation pools (GROQ_API_KEYS / GEMINI_API_KEYS)
    - Global token-bucket rate limiters per provider
    - Regex pre-extraction to cut LLM token usage
    - Offline rule-based fallback parser
    """

    def __init__(self):
        self.provider = os.getenv("AI_PROVIDER", "mock").lower()
        # Primary Gemini model
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite").strip()
        # Fallback Gemini models when primary hits 503/429
        fallback_cfg = os.getenv("GEMINI_FALLBACK_MODEL", os.getenv("GEMINI_FALLBACK_MODELS", "gemini-2.5-flash,gemini-2.5-flash-lite,gemini-3.5-flash-lite"))
        self.gemini_fallback_models = [m.strip().strip("'\"") for m in fallback_cfg.split(",") if m.strip().strip("'\"")]

        # Groq model and fallbacks
        self.groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b").strip()
        groq_fb_cfg = os.getenv("GROQ_FALLBACK_MODELS", os.getenv("GROQ_FALLBACK_MODEL", "qwen/qwen3.8-27b,openai/gpt-oss-120b"))
        self.groq_fallback_models = [m.strip().strip("'\"") for m in groq_fb_cfg.split(",") if m.strip().strip("'\"")]

        # --- Key pools (support both single and comma-separated multi-key) ---
        self._groq_pool   = _KeyPool(_parse_key_list("GROQ_API_KEYS",   "GROQ_API_KEY"))
        self._gemini_pool = _KeyPool(_get_gemini_key_list())

        # Backward-compat single-key references used by _sanitize_error
        self.openai_api_key  = os.getenv("OPENAI_API_KEY")
        self.groq_api_key    = self._groq_pool.current()
        self.gemini_api_key  = self._gemini_pool.current()

        # Gemini SDK client (uses current key, re-created on rotation)
        self._gemini_client_cache: dict = {}
        self._gemini_client_lock = threading.Lock()

        # OpenAI async client
        if self.openai_api_key:
            try:
                from openai import AsyncOpenAI
                self.openai_client = AsyncOpenAI(api_key=self.openai_api_key)
                self.openai_model  = "gpt-4o-mini"
            except Exception:
                self.openai_client = None
        else:
            self.openai_client = None

        # Groq SDK client (kept for async path)
        self.groq_client = None
        if self.groq_api_key:
            try:
                from groq import Groq
                self.groq_client = Groq(api_key=self.groq_api_key)
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_gemini_client(self, api_key: str):
        """Return a cached or freshly-created genai.Client for the given key."""
        with self._gemini_client_lock:
            if api_key not in self._gemini_client_cache:
                try:
                    from google import genai
                    self._gemini_client_cache[api_key] = genai.Client(api_key=api_key)
                except Exception:
                    self._gemini_client_cache[api_key] = None
            return self._gemini_client_cache[api_key]

    def _sanitize_error(self, err) -> str:
        err_str = str(err)
        secrets = [
            self.openai_api_key,
            *self._groq_pool._keys,
            *self._gemini_pool._keys,
        ]
        for key in secrets:
            if key and len(key) > 5 and key in err_str:
                err_str = err_str.replace(key, "******")
        return err_str

    @staticmethod
    def _is_rate_limit(err_str: str) -> bool:
        triggers = ['429', 'RESOURCE_EXHAUSTED', 'rate_limit', '503', 'UNAVAILABLE',
                    '413', 'timed out', 'ConnectionError', 'Timeout', 'nodename nor servname']
        return any(t in err_str for t in triggers)

    @staticmethod
    def _compress_text(text: str, max_chars: int = 5000) -> str:
        """Truncate resume text to max_chars, keeping the beginning (most info-dense)."""
        return text[:max_chars]

    @staticmethod
    def _build_compressed_prompt(resume_text: str, pre: dict) -> str:
        """
        Build the user prompt injecting pre-extracted fields so the LLM
        skips them and focuses only on hard-to-parse sections.
        Also truncates to 5000 chars to minimize token cost.
        """
        known_items = {k: v for k, v in pre.items() if v and k != "skills"}
        known = ", ".join(f"{k}={v!r}" for k, v in known_items.items())
        hint = f"\n[PRE-EXTRACTED — do NOT re-derive these, just copy them into the JSON]: {known}\n" if known else ""
        if pre.get("skills"):
            sample = ", ".join(pre["skills"][:25])
            hint += f"[PRE-EXTRACTED SKILLS ({len(pre['skills'])} detected in resume — preserve and expand in p_sk / s_sk)]: {sample} ...\n\n"
        return f"Parse this resume and return JSON:{hint}\n{resume_text[:5000]}"

    @staticmethod
    def build_batched_prompt(items: list[dict]) -> str:
        """
        Build a batched user prompt for multiple resumes using XML tags.
        items: [{"id": 123, "text": "...", "pre": {...}}, ...]
        """
        parts = ["Parse the following resumes and return a single JSON object mapping ID to parsed data.\n"]
        for item in items:
            pre_dict = item.get("pre", {})
            known_items = {k: v for k, v in pre_dict.items() if v and k != "skills"}
            known = ", ".join(f"{k}={v!r}" for k, v in known_items.items())
            hint = f"\n[PRE-EXTRACTED]: {known}" if known else ""
            if pre_dict.get("skills"):
                hint += f" | {len(pre_dict['skills'])} skills detected in text"
            # Truncate to 15000 characters to ensure we capture Education/Certifications at the bottom
            text = item.get("text", "")[:15000]
            parts.append(f'<resume id="{item["id"]}">{hint}\n{text}\n</resume>')
        return "\n".join(parts)

    # ------------------------------------------------------------------
    # ASYNC path (single uploads, scoring, offer letters)
    # ------------------------------------------------------------------

    async def generate_json(self, prompt: str, system_prompt: str = "", provider_override: str = None) -> dict:
        provider = provider_override or self.provider

        if provider == "mock":
            return self._mock_json_response(prompt)

        elif provider == "groq":
            num_keys = len(self._groq_pool._keys)
            if not self.groq_client and num_keys == 0:
                if len(self._gemini_pool._keys) > 0 and provider_override != "gemini":
                    return await self.generate_json(prompt, system_prompt, provider_override="gemini")
                return self._mock_json_response(prompt)

            models_to_try = [self.groq_model]
            for m in self.groq_fallback_models:
                if m and m not in models_to_try:
                    models_to_try.append(m)
            for m in ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"]:
                if m not in models_to_try:
                    models_to_try.append(m)

            _GROQ_LIMITER.acquire()
            if self.groq_client:
                for g_model in models_to_try:
                    try:
                        response = self.groq_client.chat.completions.create(
                            model=g_model,
                            messages=[
                                {"role": "system", "content": system_prompt},
                                {"role": "user",   "content": prompt},
                            ],
                            temperature=0.1,
                            max_tokens=2048,
                            response_format={"type": "json_object"},
                        )
                        return json.loads(response.choices[0].message.content.strip())
                    except Exception as e:
                        err = self._sanitize_error(e)
                        if any(k in err.lower() for k in ['404', 'decommissioned', 'not_found', 'does not exist', 'invalid_request_error', 'deprecated']):
                            print(f"Groq async model {g_model} unavailable or decommissioned: {err[:80]}. Trying next fallback model...")
                            continue
                        print(f"Groq async failed: {err[:100]}. Falling back to Gemini...")
                        break

            if len(self._gemini_pool._keys) > 0 and provider_override != "gemini":
                print("Groq async exhausted. Falling back to Gemini...", flush=True)
                return await self.generate_json(prompt, system_prompt, provider_override="gemini")
            return {}

        elif provider == "openai":
            if not self.openai_client:
                return await self.generate_json(prompt, system_prompt, provider_override="gemini")
            try:
                response = await self.openai_client.chat.completions.create(
                    model=self.openai_model,
                    messages=[
                        {"role": "system", "content": system_prompt + "\n\nIMPORTANT: Return ONLY valid JSON."},
                        {"role": "user",   "content": prompt},
                    ],
                    response_format={"type": "json_object"},
                )
                return json.loads(response.choices[0].message.content)
            except Exception as e:
                print(f"OpenAI failed: {self._sanitize_error(e)}. Falling back to Gemini...")
                return await self.generate_json(prompt, system_prompt, provider_override="gemini")

        elif provider == "gemini":
            num_keys = len(self._gemini_pool._keys)
            if num_keys == 0:
                if (self.groq_client or len(self._groq_pool._keys) > 0) and provider_override != "groq":
                    print("Gemini async: no keys. Falling back to Groq...", flush=True)
                    return await self.generate_json(prompt, system_prompt, provider_override="groq")
                return self._mock_json_response(prompt)

            models_to_try = [self.gemini_model]
            for fb in self.gemini_fallback_models:
                if fb and fb not in models_to_try:
                    models_to_try.append(fb)

            last_err = "No attempt made."
            for attempt in range(max(num_keys, 1)):
                key = self._gemini_pool.current()
                if not key:
                    break
                _GEMINI_LIMITER.acquire()
                client = self._get_gemini_client(key)
                full_prompt = f"{system_prompt}\n\n{prompt}\n\nIMPORTANT: Return ONLY valid JSON. No markdown."
                if client:
                    for model_name in models_to_try:
                        try:
                            from google.genai import types as _genai_types
                            _cfg = _genai_types.GenerateContentConfig(
                                response_mime_type="application/json",
                                max_output_tokens=8192,
                            )
                            response = client.models.generate_content(model=model_name, contents=full_prompt, config=_cfg)
                            clean = response.text.replace('```json', '').replace('```', '').strip()
                            return json.loads(clean)
                        except Exception as e:
                            err = self._sanitize_error(e)
                            if '404' in err or 'NOT_FOUND' in err:
                                print(f"Gemini async ({model_name}) not found (404), skipping model.")
                                continue
                            last_err = err
                            if self._is_rate_limit(err):
                                print(f"Gemini async ({model_name}) 429/503 busy on key[{self._gemini_pool._idx}]. Error: {err[:120]}. Trying fallback...")
                                continue
                            print(f"Gemini async failed: {err[:100]}")
                            break
                self._gemini_pool.rotate()

            if (self.groq_client or len(self._groq_pool._keys) > 0) and provider_override != "groq":
                print("Gemini async exhausted. Falling back to Groq...", flush=True)
                return await self.generate_json(prompt, system_prompt, provider_override="groq")
            raise RuntimeError(f"All Gemini keys exhausted (503 UNAVAILABLE / rate limited on {self.gemini_model}). Last error: {last_err}")
        return {}

    # ------------------------------------------------------------------
    # SYNC path (bulk workers — called inside run_in_executor)
    # ------------------------------------------------------------------

    def generate_json_sync(self, prompt: str, system_prompt: str = "", provider_override: str = None, is_active_fn: callable = None) -> dict:
        """
        Synchronous LLM call for bulk workers.
        Provider resolution: provider_override → BULK_AI_PROVIDER → AI_PROVIDER

        Features:
        - Per-provider token-bucket rate limiting (global, shared across workers)
        - Key rotation and retry loops across the entire key pool on 429 / 503
        - Gemini SDK → REST fallback per key, with fallback to gemini-2.5-flash / gemini-3.5-flash-lite on 503/429
        - Seamless bi-directional failover between Groq and Gemini
        - Immediate cancellation/pause checking via is_active_fn
        """
        import requests as _req

        if is_active_fn and not is_active_fn():
            raise InterruptedError("Job paused or cancelled")

        provider = provider_override or os.getenv("BULK_AI_PROVIDER", self.provider)

        # ── Groq ─────────────────────────────────────────────────────────────
        if provider == "groq":
            num_keys = len(self._groq_pool._keys)
            if num_keys == 0:
                if len(self._gemini_pool._keys) > 0 and provider_override != "gemini":
                    print("Groq: no API keys available. Falling back to Gemini...", flush=True)
                    return self.generate_json_sync(prompt, system_prompt, provider_override="gemini", is_active_fn=is_active_fn)
                raise RuntimeError("Groq: no API key available. All AI providers exhausted.")

            models_to_try = [self.groq_model]
            for m in self.groq_fallback_models:
                if m and m not in models_to_try:
                    models_to_try.append(m)
            for m in ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"]:
                if m not in models_to_try:
                    models_to_try.append(m)

            last_err = "No attempt made."
            for attempt in range(max(num_keys, 1)):
                if is_active_fn and not is_active_fn():
                    raise InterruptedError("Job paused or cancelled")

                key = self._groq_pool.current()
                if not key:
                    break

                for g_model in models_to_try:
                    if is_active_fn and not is_active_fn():
                        raise InterruptedError("Job paused or cancelled")

                    _GROQ_LIMITER.acquire()   # block until we have capacity
                    try:
                        print(f"Calling Groq REST ({g_model}) on key[{self._groq_pool._idx}]...", flush=True)
                        resp = _req.post(
                            "https://api.groq.com/openai/v1/chat/completions",
                            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
                            json={
                                "model": g_model,
                                "messages": [
                                    {"role": "system", "content": system_prompt},
                                    {"role": "user",   "content": prompt},
                                ],
                                "temperature": 0.1,
                                "max_tokens": 2048,
                                "response_format": {"type": "json_object"},
                            },
                            timeout=40,
                        )
                        resp.raise_for_status()
                        content = resp.json()["choices"][0]["message"]["content"].strip()
                        m = re.search(r'(\{.*\}|\[.*\])', content, re.DOTALL)
                        parsed = json.loads(m.group(1) if m else content)
                        print(f"Groq REST ({g_model}) success!", flush=True)
                        return parsed

                    except Exception as e:
                        err = self._sanitize_error(e)
                        last_err = err
                        if any(k in err.lower() for k in ['404', 'decommissioned', 'not_found', 'does not exist', 'invalid_request_error', 'deprecated']):
                            print(f"Groq model {g_model} unavailable or decommissioned: {err[:80]}. Trying next fallback model...", flush=True)
                            continue
                        if self._is_rate_limit(err):
                            print(f"Groq 429 on key[{self._groq_pool._idx}]. Rotating key...", flush=True)
                            self._groq_pool.rotate()
                            break
                        else:
                            print(f"Groq error ({g_model}): {err[:80]}. Trying next...", flush=True)
                            continue

                self._groq_pool.rotate()

            # If all Groq keys/models failed or we broke out, fall back to Gemini
            if len(self._gemini_pool._keys) > 0 and provider_override != "gemini":
                print("All Groq keys failed or exhausted. Falling back to Gemini...", flush=True)
                return self.generate_json_sync(prompt, system_prompt, provider_override="gemini", is_active_fn=is_active_fn)
            raise RuntimeError(f"All Groq keys failed or exhausted. Last error: {last_err}")

        # ── Gemini ───────────────────────────────────────────────────────────
        elif provider == "gemini":
            num_keys = len(self._gemini_pool._keys)
            if num_keys == 0:
                if len(self._groq_pool._keys) > 0 and provider_override != "groq":
                    print("Gemini: no API key available. Falling back to Groq...", flush=True)
                    return self.generate_json_sync(prompt, system_prompt, provider_override="groq", is_active_fn=is_active_fn)
                raise RuntimeError("Gemini: no API key available. All AI providers exhausted.")

            models_to_try = [self.gemini_model]
            for fb in self.gemini_fallback_models:
                if fb and fb not in models_to_try:
                    models_to_try.append(fb)

            last_err = "No attempt made."
            max_rounds = 3  # Retry keys across 3 rounds if demand spikes (503) or rate limits occur

            for round_idx in range(max_rounds):
                for attempt in range(num_keys):
                    if is_active_fn and not is_active_fn():
                        raise InterruptedError("Job paused or cancelled")

                    key = self._gemini_pool.current()
                    if not key:
                        break

                    _GEMINI_LIMITER.acquire()   # block until we have capacity

                    full_prompt = (
                        f"{system_prompt}\n\n{prompt}\n\n"
                        "IMPORTANT: Return ONLY valid JSON. No markdown, no backticks, no explanation."
                    )

                    # Acquire the semaphore to prevent concurrent requests per key
                    with _GEMINI_CONCURRENCY:
                        parsed_result = None

                        for model_name in models_to_try:
                            if is_active_fn and not is_active_fn():
                                raise InterruptedError("Job paused or cancelled")

                            # 1. Try SDK first
                            client = self._get_gemini_client(key)
                            if client:
                                try:
                                    print(f"Calling Gemini SDK ({model_name}) on key[{self._gemini_pool._idx}]...", flush=True)
                                    from google.genai import types as _genai_types
                                    _cfg = _genai_types.GenerateContentConfig(
                                        response_mime_type="application/json",
                                        max_output_tokens=8192,
                                    )
                                    response = client.models.generate_content(model=model_name, contents=full_prompt, config=_cfg)
                                    clean = response.text.replace('```json', '').replace('```', '').strip()
                                    parsed_result = json.loads(clean)
                                    print(f"Gemini SDK ({model_name}) success!", flush=True)
                                    break
                                except Exception as sdk_err:
                                    err = self._sanitize_error(sdk_err)
                                    if '404' in err or 'NOT_FOUND' in err:
                                        print(f"Gemini SDK ({model_name}) not found (404), skipping model.")
                                        continue
                                    last_err = err
                                    if self._is_rate_limit(err):
                                        print(f"Gemini SDK ({model_name}) 429/503 busy on key[{self._gemini_pool._idx}]. Error: {err[:150]}. Trying fallback model...")
                                        continue
                                    else:
                                        print(f"Gemini SDK ({model_name}) error: {err[:80]}. Trying REST...")

                            # 2. REST fallback
                            try:
                                if is_active_fn and not is_active_fn():
                                    raise InterruptedError("Job paused or cancelled")

                                print(f"Calling Gemini REST ({model_name}) on key[{self._gemini_pool._idx}]...", flush=True)
                                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
                                resp = _req.post(
                                    url,
                                    json={
                                        "contents": [{"parts": [{"text": full_prompt}]}],
                                        "generationConfig": {
                                            "responseMimeType": "application/json",
                                            "maxOutputTokens": 8192
                                        }
                                    },
                                    timeout=60
                                )
                                resp.raise_for_status()
                                res_json = resp.json()
                                if "candidates" in res_json and res_json["candidates"]:
                                    text = res_json["candidates"][0]["content"]["parts"][0]["text"]
                                    clean = text.replace('```json', '').replace('```', '').strip()
                                    parsed_result = json.loads(clean)
                                    print(f"Gemini REST ({model_name}) success!", flush=True)
                                    break
                                else:
                                    raise RuntimeError(f"Gemini REST unexpected payload: {res_json}")
                            except Exception as e:
                                err = self._sanitize_error(e)
                                if '404' in err or 'NOT_FOUND' in err:
                                    print(f"Gemini REST ({model_name}) not found (404), skipping model.")
                                    continue
                                last_err = err
                                if self._is_rate_limit(err):
                                    print(f"Gemini REST ({model_name}) 429/503 busy on key[{self._gemini_pool._idx}]. Error: {err[:150]}. Trying fallback model...")
                                else:
                                    print(f"Gemini REST ({model_name}) error: {err[:100]}. Rotating key...")
                                continue

                        if parsed_result is not None:
                            return parsed_result

                        # If all models on this key were busy or failed, rotate to next key
                        self._gemini_pool.rotate()

                # End of a full round through all keys. If not finished, wait briefly before next round (demand spikes are temporary)
                if round_idx < max_rounds - 1:
                    if is_active_fn and not is_active_fn():
                        raise InterruptedError("Job paused or cancelled")
                    sleep_secs = 2.0 * (round_idx + 1)
                    print(f"All {num_keys} Gemini key(s) busy/503 in round {round_idx + 1}. Backing off {sleep_secs}s before retry round {round_idx + 2}...")
                    time.sleep(sleep_secs)

            if len(self._groq_pool._keys) > 0 and provider_override != "groq":
                print("All Gemini keys exhausted (503 / rate limited / quota). Falling back to Groq...", flush=True)
                return self.generate_json_sync(prompt, system_prompt, provider_override="groq", is_active_fn=is_active_fn)
            raise RuntimeError(f"All Gemini keys exhausted (503 UNAVAILABLE / rate limited on {self.gemini_model}). Last error: {last_err}")

        elif provider == "openai":
            raise RuntimeError("OpenAI async client cannot be used in sync workers. Set BULK_AI_PROVIDER=groq or gemini.")

        return self._mock_json_response(prompt)

    # ------------------------------------------------------------------
    # Public helpers used by candidate_service
    # ------------------------------------------------------------------

    def pre_extract_resume(self, text: str) -> dict:
        """Extract trivial fields locally. Call this before generate_json_sync."""
        return _pre_extract(text)

    def build_bulk_prompt(self, resume_text: str, pre: dict | None = None) -> str:
        """Build compressed prompt with pre-extracted hints to save tokens."""
        return self._build_compressed_prompt(resume_text, pre or {})

    # ------------------------------------------------------------------
    # Mock
    # ------------------------------------------------------------------

    def _mock_json_response(self, prompt: str) -> dict:
        if "resume" in prompt.lower() or "cv" in prompt.lower():
            return {
                "n": "Jane Doe",
                "e": "jane.doe@example.com",
                "p": "+1 555-0198",
                "l": "San Francisco, CA",
                "d": "Senior React Developer",
                "x": 5.5,
                "ln": "https://linkedin.com/in/janedoe",
                "pt": "https://janedoe.dev",
                "s": "Mock candidate with 5+ years of React experience.",
                "p_sk": ["React", "TypeScript", "JavaScript", "HTML5"],
                "s_sk": ["FastAPI", "Git", "Docker", "AWS"],
                "exp": [
                    {"c": "Tech Innovators Inc.", "r": "Senior React Developer", "s": "2021-01", "e": "Present"}
                ],
                "edu": [
                    {"d": "Bachelors in Computer Science", "c": "State University", "s": "2014-08", "e": "2018-05"}
                ],
                "cert": []
            }
        return {}
