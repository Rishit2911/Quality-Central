import logging
from typing import List, Dict, Any, Optional
from backend.modules.verify.repositories.assessment_repo import AssessmentRepository
from backend.common.services.ai.agents import AIAgents

logger = logging.getLogger(__name__)

class AssessmentService:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id
        self.repo = AssessmentRepository(tenant_id=tenant_id)
        self.ai_agents = AIAgents()

    def create_assessment(self, data: Dict[str, Any]) -> int:
        return self.repo.create_assessment(data)

    def get_all_assessments(self) -> List[Dict[str, Any]]:
        return self.repo.get_all_assessments()

    def get_assessment(self, asm_id: int) -> Optional[Dict[str, Any]]:
        return self.repo.get_assessment_by_id(asm_id)

    def update_assessment(self, asm_id: int, updates: Dict[str, Any]) -> bool:
        return self.repo.update_assessment(asm_id, updates)

    def delete_assessment(self, asm_id: int) -> bool:
        return self.repo.delete_assessment(asm_id)

    def update_status(self, asm_id: int, status: str) -> bool:
        return self.repo.update_assessment_status(asm_id, status)

    def publish_assessment(self, asm_id: int) -> bool:
        return self.repo.update_assessment_status(asm_id, "active")

    async def generate_coding_meta(self, topic: str, difficulty: str = "medium") -> Dict[str, Any]:
        """Use AI to generate a complete coding question with starter code and test cases."""
        system_prompt = "You are a coding question metadata generator."
        prompt = f"""Analyze this coding question and generate metadata for a LeetCode-style environment.
Question: Generate a {difficulty} coding question about {topic}.

Respond ONLY with a JSON object containing:
- "question_text": Detailed problem description.
- "starter_code": A basic Python function signature with an indented placeholder body like `# Write your code here` followed by `pass`.
- "model_answer": A working python solution.
- "test_cases": Exactly 3 objects, each with "input" and "expected_output".
  CRITICAL: In "input", each argument for the function MUST be on its own line.
  - If an argument is a list/array, format it as a JSON array (e.g. [1, 2, 3]) on one line.
  - If an argument is a number or string, put it on its own line.
  - Every "expected_output" must be the exact return value or stdout text.
- "programming_language": Set to "python".
"""
        return await self.ai_agents.ai.generate_json(prompt, system_prompt)
