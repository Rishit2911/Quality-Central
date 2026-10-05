import logging
import json
from typing import List, Dict, Any, Optional

from backend.modules.verify.repositories.question_bank_repo import QuestionBankRepository
from backend.common.services.ai.agents import AIAgents

logger = logging.getLogger(__name__)

class QuestionBankService:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id
        self.repo = QuestionBankRepository(tenant_id)
        self.ai = AIAgents()

    def create_question(self, data: Dict[str, Any]) -> int:
        return self.repo.create_question(data)

    def update_question(self, question_id: int, data: Dict[str, Any]) -> bool:
        return self.repo.update_question(question_id, data)

    def delete_question(self, question_id: int) -> bool:
        return self.repo.delete_question(question_id)

    def list_questions(self, tags: Optional[List[str]] = None, q_type: Optional[str] = None, topic: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.repo.list_questions(tags, q_type, topic, search)

    def get_question_by_id(self, question_id: int) -> Optional[Dict[str, Any]]:
        return self.repo.get_question_by_id(question_id)

    async def import_from_text(self, text: str, created_by: int, topic: Optional[str] = None, default_tags: Optional[List[str]] = None) -> int:
        """Parse text using AI to extract questions and save them to the bank."""
        system_prompt = """You are an AI assessment generator.
Extract all questions from the given text.
For each question, determine its type (mcq, mcq_multi, written, coding).
- For `mcq` and `mcq_multi`, extract `options` and identify the `correct_answer` (for mcq_multi, use a JSON string array like '["A", "C"]').
- For `written`, write a comprehensive `model_answer` that can be used as a grading rubric.
- For `coding`, deduce the `programming_language` (default to 'python' if unclear), generate `starter_code` (e.g., a function definition), and create robust `test_cases` as an array of objects: [{"input": "...", "expected_output": "..."}].
- Generate 2-4 descriptive topic or skill tags (e.g. ["python", "algorithms", "data-structures"]).

Respond ONLY with a JSON array of question objects matching this structure:
{
  "questions": [
    {
      "question_text": "string",
      "question_type": "mcq|mcq_multi|written|coding",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "A",
      "model_answer": "...",
      "starter_code": "def solve():\\n    pass",
      "test_cases": [{"input": "1, 2", "expected_output": "3"}],
      "programming_language": "python",
      "marks": 1.0,
      "tags": ["tag1", "tag2"]
    }
  ]
}
"""
        result = await self.ai.ai.generate_json(text, system_prompt)
        
        if isinstance(result, list):
            questions = result
        else:
            questions = result.get("questions", [])
        
        count = 0
        for q in questions:
            q["created_by"] = created_by
            if topic:
                q["topic"] = topic
            q_tags = q.get("tags", [])
            if isinstance(q_tags, str):
                try: q_tags = json.loads(q_tags)
                except Exception: q_tags = [t.strip() for t in q_tags.split(",") if t.strip()]
            if not isinstance(q_tags, list):
                q_tags = []
            if default_tags:
                q_tags.extend(default_tags)
            
            clean_tags = []
            for t in q_tags:
                st = str(t).strip()
                if st and st.lower() not in ("extracted", "extracted_tag", "none", "null") and st not in clean_tags:
                    clean_tags.append(st)
            q["tags"] = clean_tags
                
            self.repo.create_question(q)
            count += 1
            
        return count

    async def import_from_url(self, url: str, created_by: int, topic: Optional[str] = None, default_tags: Optional[List[str]] = None) -> int:
        import httpx
        from bs4 import BeautifulSoup
        import re

        headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

        # Handle LeetCode URLs specially for precise code extraction
        if "leetcode.com" in url.lower():
            match = re.search(r"leetcode\.com/problems/([^/]+)", url.lower())
            if match:
                title_slug = match.group(1)
                async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                    graphql_url = "https://leetcode.com/graphql"
                    query = """
                    query questionData($titleSlug: String!) {
                        question(titleSlug: $titleSlug) {
                            title
                            content
                            topicTags { name }
                            codeSnippets { langSlug code }
                            exampleTestcases
                            sampleTestCase
                        }
                    }
                    """
                    payload = {
                        "operationName": "questionData",
                        "variables": {"titleSlug": title_slug},
                        "query": query
                    }
                    resp = await client.post(graphql_url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json().get("data", {}).get("question", {})
                        if data and data.get("content"):
                            soup = BeautifulSoup(data["content"], 'html.parser')
                            
                            all_imgs = []
                            for img in soup.find_all('img'):
                                src = img.get('src')
                                if src:
                                    all_imgs.append(src)
                                    img.replace_with(f"![image]({src})")
                            
                            for tag in soup.find_all(['p', 'div', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote']):
                                tag.insert_before('\n\n')
                                tag.insert_after('\n\n')
                            for tag in soup.find_all('br'):
                                tag.replace_with('\n')
                            for tag in soup.find_all('li'):
                                tag.insert_before('\n- ')
                                
                            content_text = soup.get_text()
                            content_text = re.sub(r'[ \t]+', ' ', content_text)
                            content_text = re.sub(r'\n[ \t]*\n+', '\n\n', content_text).strip()
                            
                            title = data.get("title") or title_slug.replace("-", " ").title()
                            
                            starter_code = None
                            for snippet in (data.get("codeSnippets") or []):
                                if snippet.get("langSlug") == "python3" or snippet.get("langSlug") == "python":
                                    starter_code = snippet.get("code")
                                    break
                            
                            sample_blob = (data.get("exampleTestcases") or data.get("sampleTestCase") or "").strip()
                            test_cases = [{"input": sample_blob, "expected_output": ""}] if sample_blob else []

                            question_text = f"# {title}\n\n{content_text}"
                            if data.get("topicTags"):
                                topic_names = [tag.get("name") for tag in data.get("topicTags", []) if tag.get("name")]
                                if topic_names:
                                    question_text += f"\n\nTopics: {', '.join(topic_names)}"

                            question = {
                                "question_text": question_text,
                                "question_type": "coding",
                                "starter_code": starter_code,
                                "test_cases": test_cases,
                                "programming_language": "python",
                                "marks": 5.0,
                                "images": all_imgs,
                                "created_by": created_by,
                                "topic": topic
                            }
                            
                            q_tags = default_tags or []
                            if data.get("topicTags"):
                                q_tags.extend([tag.get("name") for tag in data.get("topicTags", []) if tag.get("name")])
                            question["tags"] = list(set(q_tags))
                            
                            self.repo.create_question(question)
                            return 1

        # Generic web scraper for other URLs
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            
        soup = BeautifulSoup(resp.text, 'html.parser')
        for element in soup(["script", "style", "nav", "footer", "header"]):
            element.extract()
            
        text = soup.get_text(separator=' ', strip=True)
        if len(text) > 15000:
            text = text[:15000]
            
        return await self.import_from_text(text, created_by, topic, default_tags)
