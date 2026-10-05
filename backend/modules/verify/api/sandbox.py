"""
Phygitron 360 — Verify Module: Code Sandbox API
================================================
Production-grade code execution engine supporting Python, JavaScript, Java, C++.

Routing strategy:
  Python  → local subprocess (fast) → Judge0 CE (fallback)
  JS      → local subprocess       → Judge0 CE (fallback)
  Java    → Judge0 CE              → local javac/java (fallback)
  C++     → Judge0 CE              → local g++ (fallback)

Test-case harness is injected for batch runs so each test case is run without
restarting the interpreter, giving O(n) speed instead of O(n) process spawns.
"""
import asyncio
import ast
import json
import logging
import os
import re
import subprocess
import sys
import tempfile
import uuid
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.core.dependencies import get_current_user, require_permission
from backend.common.services.ai.agents import AIAgents

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/verify/sandbox", tags=["Verify - Sandbox"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

JUDGE0_URL = "https://ce.judge0.com"

# Judge0 language IDs
JUDGE0_LANG = {
    "python": 71,
    "javascript": 63,
    "java": 62,
    "cpp": 54,
    "c": 50,
}

LANGUAGE_ALIASES = {
    "python3": "python",
    "py": "python",
    "js": "javascript",
    "node": "javascript",
    "c++": "cpp",
    "c_cpp": "cpp",
    "golang": "go",
    "go": "go",
}

BATCH_RESULTS_START = "---BATCH_RESULTS_START---"
BATCH_RESULTS_END = "---BATCH_RESULTS_END---"

EXEC_TIMEOUT = 20  # seconds for local execution


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class TestCase(BaseModel):
    input: str = ""
    expected_output: str = ""


class ExecuteRequest(BaseModel):
    language: str
    code: str
    stdin: Optional[str] = ""
    test_cases: Optional[List[TestCase]] = None


class GenerateCodingMetaRequest(BaseModel):
    question_text: str
    difficulty: Optional[str] = "medium"


# ---------------------------------------------------------------------------
# Language normalisation
# ---------------------------------------------------------------------------

def _normalize_language(language: str) -> str:
    lang = language.lower().strip()
    return LANGUAGE_ALIASES.get(lang, lang)


def _prepare_test_cases(test_cases) -> List[Dict]:
    """Ensure list of {input, expected_output} dicts."""
    out = []
    for tc in (test_cases or []):
        if isinstance(tc, dict):
            out.append({"input": str(tc.get("input", "")), "expected_output": str(tc.get("expected_output", ""))})
        elif hasattr(tc, "input"):
            out.append({"input": str(tc.input), "expected_output": str(tc.expected_output)})
    return out


