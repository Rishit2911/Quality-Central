"""
Phygitron 360 — ATS Scoring Engine
===================================
Pure Python deterministic skill-matching engine for candidate-to-role fit scoring.
No external dependencies, no DB access — all logic is stateless and testable.

Scoring Model (Two-Bucket):
- Required skills  (levels: critical / expert / advanced)  → out of 75 points
- Preferred skills (levels: intermediate / beginner)        → out of 25 points
- Formula: required_ratio × 75 + preferred_ratio × 25 = final score (0–100)
- Ratio = effective_matches / total_skills_in_bucket
          (exact/near match = 1.0 credit, partial match = similarity score credit)

Skill Matching — 4 Layers:
  1. Exact string match after canonicalization         → 1.0
  2. Word-boundary substring match                    → 0.95
  3. Full token-set overlap                           → 0.9
  4. Prefix/suffix token matching (ReactJS ↔ React)   → 0.75
  5. Partial token overlap                            → 0.1–0.65
"""
import re
from typing import Optional, List, Dict, Any

# ---------------------------------------------------------------------------
# Level config
# ---------------------------------------------------------------------------

LEVEL_WEIGHTS = {
    "critical":     5,
    "expert":       4,
    "advanced":     3,
    "intermediate": 2,
    "beginner":     1,
}

_COMPAT_MAP = {
    "required":  "expert",
    "optional":  "intermediate",
    "preferred": "intermediate",
}

REQUIRED_LEVELS = {"critical", "expert", "advanced"}

NOISE_TOKENS = {"and", "or", "the", "of", "for", "with", "in", "at", "a", "an", "to", "on", "is", "are"}
MIN_TOKEN_LEN  = 2
PREFIX_MIN_LEN = 4   # minimum chars for a prefix hit to count

# ---------------------------------------------------------------------------
# Role fallback presets (used when job role has no skills defined)
# ---------------------------------------------------------------------------

