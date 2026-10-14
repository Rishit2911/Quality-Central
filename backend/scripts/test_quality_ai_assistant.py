import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import os
sys.path.insert(0, os.path.abspath("."))

from backend.modules.quality.services.chatbot_service import QualityChatbotService

svc = QualityChatbotService()

print("=====================================================")
print("TEST 1: Help users report bugs (Follow-up + Draft)")
print("=====================================================")
r1 = svc.handle_chat_message("The checkout page freezes after I click Pay.")
assert r1["intent"] == "BUG_REPORT_QUESTIONING", f"Failed intent: {r1.get('intent')}"
assert len(r1["suggestions"]) >= 3
print("✓ Passed follow-up questioning test!")

r1_draft = svc.handle_chat_message("Chrome on Windows (Froze silently with no error)")
assert r1_draft["intent"] == "BUG_REPORT_DRAFT", f"Failed draft intent: {r1_draft.get('intent')}"
assert r1_draft["can_submit"] is True
print("✓ Passed bug draft preparation test! Title:", r1_draft["data"]["bug_draft"]["title"])

print("\n=====================================================")
print("TEST 2: Search existing bugs conversationally")
print("=====================================================")
r2_android = svc.handle_chat_message("Show me open critical bugs on Android.")
assert r2_android["intent"] == "SEARCH_BUGS"
assert r2_android["total_matches"] >= 1
print("✓ Passed Android search! Matches found:", r2_android["total_matches"], "First:", r2_android["matches"][0]["id"])

r2_login = svc.handle_chat_message("Are there any similar login failures?")
assert r2_login["intent"] == "SEARCH_BUGS"
assert r2_login["total_matches"] >= 1
print("✓ Passed Login search! Matches found:", r2_login["total_matches"], "First:", r2_login["matches"][0]["id"])

r2_reported = svc.handle_chat_message("Has anyone reported this issue before?")
assert r2_reported["intent"] == "SEARCH_BUGS"
print("✓ Passed General similarity search! Matches found:", r2_reported["total_matches"])

print("\n=====================================================")
print("TEST 3: Help developers investigate bugs")
print("=====================================================")
r3 = svc.handle_chat_message("Summarize this issue and tell me what I should investigate first.")
assert r3["intent"] == "INVESTIGATE_BUG"
assert len(r3["data"]["verified_facts"]) >= 3
assert len(r3["data"]["suggested_steps"]) >= 2
assert "VERIFIED ROOT CAUSES" in r3["text"]
assert "SUGGESTED TROUBLESHOOTING STEPS" in r3["text"]
print("✓ Passed Developer Investigation test! Target:", r3["data"]["bug_id"])

print("\n=====================================================")
print("TEST 4: Help reviewers and managers")
print("=====================================================")
r4_audit = svc.handle_chat_message("Summarize the changes made to this bug.")
assert r4_audit["intent"] == "MANAGER_ANALYTICS"
assert "quality_bug_timeline" in r4_audit["text"]
print("✓ Passed Changes Summary test!")

r4_unresolved = svc.handle_chat_message("Which high-severity bugs are still unresolved?")
assert r4_unresolved["intent"] == "MANAGER_ANALYTICS"
assert r4_unresolved["data"]["total_unresolved"] >= 1
print("✓ Passed Unresolved High-Severity test! Count:", r4_unresolved["data"]["total_unresolved"])

r4_recurring = svc.handle_chat_message("What are the recurring issues in the latest release?")
assert r4_recurring["intent"] == "MANAGER_ANALYTICS"
assert len(r4_recurring["data"]["top_recurring"]) >= 1
print("✓ Passed Recurring Issues test! Modules:", [m[0] for m in r4_recurring["data"]["top_recurring"]])

r4_velocity = svc.handle_chat_message("How many Normal priority bugs did the Platform team solve in the last 30 days? How does that compare to the previous 30 days?")
assert r4_velocity["intent"] == "MANAGER_ANALYTICS"
assert "AI Analyst" in r4_velocity["text"]
print("✓ Passed 30-Day Velocity Comparison test!")

print("\n=====================================================")
print("ALL 4 FEATURES PASSED VERIFICATION WITH 100% SUCCESS!")
print("=====================================================")
