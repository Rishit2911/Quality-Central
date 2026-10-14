import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.modules.quality.services.chatbot_service import QualityChatbotService

service = QualityChatbotService()

test_cases = [
    # Feature 1: What to solve/fix / Priority
    ('okay which all bugs i have to solve today', 'BUG_PRIORITIZATION'),
    ('what should i work on today', 'BUG_PRIORITIZATION'),
    ('what bug should i fix first', 'BUG_PRIORITIZATION'),
    ('my bugs to fix', 'BUG_PRIORITIZATION'),
    ('prioritize my bugs', 'BUG_PRIORITIZATION'),
    ('which bugs to solve today', 'BUG_PRIORITIZATION'),
    # Feature 2: Crash diagnosis / RCA
    ('diagnose error from 1 month ago on 2026-09-15', 'RCA'),
    ('why did the server crash', 'RCA'),
    ('show broken line and traceback for error', 'RCA'),
    # Feature 3: Duplicate Bug Check
    ('check if there is a duplicate bug for: table extraction crash', 'DUPLICATE_CHECK'),
    ('is this bug already logged in the system', 'DUPLICATE_CHECK'),
    # Feature 4: Developer Workload & Progress
    ('show developer workload and progress report', 'DEVELOPER_WORKLOAD'),
    ('who is working on what', 'DEVELOPER_WORKLOAD'),
    ('what is Sriraj working on', 'DEVELOPER_WORKLOAD'),
    # Feature 5: Smart Triage / Auto-assignment
    ('okay i want to report a bug for lexai to whom should i assign it to', 'SMART_TRIAGE'),
    ('who should i assign this bug to', 'SMART_TRIAGE'),
    ('recommend developer for talent central', 'SMART_TRIAGE'),
    # Feature 6: Bug Lifecycle & Age
    ('when was bug LEX-00125 opened and who reassigned it', 'BUG_LIFECYCLE'),
    ('how long has QC-00124 been open', 'BUG_LIFECYCLE'),
    # Feature 7: QA Handover Notes
    ('draft qa handover notes for bug LEX-00125 fixed in staging', 'HANDOVER_NOTES'),
    ('generate debugging note for tester', 'HANDOVER_NOTES'),
    # Feature 8: Project Releases & Versions
    ('what are the latest project versions pushed', 'PROJECT_RELEASES'),
    ('latest version of lexai', 'PROJECT_RELEASES'),
    # Feature 9: Defect Details & Main Issue Lookup
    ('okay what is the main issue in the LC-00122', 'BUG_DETAILS'),
    ('where is the issue in LC-00122', 'BUG_DETAILS'),
    # Feature 10: Single Project Status (Does NOT dump all projects!)
    ('how is talent central doing', 'PROJECT_STATUS'),
    ('status of lexai', 'PROJECT_STATUS'),
    ('health of learning central', 'PROJECT_STATUS'),
    # Feature 11: Explicit Metrics & SLA
    ('show sla breaches and overdue tickets', 'METRICS_SLA'),
    ('show all project health scores', 'METRICS_SLA'),
    # Feature 12: General Conversational & Technical Questions (Gemini AI)
    ('hello how can you help me today', 'GENERAL_AI'),
    ('what is regression testing in software qa', 'GENERAL_AI'),
    ('how do i write clear steps to reproduce a defect', 'GENERAL_AI')
]

all_passed = True
for query, expected in test_cases:
    res = service.handle_chat_message(query, user_name='Rishit')
    actual = res.get('intent')
    ok = (actual == expected)
    if not ok:
        all_passed = False
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] '{query[:45]}' -> Expected: {expected}, Got: {actual}")

print(f"\n==========================================")
print(f"ALL {len(test_cases)} TESTS PASSED: {all_passed}")
print(f"==========================================")