ROLE_SKILL_PRESETS = {
    "cyber":    ["Cyber Security", "Network Security", "SIEM", "Penetration Testing", "Linux", "Python"],
    "security": ["Cyber Security", "Network Security", "SIEM", "Penetration Testing", "Linux", "Python"],
    "ai":       ["Python", "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "NLP"],
    "ml":       ["Python", "Machine Learning", "TensorFlow", "PyTorch", "Scikit-learn", "SQL"],
    "data":     ["Python", "SQL", "Pandas", "NumPy", "Power BI", "Machine Learning"],
    "frontend": ["JavaScript", "React", "HTML", "CSS", "TypeScript"],
    "backend":  ["Python", "FastAPI", "SQL", "API", "Docker"],
}

# ---------------------------------------------------------------------------
# Skill alias map — maps common variants/abbreviations to canonical forms.
# Both sides of a comparison are canonicalized before matching.
# Key rules:
#   - All keys must be lowercase with punctuation stripped (dots, dashes, slashes)
#   - Values are the canonical lowercase form
# ---------------------------------------------------------------------------

SKILL_ALIASES: Dict[str, str] = {
    # ── JavaScript ecosystem ─────────────────────────────────────────────────
    "js":             "javascript",
    "es6":            "javascript",
    "es2015":         "javascript",
    "vanillajs":      "javascript",
    "vanilla js":     "javascript",
    "ts":             "typescript",
    "reactjs":        "react",
    "react js":       "react",
    "vuejs":          "vue",
    "vue js":         "vue",
    "vue3":           "vue",
    "vue2":           "vue",
    "angularjs":      "angular",
    "angular js":     "angular",
    "angular2":       "angular",
    "nodejs":         "node",
    "node js":        "node",
    "nextjs":         "next",
    "next js":        "next",
    "nuxtjs":         "nuxt",
    "nuxt js":        "nuxt",
    "expressjs":      "express",
    "express js":     "express",
    "sveltejs":       "svelte",
    "svelte js":      "svelte",
    "jquery":         "jquery",
    "jq":             "jquery",
    "html5":          "html",
    "css3":           "css",
    "sass":           "scss",

    # ── Python ecosystem ─────────────────────────────────────────────────────
    "py":                       "python",
    "python3":                  "python",
    "sklearn":                  "scikit-learn",
    "scikit learn":             "scikit-learn",
    "tf":                       "tensorflow",
    "tensor flow":              "tensorflow",
    "torch":                    "pytorch",
    "keras":                    "keras",
    "hf":                       "hugging face",
    "huggingface":              "hugging face",
    "langchain":                "langchain",
    "fastapi":                  "fastapi",
    "flask":                    "flask",
    "django":                   "django",

    # ── ML / AI abbreviations ─────────────────────────────────────────────────
    "ml":               "machine learning",
    "dl":               "deep learning",
    "nlp":              "natural language processing",
    "cv":               "computer vision",
    "rl":               "reinforcement learning",
    "llm":              "large language models",
    "llms":             "large language models",
    "genai":            "generative ai",
    "gen ai":           "generative ai",
    "rag":              "retrieval augmented generation",
    "mlops":            "mlops",
    "aiops":            "aiops",

    # ── Cloud ────────────────────────────────────────────────────────────────
    "aws":                      "aws",
    "amazon web services":      "aws",
    "gcp":                      "google cloud",
    "google cloud platform":    "google cloud",
    "azure":                    "azure",
    "microsoft azure":          "azure",
    "ms azure":                 "azure",

    # ── Databases ────────────────────────────────────────────────────────────
    "postgres":         "postgresql",
    "postgre":          "postgresql",
    "mongo":            "mongodb",
    "dynamo":           "dynamodb",
    "dynamo db":        "dynamodb",
    "elastic":          "elasticsearch",
    "es":               "elasticsearch",
    "mssql":            "sql server",
    "ms sql":           "sql server",
    "microsoft sql server": "sql server",
    "mysql":            "mysql",
    "mariadb":          "mysql",
    "redis":            "redis",
    "cassandra":        "cassandra",
    "couch":            "couchdb",
    "couchdb":          "couchdb",
    "neo4j":            "neo4j",
    "clickhouse":       "clickhouse",

    # ── DevOps / Infra ───────────────────────────────────────────────────────
    "k8s":              "kubernetes",
    "kube":             "kubernetes",
    "kubectl":          "kubernetes",
    "terraform":        "terraform",
    "tf infra":         "terraform",
    "ci cd":            "cicd",
    "cicd":             "cicd",
    "gh actions":       "github actions",
    "gha":              "github actions",
    "gitlab ci":        "gitlab",
    "jenkins":          "jenkins",
    "ansible":          "ansible",
    "helm":             "helm",
    "argocd":           "argocd",
    "argo":             "argocd",
    "prometheus":       "prometheus",
    "grafana":          "grafana",
    "elk":              "elasticsearch",

    # ── Security ─────────────────────────────────────────────────────────────
    "pen test":         "penetration testing",
    "pentest":          "penetration testing",
    "pentesting":       "penetration testing",
    "vuln":             "vulnerability assessment",
    "vapt":             "vulnerability assessment",
    "siem":             "siem",
    "soc":              "soc",
    "devsecops":        "devsecops",

    # ── Data / BI ────────────────────────────────────────────────────────────
    "bi":               "business intelligence",
    "powerbi":          "power bi",
    "power-bi":         "power bi",
    "msbi":             "power bi",
    "tableau":          "tableau",
    "looker":           "looker",
    "qlik":             "qlikview",
    "etl":              "etl",
    "elt":              "etl",
    "dbt":              "dbt",
    "airflow":          "airflow",
    "spark":            "apache spark",
    "apache spark":     "apache spark",
    "pyspark":          "apache spark",
    "kafka":            "apache kafka",
    "apache kafka":     "apache kafka",
    "hadoop":           "hadoop",
    "hive":             "hive",
    "presto":           "presto",
    "trino":            "trino",
    "snowflake":        "snowflake",
    "bigquery":         "bigquery",
    "bq":               "bigquery",
    "redshift":         "redshift",
    "databricks":       "databricks",

    # ── General ──────────────────────────────────────────────────────────────
    "rest api":         "rest",
    "restful":          "rest",
    "restful api":      "rest",
    "rest apis":        "rest",
    "gql":              "graphql",
    "grpc":             "grpc",
    "oop":              "object oriented programming",
    "oops":             "object oriented programming",
    "object oriented":  "object oriented programming",
    "solid":            "solid principles",
    "tdd":              "test driven development",
    "bdd":              "behavior driven development",
    "agile scrum":      "agile",
    "scrum":            "agile",
    "kanban":           "agile",
    "bash":             "bash scripting",
    "shell":            "shell scripting",
    "shell script":     "shell scripting",
    "linux":            "linux",
    "unix":             "linux",
    "git":              "git",
    "github":           "git",
    "gitlab":           "git",
    "bitbucket":        "git",
    "jira":             "jira",
    "confluence":       "confluence",
    "figma":            "figma",
    "ui ux":            "ui/ux",
    "uiux":             "ui/ux",
    "ui/ux design":     "ui/ux",
    "user experience":  "ui/ux",
    "user interface":   "ui/ux",
    "microservices":    "microservices",
    "micro services":   "microservices",
    "soa":              "microservices",
    "docker":           "docker",
    "container":        "docker",
    "containerd":       "docker",
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _clean_skill_name(value) -> str:
    return str(value or "").strip()


def _normalise_level(value, fallback: str = "intermediate") -> str:
    raw = str(value or fallback).lower().strip()
    if raw in _COMPAT_MAP:
        return _COMPAT_MAP[raw]
    return raw if raw in LEVEL_WEIGHTS else fallback


def _skill_tokens(value: str) -> set:
    cleaned = "".join(ch.lower() if ch.isalnum() else " " for ch in str(value or ""))
    return {t for t in cleaned.split() if len(t) >= MIN_TOKEN_LEN and t not in NOISE_TOKENS}


def _canonicalize_skill(value: str) -> str:
    """
    Normalize a skill name to its canonical form:
      1. Lowercase + strip whitespace
      2. Try alias lookup directly
      3. Strip punctuation (dots, dashes, slashes) and try again
      4. Fall back to normalized original
    """
    normalized = " ".join(str(value or "").lower().split())
    if normalized in SKILL_ALIASES:
        return SKILL_ALIASES[normalized]
    # Strip punctuation variants: "React.js" → "reactjs", "CI/CD" → "cicd"
    stripped = re.sub(r"[.\-_/\\]", "", normalized)
    stripped = " ".join(stripped.split())
    if stripped in SKILL_ALIASES:
        return SKILL_ALIASES[stripped]
    return normalized


def _skill_similarity(required: str, candidate: str) -> float:
    """
    Return a similarity score in [0.0, 1.0] between two skill name strings.

    Matching layers (in order):
      1. Exact match after canonicalization          → 1.0
      2. Word-boundary substring match               → 0.95
      3. Full token-set overlap                      → 0.90
      4. Prefix/suffix token match (≥ PREFIX_MIN_LEN chars) → 0.75 per hit
      5. Partial token overlap (≥50 % coverage)     → 0.45 – 0.65
      6. Low partial overlap                         → 0.10
    """
    if not required or not candidate:
        return 0.0

    # Canonicalize both sides (alias resolution + punctuation strip)
    req  = _canonicalize_skill(required)
    cand = _canonicalize_skill(candidate)

    # Layer 1 — exact
    if req == cand:
        return 1.0

    # Layer 2 — word-boundary substring
    try:
        if re.search(r"\b" + re.escape(req)  + r"\b", cand) or \
           re.search(r"\b" + re.escape(cand) + r"\b", req):
            return 0.95
    except re.error:
        pass

    # Tokenize
    req_tokens  = _skill_tokens(req)
    cand_tokens = _skill_tokens(cand)
    if not req_tokens or not cand_tokens:
        return 0.0

    # Layer 3 — full token overlap
    overlap = req_tokens & cand_tokens
    if len(overlap) == len(req_tokens):
        return 0.90

    # Layer 4 — prefix/suffix token matching
    # e.g. "react" is a prefix of "reactjs"; "postgres" is a prefix of "postgresql"
    prefix_score = 0.0
    for r_tok in req_tokens:
        if r_tok in cand_tokens:
            continue  # already counted in overlap
        for c_tok in cand_tokens:
            min_len = min(len(r_tok), len(c_tok))
            max_len = max(len(r_tok), len(c_tok))
            # Require prefix to cover ≥60 % of the longer token to avoid Java↔JavaScript false hits
            if (min_len >= PREFIX_MIN_LEN
                    and (min_len / max_len) >= 0.60
                    and (r_tok.startswith(c_tok) or c_tok.startswith(r_tok))):
                prefix_score += 0.75
                break

    # Effective overlap (exact token hits + prefix hits)
    effective = len(overlap) + prefix_score
    if req_tokens:
        coverage = effective / len(req_tokens)
    else:
        coverage = 0.0

    if coverage >= 1.0:
        return 0.90
    if coverage >= 0.5:
        return round(0.45 + 0.20 * coverage, 2)  # 0.55 – 0.65
    if overlap or prefix_score > 0:
        return 0.10

    return 0.0


# ---------------------------------------------------------------------------
# Skill normalisation for job-role required_skills field
# ---------------------------------------------------------------------------

def normalise_required_skills(
    required_skills_raw: Optional[list],
    title: str = "",
    description: str = "",
) -> List[Dict]:
    """
    Parse and normalise the required_skills field from a job role record.
    Accepts JSON string, comma-separated string, list of strings, or list of dicts.
    Falls back to role preset inference from the job title if no skills defined.
    """
    import json

    if isinstance(required_skills_raw, str):
        try:
            required_skills_raw = json.loads(required_skills_raw)
        except Exception:
            if "," in required_skills_raw:
                required_skills_raw = [s.strip() for s in required_skills_raw.split(",") if s.strip()]
            else:
                required_skills_raw = [required_skills_raw]

    normalised = []
    for item in (required_skills_raw or []):
        if isinstance(item, str):
            name, level = item.strip(), "intermediate"
        elif isinstance(item, dict):
            name  = (item.get("skill") or item.get("name") or item.get("title") or item.get("normalized_name") or "").strip()
            level = (item.get("level") or item.get("min_level") or item.get("required_level") or "intermediate")
        else:
            continue
        name = _clean_skill_name(name)
        if name:
            normalised.append({"skill": name, "level": _normalise_level(level)})

    if normalised:
        return normalised

    # Fallback: infer skills from title using presets
    haystack = (title or "").lower()
    inferred  = []
    for keyword, skills in ROLE_SKILL_PRESETS.items():
        if re.search(r"\b" + re.escape(keyword) + r"\b", haystack):
            inferred.extend(skills)

    if not inferred and title:
        inferred = [p.strip() for p in title.replace("/", " ").replace("-", " ").split() if len(p.strip()) > 2]

    seen, fallback = set(), []
    for skill in inferred:
        key = skill.lower()
        if key not in seen:
            fallback.append({"skill": skill, "level": "intermediate"})
            seen.add(key)
    return fallback


# ---------------------------------------------------------------------------
# Experience text fallback matching
# ---------------------------------------------------------------------------

_GENERIC_SKILL_WORDS = {
    'awareness', 'testing', 'development', 'management', 'knowledge',
    'skills', 'experience', 'level', 'practices', 'engineering', 'types'
}

def _check_experience_match(req_name: str, exp_text: str) -> bool:
    """Check if a required skill or its canonical alias/core terms appear as a whole word in experience text."""
    if not req_name or not exp_text:
        return False
    terms = {req_name.strip()}
    canon = _canonicalize_skill(req_name)
    if canon and len(canon) >= 2:
        terms.add(canon)
    for alias, target in SKILL_ALIASES.items():
        if target == canon and len(alias) >= 2:
            terms.add(alias)

    # Core non-generic token extraction (e.g. "HIPAA Awareness" -> "HIPAA", "Shift-Left Testing" -> "Shift-Left")
    tokens = [w for w in re.split(r'[\s/]+', req_name) if w.lower() not in _GENERIC_SKILL_WORDS and len(w) >= 3]
    if tokens:
        stripped_phrase = " ".join(tokens)
        if len(stripped_phrase) >= 3:
            terms.add(stripped_phrase)
        for t in tokens:
            if len(t) >= 4 or t.isupper():
                terms.add(t)

    for term in terms:
        if len(term) < 2:
            continue
        try:
            pattern = r"\b" + re.escape(term) + r"\b"
            if re.search(pattern, exp_text, re.IGNORECASE):
                return True
        except re.error:
            pass
    return False


# ---------------------------------------------------------------------------
# Main scoring function — two-bucket model
# ---------------------------------------------------------------------------

def calculate_role_fit(
    cand_skills: List[Dict],
    req_skills:  List[Dict],
    exp_years:   float = 0.0,
    min_exp:     float = 0.0,
    cand_experience_text: str = "",
    **kwargs,
) -> Dict[str, Any]:
    """
    Score a candidate against a job role using the two-bucket model.

    Buckets:
      • Required  — skills with level in {critical, expert, advanced} → weight 75
      • Preferred — skills with level in {intermediate, beginner}     → weight 25

    Per-bucket ratio = effective_matches / total_skills
      Exact / near match  → 1.0 credit
      Partial match (sim ∈ (0.4, 0.8)) → sim credit (e.g. 0.6 for partial)

    Final score = required_ratio × 75 + preferred_ratio × 25  (capped at 100)

    Returns:
      score           – total 0–100
      required_score  – 0–75 contribution from required skills
      preferred_score – 0–25 contribution from preferred skills
      matched_skills  – list of fully matched skill names
      missing_skills  – list of unmatched skill names
      partial_skills  – list of {skill, candidate_skill, similarity} dicts
    """
    if not req_skills:
        return {
            "score": 0.0,
            "required_score": 0.0,
            "preferred_score": 0.0,
            "matched_skills": [],
            "missing_skills": [],
            "partial_skills": [],
        }

    # Split job-role skills into two buckets
    required_reqs  = [r for r in req_skills if _normalise_level(r.get("level")) in REQUIRED_LEVELS]
    preferred_reqs = [r for r in req_skills if _normalise_level(r.get("level")) not in REQUIRED_LEVELS]

    # Build candidate skill lookup: name → normalized name (for experience-text boost)
    cand_names: List[str] = []
    for s in cand_skills:
        raw = _clean_skill_name(s.get("name") or s.get("skill"))
        if raw:
            cand_names.append(raw)

    def _match_group(req_group: List[Dict]):
        matched, missing, partial = [], [], []
        effective_matches = 0.0

        for req in req_group:
            req_name = _clean_skill_name(req.get("skill") or req.get("name"))
            if not req_name:
                continue

            best_sim  = 0.0
            best_cand = None
            for cname in cand_names:
                sim = _skill_similarity(req_name, cname)
                if sim > best_sim:
                    best_sim  = sim
                    best_cand = cname

            if best_sim >= 0.75:
                # Full match (exact, alias, token overlap, or prefix match)
                matched.append(req_name)
            elif _check_experience_match(req_name, cand_experience_text):
                # Fallback: verified directly in candidate work history / resume text
                matched.append(req_name)
            elif best_sim > 0.4:
                # Related / partial skill (for display/insights only, does not count as acquired skill)
                partial.append({
                    "skill":           req_name,
                    "candidate_skill": best_cand,
                    "similarity":      round(best_sim, 2),
                })
            else:
                missing.append(req_name)

        effective_matches = float(len(matched))
        return matched, missing, partial, effective_matches

    req_matched,  req_missing,  req_partial,  req_eff  = _match_group(required_reqs)
    pref_matched, pref_missing, pref_partial, pref_eff = _match_group(preferred_reqs)

    total_required  = len(required_reqs)
    total_preferred = len(preferred_reqs)

    # Strictly: (Actual Skills Candidate has / Total Skills Required) * 100
    required_score  = round((len(req_matched) / total_required) * 100.0, 1) if total_required > 0 else None
    preferred_score = round((len(pref_matched) / total_preferred) * 100.0, 1) if total_preferred > 0 else None

    if total_required > 0 and total_preferred > 0:
        total_score = round(min(required_score * 0.75 + preferred_score * 0.25, 100.0), 1)
    elif total_required > 0:
        total_score = required_score
    elif total_preferred > 0:
        total_score = preferred_score
    else:
        total_score = 0.0

    return {
        "score":             total_score,
        "required_score":    required_score,
        "preferred_score":   preferred_score,
        "required_matched":  len(req_matched),
        "required_total":    total_required,
        "preferred_matched": len(pref_matched),
        "preferred_total":   total_preferred,
        "matched_skills":    req_matched  + pref_matched,
        "missing_skills":    req_missing  + pref_missing,
        "partial_skills":    req_partial  + pref_partial,
    }


# ---------------------------------------------------------------------------
# Resume completeness score (independent of role matching)
# ---------------------------------------------------------------------------

def compute_resume_ats_score(candidate: Dict) -> float:
    """Compute a simple ATS readiness score based on profile completeness (0–100)."""
    num_skills   = len(candidate.get("skills", []))
    exp          = candidate.get("total_experience_years") or candidate.get("exp_years") or 0
    loc_points   = 10 if candidate.get("location") else 0
    skill_points = min(num_skills * 5, 50)
    exp_points   = min(exp * 5, 40)
    return skill_points + exp_points + loc_points