def _compact_json(value) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def _normalize_output_text(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_compare_value(value: str) -> str:
    """Normalize output for comparison: try JSON parse, then ast.literal_eval, then stripped string."""
    v = _normalize_output_text(value)
    # Try JSON
    try:
        parsed = json.loads(v)
        return _compact_json(parsed)
    except Exception:
        pass
    # Try Python literal
    try:
        parsed = ast.literal_eval(v)
        return _compact_json(parsed)
    except Exception:
        pass
    return v.lower().strip()


# ---------------------------------------------------------------------------
# Entry-point extraction (AST-based)
# ---------------------------------------------------------------------------

def _extract_python_entry(code: str):
    """Return (func_name, class_name) of the last defined function in the code."""
    func_matches = list(re.finditer(r"^\s*def\s+([a-zA-Z0-9_]+)\s*\(", code, re.MULTILINE))
    if not func_matches:
        return None, None
    class_matches = list(re.finditer(r"^\s*class\s+([a-zA-Z0-9_]+)\s*[\(:]" , code, re.MULTILINE))
    func_name = func_matches[-1].group(1)
    class_name = class_matches[-1].group(1) if class_matches else None
    return func_name, class_name


def _extract_javascript_entry(code: str):
    """Return the last defined function name in JS code."""
    patterns = [
        r"function\s+([a-zA-Z0-9_]+)\s*\(",
        r"const\s+([a-zA-Z0-9_]+)\s*=\s*\(",
        r"const\s+([a-zA-Z0-9_]+)\s*=\s*function\s*\(",
        r"var\s+([a-zA-Z0-9_]+)\s*=\s*function\s*\(",
        r"let\s+([a-zA-Z0-9_]+)\s*=\s*function\s*\(",
        r"var\s+([a-zA-Z0-9_]+)\s*=\s*\(",
        r"let\s+([a-zA-Z0-9_]+)\s*=\s*\(",
    ]
    matches = []
    for pattern in patterns:
        matches.extend(re.finditer(pattern, code))
    if not matches:
        return None
    return matches[-1].group(1)


def _supports_batch_harness(code: str, language: str) -> bool:
    if language == "python":
        return _extract_python_entry(code)[0] is not None
    if language == "javascript":
        return _extract_javascript_entry(code) is not None
    return False


# ---------------------------------------------------------------------------
# LeetCode-style harness code injection
# ---------------------------------------------------------------------------

def wrap_code_for_execution(code: str, language: str, test_cases: list = None) -> str:
    """
    Inject a batch harness into the candidate's code.

    Python / JS with a detectable function:
      - Extracts the entry function (and class if present).
      - Parses the multi-line input into positional args.
      - Calls the function directly and serialises the return value.
      - Prints BATCH_RESULTS_START / END delimiters for parsing.

    Falls back to the original code if no entry point is detected
    (plain stdin/stdout scripts are run per-test-case individually).
    """
    test_cases = test_cases or []

    if language == "python":
        func_name, class_name = _extract_python_entry(code)
        if not func_name:
            return code

        tests_literal = _compact_json(test_cases)
        wrapper = f"""
import json, ast, traceback

__TEST_CASES = json.loads(r'''{tests_literal}''')
__ENTRY_FUNC = "{func_name}"
__ENTRY_CLASS = {repr(class_name)}

def _split_inline_args(raw):
    parts = []
    current = []
    depth = 0
    in_string = False
    string_char = ""

    for ch in str(raw):
        if in_string:
            current.append(ch)
            if ch == string_char:
                in_string = False
            continue

        if ch in {{"'", '"'}}:
            in_string = True
            string_char = ch
            current.append(ch)
            continue

        if ch in {{"[", "{{", "("}}:
            depth += 1
        elif ch in {{"]", "}}", ")"}} and depth > 0:
            depth -= 1

        if ch == "," and depth == 0:
            part = "".join(current).strip()
            if part:
                parts.append(part)
            current = []
            continue

        current.append(ch)

    tail = "".join(current).strip()
    if tail:
        parts.append(tail)
    return parts

def _clean_inline_arg(raw):
    import re
    return re.sub(r"^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*", "", str(raw)).strip()

def __parse_value(raw):
    if not isinstance(raw, str):
        return raw
    text = raw.strip()
    if not text:
        return None
    for parser in (json.loads, ast.literal_eval):
        try:
            return parser(text)
        except Exception:
            continue
    return text

def __parse_args(raw):
    # Parse a multi-line or comma-separated input string into a list of Python values.
    # Supports:
    #   - Multi-line: each line is one argument (LeetCode-style, e.g. '[2,7,11,15]\\n9')
    #   - Inline comma-separated: 'nums=[2,7], target=9'
    #   - Single value: '9'
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        args = raw.get("args")
        if isinstance(args, list):
            return args
        return [raw]
    if raw is None:
        return []
    text = str(raw).strip()
    if not text:
        return []
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) > 1:
        # Multi-line = each line is one argument
        return [__parse_value(line) for line in lines]
    inline_parts = [_clean_inline_arg(part) for part in _split_inline_args(lines[0])]
    if len(inline_parts) > 1:
        return [__parse_value(part) for part in inline_parts]
    value = __parse_value(lines[0])
    if isinstance(value, dict) and isinstance(value.get("args"), list):
        return value["args"]
    if value is None:
        return []
    return [value]

def __normalize_output(value):
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))

def __resolve_target():
    target = None
    if __ENTRY_CLASS:
        cls = globals().get(__ENTRY_CLASS)
        if cls:
            try:
                target = getattr(cls(), __ENTRY_FUNC, None)
            except Exception:
                target = None
    if target is None:
        target = globals().get(__ENTRY_FUNC)
    return target

def __run_batch_harness():
    results = []
    target = __resolve_target()
    if not callable(target):
        for _tc in __TEST_CASES:
            results.append({{"stdout": "", "stderr": f"Entrypoint '{{__ENTRY_FUNC}}' not found in submitted code."}})
        print("{BATCH_RESULTS_START}")
        print(json.dumps(results))
        print("{BATCH_RESULTS_END}")
        return

    for tc in __TEST_CASES:
        try:
            args = __parse_args(tc.get("input"))
            res = target(*args)
            results.append({{"stdout": __normalize_output(res), "stderr": ""}})
        except Exception:
            results.append({{"stdout": "", "stderr": traceback.format_exc()}})

    print("{BATCH_RESULTS_START}")
    print(json.dumps(results))
    print("{BATCH_RESULTS_END}")

__run_batch_harness()
"""
        # Prepend 'from typing import *' so List, Optional, Dict etc. are available
        return "from typing import *\n" + code + "\n" + wrapper

    if language == "javascript":
        func_name = _extract_javascript_entry(code)
        if not func_name:
            return code
        tests_literal = _compact_json(test_cases)
        wrapper = f"""
const __TEST_CASES = JSON.parse(String.raw`{tests_literal}`);
const __ENTRY_FUNC = "{func_name}";

function __parseValue(raw) {{
  if (typeof raw !== "string") return raw;
  const text = raw.trim();
  if (!text) return null;
  try {{ return JSON.parse(text); }} catch (e) {{}}
  return text;
}}

function __splitInlineArgs(raw) {{
  const parts = [];
  let current = "";
  let depth = 0;
  let inString = false;
  let stringChar = "";
  for (const ch of String(raw)) {{
    if (inString) {{ current += ch; if (ch === stringChar) inString = false; continue; }}
    if (ch === "'" || ch === '"') {{ inString = true; stringChar = ch; current += ch; continue; }}
    if ("[{{(".includes(ch)) depth += 1;
    else if ("]}})".includes(ch) && depth > 0) depth -= 1;
    if (ch === "," && depth === 0) {{ const part = current.trim(); if (part) parts.push(part); current = ""; continue; }}
    current += ch;
  }}
  const tail = current.trim();
  if (tail) parts.push(tail);
  return parts;
}}

function __parseArgs(raw) {{
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {{ if (Array.isArray(raw.args)) return raw.args; return [raw]; }}
  if (raw == null) return [];
  const text = String(raw).trim();
  if (!text) return [];
  const lines = text.split("\\n").map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) return lines.map(__parseValue);
  const inlineParts = __splitInlineArgs(lines[0]);
  if (inlineParts.length > 1) return inlineParts.map(__parseValue);
  const value = __parseValue(lines[0]);
  if (value && typeof value === "object" && Array.isArray(value.args)) return value.args;
  if (value == null) return [];
  return [value];
}}

function __normalizeOutput(value) {{
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  return JSON.stringify(value);
}}

async function __runBatchHarness() {{
  const results = [];
  const target = (typeof {func_name} !== "undefined") ? {func_name} : null;
  if (!target || typeof target !== "function") {{
    for (const tc of __TEST_CASES) results.push({{ stdout: "", stderr: `Entrypoint '{func_name}' not found` }});
    console.log("{BATCH_RESULTS_START}");
    console.log(JSON.stringify(results));
    console.log("{BATCH_RESULTS_END}");
    return;
  }}
  for (const tc of __TEST_CASES) {{
    try {{
      const args = __parseArgs(tc.input);
      const res = target(...args);
      results.push({{ stdout: __normalizeOutput(res), stderr: "" }});
    }} catch (e) {{
      results.push({{ stdout: "", stderr: String(e && e.stack ? e.stack : e) }});
    }}
  }}
  console.log("{BATCH_RESULTS_START}");
  console.log(JSON.stringify(results));
  console.log("{BATCH_RESULTS_END}");
}}

__runBatchHarness();
"""
        return code + "\n" + wrapper

    # Java / C++ — no harness wrapping; run per-test-case via Judge0
    return code


def _is_solution_class(code: str, language: str) -> bool:
    if language in ("java", "cpp", "c"):
        return "class Solution" in code or "class Main" in code
    if language == "python":
        return "class Solution" in code
    return False


# ---------------------------------------------------------------------------
# Local execution
# ---------------------------------------------------------------------------

def _get_exec_dir() -> str:
    base = os.path.join(tempfile.gettempdir(), ".verify_exec")
    os.makedirs(base, exist_ok=True)
    return base


def _execute_locally(language: str, code: str, stdin: str = "") -> Dict:
    """Run code in a local subprocess. Returns {stdout, stderr, exit_code}."""
    exec_dir = _get_exec_dir()
    run_id = uuid.uuid4().hex[:8]
    work_dir = os.path.join(exec_dir, run_id)
    os.makedirs(work_dir, exist_ok=True)

    try:
        if language == "python":
            code_file = os.path.join(work_dir, "solution.py")
            with open(code_file, "w", encoding="utf-8") as f:
                f.write(code)
            cmd = [sys.executable, code_file]

        elif language == "javascript":
            code_file = os.path.join(work_dir, "solution.js")
            with open(code_file, "w", encoding="utf-8") as f:
                f.write(code)
            cmd = ["node", code_file]

        elif language == "java":
            # Detect class name
            match = re.search(r"public\s+class\s+(\w+)", code)
            class_name = match.group(1) if match else "Main"
            code_file = os.path.join(work_dir, f"{class_name}.java")
            with open(code_file, "w", encoding="utf-8") as f:
                f.write(code)
            # Compile
            compile_result = subprocess.run(
                ["javac", code_file], capture_output=True, text=True, timeout=15
            )
            if compile_result.returncode != 0:
                return {
                    "stdout": "",
                    "stderr": compile_result.stderr,
                    "exit_code": compile_result.returncode,
                }
            cmd = ["java", "-cp", work_dir, class_name]

        elif language in ("cpp", "c"):
            code_file = os.path.join(work_dir, "solution.cpp")
            bin_file = os.path.join(work_dir, "solution")
            with open(code_file, "w", encoding="utf-8") as f:
                f.write(code)
            compile_result = subprocess.run(
                ["g++", "-o", bin_file, code_file, "-std=c++17"],
                capture_output=True, text=True, timeout=15
            )
            if compile_result.returncode != 0:
                return {
                    "stdout": "",
                    "stderr": compile_result.stderr,
                    "exit_code": compile_result.returncode,
                }
            cmd = [bin_file]

        else:
            return {"stdout": "", "stderr": f"Unsupported language: {language}", "exit_code": 1}

        result = subprocess.run(
            cmd,
            input=stdin,
            capture_output=True,
            text=True,
            timeout=EXEC_TIMEOUT,
            cwd=work_dir,
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode,
        }

    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "Time limit exceeded (local)", "exit_code": 124}
    except FileNotFoundError as exc:
        return {"stdout": "", "stderr": f"Runtime not found: {exc}", "exit_code": 127}
    except Exception as exc:
        return {"stdout": "", "stderr": str(exc), "exit_code": 1}
    finally:
        # Cleanup
        import shutil
        try:
            shutil.rmtree(work_dir, ignore_errors=True)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Judge0 execution
