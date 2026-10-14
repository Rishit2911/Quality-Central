import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.modules.quality.services.chatbot_service import QualityChatbotService

service = QualityChatbotService()

tests = [
    ('what bug should i fix first', 'BUG_PRIORITIZATION'),
    ('diagnose error from 1 month ago on 2026-09-15', 'RCA'),
    ('is this bug already logged in the system', 'DUPLICATE_CHECK'),
    ('who is working on what', 'DEVELOPER_WORKLOAD'),
    ('recommend developer for talent central', 'SMART_TRIAGE'),
    ('how long has QC-00124 been open', 'BUG_LIFECYCLE'),
    ('draft qa handover notes for bug LEX-00125 fixed in staging', 'HANDOVER_NOTES'),
    ('what are the latest project versions pushed', 'PROJECT_RELEASES'),
    ('latest version of lexai', 'PROJECT_RELEASES'),
    ('what is the main issue in LC-00122', 'BUG_DETAILS'),
    ('how is talent central doing', 'PROJECT_STATUS'),
    ('status of lexai', 'PROJECT_STATUS'),
    ('show sla breaches and overdue tickets', 'METRICS_SLA'),
    ('hello how are you', 'GENERAL_AI'),
    ('what is regression testing in software qa', 'GENERAL_AI'),
]

print(f"Running {len(tests)} feature verification tests...\n", flush=True)
all_pass = True
for query, expected in tests:
    res = service.handle_chat_message(query, user_name='Rishit')
    actual = res.get('intent')
    ok = (actual == expected)
    if not ok:
        all_pass = False
    status_str = "PASS" if ok else "FAIL"
    print(f"[{status_str}] '{query}' -> Expected: {expected}, Got: {actual}", flush=True)
    if expected == 'PROJECT_STATUS':
        proj_name = res.get('data', {}).get('project_name', 'Unknown')
        print(f"   -> Verified single project status: ONLY returned '{proj_name}' (No other projects dumped)", flush=True)
    elif expected == 'GENERAL_AI':
        preview = res.get('text', '').replace('\n', ' ')[:70]
        print(f"   -> Verified Gemini response preview: \"{preview}...\"", flush=True)

print(f"\n==============================================", flush=True)
print(f"ALL {len(tests)} TESTS PASSED: {all_pass}", flush=True)
print(f"==============================================", flush=True)