# ---------------------------------------------------------------------------

async def _execute_via_judge0(language: str, code: str, stdin: str = "") -> Dict:
    """Submit to Judge0 CE and poll for result."""
    lang_id = JUDGE0_LANG.get(language)
    if not lang_id:
        return {"stdout": "", "stderr": f"Language {language!r} not supported in Judge0", "exit_code": 1}

    import base64
    payload = {
        "source_code": base64.b64encode(code.encode()).decode(),
        "language_id": lang_id,
        "stdin": base64.b64encode((stdin or "").encode()).decode(),
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            submit = await client.post(
                f"{JUDGE0_URL}/submissions?base64_encoded=true&wait=false",
                json=payload,
            )
            if submit.status_code not in (200, 201):
                return {"stdout": "", "stderr": f"Judge0 submit failed: {submit.status_code}", "exit_code": 1}

            token = submit.json().get("token")
            if not token:
                return {"stdout": "", "stderr": "No token from Judge0", "exit_code": 1}

            # Poll until done (status_id not in 1=queued, 2=processing)
            for _ in range(20):
                await asyncio.sleep(1.5)
                poll = await client.get(
                    f"{JUDGE0_URL}/submissions/{token}?base64_encoded=true",
                )
                data = poll.json()
                if data.get("status", {}).get("id") not in (1, 2):
                    break

            def _decode(v):
                if not v:
                    return ""
                try:
                    import base64 as b64
                    return b64.b64decode(v).decode("utf-8", errors="replace")
                except Exception:
                    return str(v)

            return {
                "stdout": _decode(data.get("stdout")),
                "stderr": _decode(data.get("stderr")) or _decode(data.get("compile_output")),
                "exit_code": data.get("exit_code") or 0,
            }

    except Exception as exc:
        return {"stdout": "", "stderr": f"Judge0 error: {exc}", "exit_code": 1}


# ---------------------------------------------------------------------------
# Smart routing
# ---------------------------------------------------------------------------

async def _execute_code(language: str, code: str, stdin: str = "") -> Dict:
    """
    Route to best execution backend:
      Python / JS → local first, fallback Judge0
      Java / C++  → Judge0 first, fallback local
    """
    if language in ("python", "javascript"):
        result = await asyncio.to_thread(_execute_locally, language, code, stdin)
        if result.get("exit_code") == 127:  # runtime not found
            result = await _execute_via_judge0(language, code, stdin)
        return result
    else:
        result = await _execute_via_judge0(language, code, stdin)
        if result.get("exit_code") == 1 and "not supported" in result.get("stderr", ""):
            result = await asyncio.to_thread(_execute_locally, language, code, stdin)
        return result


# ---------------------------------------------------------------------------
# Batch test runner
# ---------------------------------------------------------------------------

def _parse_batch_results(stdout: str) -> Optional[List[Dict]]:
    """Extract JSON array between batch markers from stdout."""
    try:
        start = stdout.index(BATCH_RESULTS_START) + len(BATCH_RESULTS_START)
        end = stdout.index(BATCH_RESULTS_END, start)
        payload = stdout[start:end].strip()
        return json.loads(payload)
    except Exception:
        return None


async def _run_test_cases(language: str, code: str, test_cases: List[Dict]) -> Dict:
    """
    Run all test cases and return structured results.

    For Python/JS with a detectable function:
      - Injects the LeetCode-style batch harness (wrap_code_for_execution).
      - Parses BATCH_RESULTS markers from stdout.
      - Each result contains {passed, actual, expected, input, error}.

    For Java/C++ (and stdin/stdout scripts with no detectable function):
      - Runs each test case individually, piping input via stdin.
    """
    if not test_cases:
        return {"run": {}, "test_results": []}

    if _supports_batch_harness(code, language):
        wrapped = wrap_code_for_execution(code, language, test_cases)
        run_result = await _execute_code(language, wrapped, "")
        stdout = run_result.get("stdout", "")
        batch = _parse_batch_results(stdout)
        if batch is not None:
            structured = []
            for idx, tc in enumerate(test_cases):
                raw = batch[idx] if idx < len(batch) else {}
                actual = _normalize_output_text(raw.get("stdout", ""))
                expected = _normalize_output_text(tc.get("expected_output", ""))
                structured.append({
                    "passed": _normalize_compare_value(actual) == _normalize_compare_value(expected),
                    "actual": actual,
                    "expected": expected,
                    "input": tc.get("input", ""),
                    "error": raw.get("stderr") or None,
                })
            return {"run": run_result, "test_results": structured}
        # Harness ran but markers not found — fall through to per-test-case

    # Per-test-case fallback (Java/C++ and stdin/stdout scripts)
    test_results = []
    for tc in test_cases:
        run = await _execute_code(language, code, tc.get("input", ""))
        actual = _normalize_output_text(run.get("stdout", ""))
        expected = _normalize_output_text(tc.get("expected_output", ""))
        passed = _normalize_compare_value(actual) == _normalize_compare_value(expected)
        test_results.append({
            "passed": passed,
            "actual": actual,
            "expected": expected,
            "input": tc.get("input", ""),
            "error": run.get("stderr") or None,
        })

    return {"run": {}, "test_results": test_results}


# ---------------------------------------------------------------------------
# Endpoints
@router.post("/execute")
async def execute_code(
    body: ExecuteRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Execute code with optional test cases.
    If test_cases provided: returns {run, test_results[{passed,actual,expected}]}
    Otherwise: returns raw {stdout, stderr, exit_code}
    """
    language = _normalize_language(body.language)
    code = body.code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="Code cannot be empty")

    try:
        if body.test_cases:
            tcs = _prepare_test_cases(body.test_cases)
            result = await _run_test_cases(language, code, tcs)
        else:
            run = await _execute_code(language, code, body.stdin or "")
            result = {
                "stdout": run.get("stdout", ""),
                "stderr": run.get("stderr", ""),
                "exit_code": run.get("exit_code", 0),
            }
        return {"success": True, "data": result}
    except Exception as exc:
        logger.error(f"sandbox execute error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/generate-coding-meta")
async def generate_coding_meta(
    body: GenerateCodingMetaRequest,
    current_user: dict = Depends(require_permission("verify.questions.manage")),
):
    """
    AI-generate starter code, test cases, and programming language
    for a given coding question.
    """
    ai = AIAgents()
    system = "You are a coding question metadata generator."
    prompt = f"""Analyze this coding question and generate metadata for a LeetCode-style environment.
Question: {body.question_text}

Respond ONLY with a JSON object containing:
- "starter_code": A basic Python function signature with an indented placeholder body like `# Write your code here` followed by `pass`.
- "test_cases": Exactly 3 objects, each with "input" and "expected_output".
  CRITICAL: In "input", each argument for the function MUST be on its own line.
  - If an argument is a list/array, format it as a JSON array (e.g. [1, 2, 3]) on one line.
  - If an argument is a number or string, put it on its own line.
  - Every "expected_output" must be the exact return value or stdout text.
- "programming_language": Set to "python".
"""
    try:
        result = await ai.ai.generate_json(prompt, system)
        return {"success": True, "data": result}
    except Exception as exc:
        logger.error(f"generate_coding_meta failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
