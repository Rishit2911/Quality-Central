import json
import re
import traceback
from datetime import datetime
from typing import Dict, Optional
from google import genai
from fastapi import HTTPException
from tenacity import retry, stop_after_attempt, wait_exponential

# Strategies Config
COURSE_LEVEL_STRATEGIES = {
    "Level 1": {
        "visual": """**LEVEL 1: Awareness-level (Text and primarily static images)**
Visual approach: Clean, simple, information-focused.
Recommended Strategies:
1. Text with supporting icons (Short bullets with relevant icons)
2. Infographics (Visual summaries of concepts or data)
3. Process flow diagrams (Simple step-by-step visuals)
4. Photographic visuals (Real images showing context or environment)
5. Charts and graphs (Data, trends, or comparisons)
6. Tables""",
        "interactivity": """**Level 1 Interaction Types (Basic):**
1. Click and Reveal (Learner clicks icons/labels -> Information appears)
2. Tabs Interaction (Content divided into tabs -> Learner explores each section)
3. Accordion Interaction (Expand/collapse sections -> Used for steps or rules)
4. Hotspots (Clickable areas on image -> Reveals information)""",
        "assessment": """**Level 1 Assessment Types (Knowledge Check):**
1. Multiple Choice (Single Correct)
2. Multiple Response (Multiple Correct)
3. True / False
4. Fill in the Blank
5. Matching (Terms and definitions, Process and outcomes)"""
    },
    "Level 2": {
        "visual": """**LEVEL 2: Engaging Courses (More contextual, learner-centered visuals)**
Includes all Level 1 visuals, plus:
1. Character-based illustrations (Workplace situations with characters)
2. Before-after comparison visuals (Correct vs incorrect behavior)
3. Demonstration videos (Task or process walkthroughs)
4. Conceptual illustrations (Visual metaphors for abstract ideas)
5. Simple animations
6. Expert talk (Recorded video of SME)""",
        "interactivity": """**Level 2 Interaction Types (Contextual Learning):**
Includes Level 1 interactions, plus:
1. Real-World News Incident (Short real-life case -> Shows consequences)
2. Mini Case Study (Short workplace scenario -> Reflection/Question)
3. Process Walkthrough (Step-by-step guided interaction)
4. Decision Point (Learner chooses an action -> Immediate feedback)""",
        "assessment": """**Level 2 Assessment Types (Applied Understanding):**
Includes Level 1 assessments, plus:
1. Scenario-Based MCQ (Short situation -> Learner chooses best action)
2. Sequencing / Ordering (Arrange steps in correct order)
3. Drag and Drop (Categorization: Do vs Don't, Risk vs Safe)"""
    },
    "Level 3": {
        "visual": """**LEVEL 3: Applied / Scenario-Based Courses (Highly contextual, realistic)**
Includes Level 1 & 2 visuals, plus:
1. Highly realistic scenarios
2. Complex simulations
3. Branching visual paths""",
        "interactivity": """**Level 3 Interaction Types (Advanced):**
Includes Level 1 & 2 interactions, plus:
1. Branching Scenario (Multiple decision paths -> Different endings)
2. Simulation (Software or Role-based)
3.    - Show me: System simulation or conversation simulation
4.    - Try me: Learner performs actions""",
        "assessment": """**Level 3 Assessment Types (Performance-based):**
Includes Level 1 & 2 assessments, plus:
1. Branching Scenario (Multiple decisions, different outcomes)
2. Simulation-Based Assessment (Learner performs actual steps)"""
    }
}

def get_strategy_for_level(interactivity_level: str) -> Dict[str, str]:
    if not interactivity_level:
        return COURSE_LEVEL_STRATEGIES["Level 2"]
    if "Level 1" in interactivity_level:
        return COURSE_LEVEL_STRATEGIES["Level 1"]
    elif "Level 2" in interactivity_level:
        return COURSE_LEVEL_STRATEGIES["Level 2"]
    elif "Level 3" in interactivity_level or "Level 4" in interactivity_level:
        return COURSE_LEVEL_STRATEGIES["Level 3"]
    else:
        return COURSE_LEVEL_STRATEGIES["Level 2"]

def format_intake_text(intake_data: Dict) -> str:
    """Format intake data into readable text."""
    return f"""
Course Title: {intake_data.get('course_title', '')}
Business Unit: {intake_data.get('business_unit', '')}
Course Type: {intake_data.get('course_type', '')}
Target Audience: {intake_data.get('target_audience', '')}
Experience Level: {intake_data.get('experience_level', '')}
Geographic Spread: {intake_data.get('geographic_spread', '')}
Language Preference: {intake_data.get('language_preference', 'American English')}
Style Guide: {intake_data.get('style_guide', 'Clear, professional instructional design language')}
Guidelines: {intake_data.get('guidelines', '')}

Learning Objectives:
1. {intake_data.get('objective_1', '')}
2. {intake_data.get('objective_2', '')}
3. {intake_data.get('objective_3', '')}

Interactivity Level: {intake_data.get('interactivity_level', '')}
Output Required: {intake_data.get('output_required', '')}
"""
def get_language_rules(intake_data: Dict) -> str:
    preference = intake_data.get('language_preference', 'American English')
    if 'British' in preference:
        return "Use British English spelling and phrasing consistently, such as organise, behaviour, programme, and centre where appropriate."
    return "Use American English spelling and phrasing consistently, such as organize, behavior, program, and center where appropriate."


def get_quality_rules(intake_data: Dict) -> str:
    # If user uploaded a PDF style guide, prepend it as explicit AI instructions
    pdf_style_guide = intake_data.get("style_guide_pdf_text", "").strip()
    pdf_guide_section = ""
    if pdf_style_guide:
        pdf_guide_section = f"""
STYLE GUIDE / GUIDELINES PROVIDED BY USER (PDF UPLOAD):
{pdf_style_guide}

"""

    return f"""{pdf_guide_section}LANGUAGE AND STYLE:
- {get_language_rules(intake_data)}
- Follow this style guide: {intake_data.get('style_guide', 'Clear, professional, concise instructional design language.')}
- Apply these project guidelines: {intake_data.get('guidelines', 'Use plain language, correct spelling, and a consistent instructional tone.')}
- Run a spelling and grammar pass before finalizing. Do not output shuffled phrases, sentence fragments, or out-of-sequence content.
- Keep each paragraph logically ordered: concept, example, learner action, then feedback or takeaway.
"""



def get_knowledge_check_rules(intake_data: Dict) -> str:
    return f"""
KNOWLEDGE CHECK REQUIREMENTS:
- Add a dedicated Knowledge Check immediately after EACH content module, including after Module 1.
- Use {intake_data.get('knowledge_check_count', '3')} question(s) per module.
- Difficulty: {intake_data.get('knowledge_check_difficulty', 'Mixed')}.
- Allowed types: {intake_data.get('knowledge_check_types', 'Multiple Choice, True/False, Fill in the Blank, Scenario-Based')}.
- Each knowledge check must align to that module's objectives and include the correct answer plus feedback.
- Use varied assessment types across modules when multiple types are selected.
"""
@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, min=4, max=30), reraise=True)
def generate_design_document(api_key: str, intake_data: Dict, content: str) -> str:
    """Generate Design Document using Groq Llama 3.1 8B Instant."""
    try:
        if not api_key:
            raise HTTPException(status_code=401, detail="Groq API key is missing")

        client = genai.Client(api_key=api_key)
        strategies = get_strategy_for_level(intake_data.get('interactivity_level', ''))
        question_count = intake_data.get("question_count", "10")
        difficulty = intake_data.get("difficulty_level", "Medium")
        prompt = f"""You are an expert Instructional Designer creating a comprehensive Design Document.
        
INTAKE INFORMATION:
{format_intake_text(intake_data)}

REQUIRED VISUAL STRATEGIES:
{strategies['visual']}

REQUIRED INTERACTIVITY TYPES:
{strategies['interactivity']}

REQUIRED ASSESSMENT TYPES:
{strategies['assessment']}

{get_knowledge_check_rules(intake_data)}
{get_quality_rules(intake_data)}
SOURCE CONTENT:
{content[:2500]}

TASK:
Create a DETAILED Design Document following this EXACT structure.
The user wants "EXtreme Detail" and "Human Creativity" - do not summarize.

1. PROJECT INFORMATION
   - Project Name: {intake_data.get('course_title', '')}
   - Business Unit: {intake_data.get('business_unit', '')}
   - Target Audience: {intake_data.get('target_audience', '')}
   - Experience Level: {intake_data.get('experience_level', '')}
   - Date: {datetime.now().strftime('%Y-%m-%d')}

2. COURSE OVERVIEW
   - Context/Background: [2-3 sentences on why this training is needed based on the source content]
   - Project Goal: [1-2 sentences on business outcomes]
   - Duration: [Estimated total course duration]

3. LEARNING OBJECTIVES
   - {intake_data.get('objective_1', '')}
   - {intake_data.get('objective_2', '')}
   - {intake_data.get('objective_3', '')}

4. MODULE BREAKDOWN (CRITICAL: Use this EXACT table format with pipe separators - NO Markdown formatting inside cells)

Here is a GOLD STANDARD EXAMPLE of the detail required (Cybersecurity theme):
| Module | Delivery Mode | Learning Objectives | Topics | Recommended Strategy | Activities/Assessment | Duration |
|--------|---------------|---------------------|--------|----------------------|-----------------------|----------|
| Module 1: Introduction to Cybersecurity | Self-paced eLearning | • Define basic cyber security concepts.<br>• Explain why cyber security is critical for organizations.<br>• Identify common types of malware and cyber attacks encountered in day-to-day work.<br>• Recognize early warning signs of cyber threats.<br>• Understand the impact of security breaches on business continuity. | • Definition of Cyber Security<br>• Importance of Cyber Security<br>• Cyber Security in the Digital World<br>• Malware & Ransomware:<br>&nbsp;&nbsp;- Definition of malware and its types (viruses, worms, spyware, trojans).<br>&nbsp;&nbsp;- What is ransomware and how does it work?<br>&nbsp;&nbsp;- Consequences of malware and ransomware attacks.<br>• Social Engineering Attack:<br>&nbsp;&nbsp;- What is social engineering?<br>&nbsp;&nbsp;- Examples: pretexting, baiting, tailgating, and impersonation. | Real-world cyberattack examples set the stage, immediately immersing learners in the stakes of security. Interactive simulations then challenge users to identify phishing attempts in a safe, controlled environment. Case studies reveal the business impact of data breaches, followed by role-playing activities where learners must make critical security decisions under time pressure. The learning path concludes with a hands-on drag-and-drop exercise matching threats to defense strategies. | • Drag and drop cybersecurity concepts<br>• Multiple-choice questions on cybersecurity basics. | 2 hour |

NOW, generate the table for THIS course ({intake_data.get('course_title', 'Untitled')}) following that EXACT LEVEL OF DETAIL.

CRITICAL INSTRUCTIONS FOR GENERATION:
1.  **MODULE COUNT**: You MUST generate exactly {intake_data.get('num_modules', '3')} content modules (Module 1 to Module {intake_data.get('num_modules', '3')}).
2.  **FORBIDDEN PHRASES**: 
    *   **NEVER start Objectives with**: "This module will...", "Learners will be able to...", "By the end of this module...". **Start directly with the verb** (e.g., "Analyze...", "Create...", "Identify...").
    *   **NEVER start Strategies with**: "This module will...", "In this module...", "Learners will...". **Start with the action** (e.g., "A simulation explores...", "Case studies highlight...", "Interactive scenarios guided the learner...").
3.  **VARIETY**: Every module MUST sound different. Do not repeat sentence structures, examples, activities, or topic blocks.
4.  **ALIGNMENT**: Ensure "Recommended Strategy" and "Activities/Assessment" align with the specific Learning Objectives and ID Principles provided.

| Module | Delivery Mode | Learning Objectives | Topics | Recommended Strategy | Activities/Assessment | Duration |
|--------|---------------|---------------------|--------|----------------------|-----------------------|----------|
| Module 1: [Title] | Self-paced eLearning | • [Strong Verb] [Objective 1 - Detailed]<br>• [Strong Verb] [Objective 2 - Detailed]<br>• [Strong Verb] [Objective 3 - Detailed]<br>• [Strong Verb] [Objective 4 - Detailed] | • [Main Topic 1]<br>&nbsp;&nbsp;- [Sub-point 1]<br>&nbsp;&nbsp;- [Sub-point 2]<br>• [Main Topic 2]<br>&nbsp;&nbsp;- [Sub-point 1]<br>&nbsp;&nbsp;- [Sub-point 2]<br>• [Main Topic 3] | [EXTREMELY DETAILED strategy. Write 4-6 full sentences. Start with an action or description, NOT "Learners will". Tell a story of the learning experience.] | • [Specific Activity aligned to objectives]<br>• [Quiz details] | [Time] |
| Module 2: [Title] | Self-paced eLearning | • [Strong Verb] [Objective 1]<br>• [Strong Verb] [Objective 2]<br>• [Strong Verb] [Objective 3]<br>• [Strong Verb] [Objective 4] | • [Main Topic 1]<br>• [Main Topic 2 with detail breakdown]<br>• [Main Topic 3] | [EXTREMELY DETAILED strategy. Different opening style than Module 1. "A branching scenario allows..."] | • [Activity]<br>• [Quiz] | [Time] |
| ... [GENERATE EXACTLY {intake_data.get('num_modules', '3')} MODULES TOTAL] ... |
| Knowledge Check | Self-paced eLearning | • Assess understanding | MCQs; Scenario-based questions | Quiz Format | Multiple-choice quiz | 30 min |
| Summary & Conclusion | Self-paced eLearning | • Review key concepts | Summary & Key takeaways | Recap points | Certificate of Completion | 15 min |

IMPORTANT:

Every major section MUST begin with a Markdown heading.

Example:

## 5. INSTRUCTIONAL STRATEGY

## 6. ASSESSMENT STRATEGY

## 7. KNOWLEDGE CHECK

## 8. TECHNICAL SPECIFICATIONS

Do NOT use <br> tags between sections.
Do NOT continue a previous paragraph into a new section.
Leave one blank line before every heading.
## 5. INSTRUCTIONAL STRATEGY

- Pedagogy:
- Interactivity:
- Media:

## 6. ASSESSMENT STRATEGY

- Formative:
- Summative:
- Criteria:

## 7. KNOWLEDGE CHECK


Do NOT write the questions in paragraph form.
Each option must appear on its own line.
Leave one blank line between questions.



Generate a Knowledge Check after the Assessment Strategy using the following structure.

For each module include:
- Question Type
- Question
- Options (MCQ only)
- Correct Answer
- Explanation

Supported question types:
- Multiple Choice
- True / False
- Fill in the Blank
- Scenario-Based

Formatting Rules:
- Number questions sequentially.
- Each option must appear on a separate line.
- Leave one blank line between questions.
- Include at least one question for every module.
Formatting Requirements:

- Use headings:
  ## KNOWLEDGE CHECK
  ### Module X

- Every question must include:
  Question Type
  Question
  Correct Answer
  Explanation

- For MCQs, each option must appear on its own line.

- Leave one blank line between questions.

Do not compress questions into paragraphs.

Each label (Question Type, Question, Options, Correct Answer, Explanation) must appear on its own line.

Each answer option must appear on a separate line.

Do not omit headings such as "### Module X".
Generate exactly {question_count} assessment questions based on the course content.

Distribute the assessment types intelligently across all modules while maintaining a balanced mix.

Recommended distribution:

- 40% Multiple Choice
- 20% True / False
- 20% Fill in the Blank
- 20% Scenario-Based

If the total number of questions does not divide evenly among assessment types, prioritize Multiple Choice and Scenario-Based questions.

The assessment mix should remain appropriate for both the selected interactivity level and the uploaded course content.

Instructions

- Generate exactly {question_count} questions.

- Difficulty Level: {difficulty}

- Distribute the {question_count} questions as evenly as possible across all modules.

- Every module must contain at least one Knowledge Check question.

- If an equal distribution is not possible, assign the extra questions to the largest or most concept-rich modules.

- Number questions sequentially throughout the Knowledge Check.

Example:

Module 1
Question 1
Question 2

Module 2
Question 3
Question 4

Module 3
Question 5
Question 6

- Questions must assess only concepts taught within their corresponding module.

- Do NOT ask questions about concepts that have not yet been introduced.

Apply the selected difficulty consistently throughout the Knowledge Check.

Easy
- Focus on recalling terminology, facts, definitions and basic concepts.
- Use straightforward wording.
- Use obvious distractors.
- Avoid multi-step reasoning.

Medium
- Test conceptual understanding and practical application.
- Include workplace examples where appropriate.
- Require interpretation before answering.

Hard
- Focus on analysis, evaluation, decision-making and problem solving.
- Use realistic workplace scenarios.
- Require learners to apply multiple concepts together.
- Include plausible distractors that require critical thinking.

Assessment Quality Requirements

- Include a balanced variety of question types:
    - Multiple Choice
    - True / False
    - Fill in the Blank
    - Scenario-Based

- Each question must assess an important learning objective from its corresponding module.

- Every question must include:
    - Question Type
    - Question
    - Options (Multiple Choice only)
    - Correct Answer
    - Brief Explanation (1–2 sentences)

- Questions should follow Bloom's Taxonomy progression appropriate for the selected difficulty level, moving from:
    Recall → Understand → Apply → Analyze → Evaluate

- Do not repeat the same concept unless it is being assessed from a different perspective.

- Avoid duplicate questions.

- Ensure every answer is factually correct.

- Every answer must be derived ONLY from the uploaded source content.

- Do not invent facts.

- Do not generate placeholder text.

- Every question must be fully written using actual concepts from the uploaded source material.

Before returning the Knowledge Check, verify that:

- Exactly {question_count} questions have been generated.
- Every question belongs to a module.
- Every module has at least one question.
- Question numbering is sequential.
- The selected difficulty level has been followed consistently.
- The assessment types are balanced.
- Every answer is supported by the uploaded source material.
- No placeholder text remains anywhere in the output.

## 8. TECHNICAL SPECIFICATIONS
   - LMS: SCORM 1.2
   - Devices: Desktop/Laptop, Tablet

IMPORTANT INSTRUCTIONS:
- **TONE**: Write in a **natural, professional human voice**. Avoid AI buzzwords like "delve", "comprehensive tapestry", "ensure", "foster". Use active voice.
- **NO EXTRA HEADINGS**: Do not add extra bold section headers (e.g. "**Project Information**") before the numbered sections (e.g. "1. PROJECT INFORMATION"). Start sections directly with the number.
- **NO REPETITION**: Do not repeat phrasing across modules. Make each strategy unique and specific to the content.
- **NARRATIVE FLOW**: In "Recommended Strategy", tell a story of how the learner experiences the module.
- EXTRACT EXTENSIVE DETAILS from the source content.
- NO GENERIC PLACEHOLDERS.
- Do NOT use bold ** or italic * formatting inside the table cells. Keep text clean.
- Use <br> for line breaks within table cells.
- Ensure the table structure is perfect.

Generate the complete Design Document now:"""

        response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=(
            "You are an expert Instructional Designer who creates detailed "
            "professional Design Documents.\n\n"
            + prompt
        ),
    )

        result = response.text
      
        return fix_markdown_tables(result)
            
    except Exception as e:
        traceback.print_exc()
        raise

import time as _time

def _generate_single_module_type1(client, module_num: int, total_modules: int, design_doc: str, intake_data: Dict, content: str, strategies: Dict) -> str:
    """Generate storyboard for a single module (Type 1 format). Kept under 6000 TPM."""
    module_knowledge_check = extract_module_knowledge_check(design_doc, module_num)
    prompt = f"""Generate storyboard for MODULE {module_num} ONLY (of {total_modules}).

DESIGN DOCUMENT:
{design_doc[:2200]}

MODULE KNOWLEDGE CHECK:
{module_knowledge_check}

SOURCE CONTENT (REFERENCE ONLY)

---------------- START SOURCE ----------------

{content[:1200]}

---------------- END SOURCE ----------------
IMPORTANT:

Use the SOURCE CONTENT only as reference material.

Do NOT copy paragraphs.

Do NOT summarize the source.

Do NOT reproduce the source document.


RULES:
- OST: Actual text learner reads. Real facts, definitions, bullet points. NEVER "The narrator explains..."
- INTRODUCTION SCREEN OST: Never write generic greetings such as "Welcome to this module" in the On-Screen Text. The OST for Screen {module_num}.1 must contain meaningful, module-specific content derived from the Design Document and Source Content, such as the module topic, key concepts, or learning focus. Welcome greetings are allowed only in AUDIO NARRATION.
- AUDIO: Actual narrator script. Conversational, professional, 5-8 sentences. End with "Click Next to continue." NEVER "The narrator says..."
- VISUAL: Specific designer directions. Name images ("Show static image of X"), describe animations, layout, navigation.
- No placeholders. No AI buzzwords. Content from source only.
- Use <br> for line breaks in cells. Each row = ONE line.
- LANGUAGE: Write the entire storyboard in {intake_data.get('preferred_english', 'American English')}. Follow the spelling, grammar, punctuation, and vocabulary conventions of that English variant consistently.

KNOWLEDGE CHECK REQUIREMENTS:

- At the end of every module, generate ONE dedicated Knowledge Check screen.

- Use ONLY the Knowledge Check questions provided under "MODULE KNOWLEDGE CHECK".

- Do NOT generate new questions.

- Do NOT modify the wording of the provided questions unless required for grammar or formatting.

- The Knowledge Check screen must include:
    - Screen Title: Knowledge Check
    - Question Type
    - Question
    - Options (if applicable)
    - Correct Answer
    - Explanation
    - Audio narration instructing the learner to answer the question before proceeding.
    - Visual instructions describing interactive answer buttons and immediate learner feedback.

- The Knowledge Check must always be the FINAL screen of Module {module_num}.
- The Knowledge Check Screen value MUST begin with "Module {module_num} - Screen {module_num}." and end with " - Knowledge Check".
- If no Module Knowledge Check is provided, skip the Knowledge Check screen and generate only the instructional screens.
- The Knowledge Check must be represented as ONE table row.

- Do not create a separate section.

- Do not leave the table.
FORMAT:

Return ONE valid GitHub-Flavored Markdown table.

The table MUST contain EXACTLY these four columns.

| Screen | ON-SCREEN TEXT (OST) | AUDIO NARRATION | VISUAL INSTRUCTIONS & DEVELOPER NOTES |
|--------|-----------------------|-----------------|---------------------------------------|
| Module {module_num} - Screen {module_num}.1 - Introduction | Module title or topic-specific introductory content.<br>Key learning point 1.<br>Key learning point 2. | Welcome to this module. In this lesson, we will explore the key concepts and learning objectives for this module. Click Next to continue. | Show title banner, relevant topic-specific icon and fade-in animation. |
| Module {module_num} - Screen {module_num}.2 - Main Concept | Explain the concept using concise learner-facing text.<br>Additional learner-facing point. | Explain the concept conversationally. End with "Click Next to continue." | Show infographic and highlight important elements. |

Continue using EXACTLY the same table structure.

Rules:

- Every screen must be one table row.
- The Screen column must contain the module number, screen number, and screen title.
- Every Screen value MUST begin with "Module {module_num} - Screen {module_num}." followed by the screen number and title.
- Examples: "Module {module_num} - Screen {module_num}.1 - Introduction" and "Module {module_num} - Screen {module_num}.2 - Main Concept".
- Never omit the module number from the Screen column.
- Never output standalone headings such as:
  - Module {module_num}
  - Screen {module_num}.1 Title
- Every row must begin with |
- Every row must end with |
- Never insert blank lines inside the table.
- Use <br> for line breaks inside cells.
- The final row must be the Knowledge Check.
CRITICAL OUTPUT RULES

- Return ONLY one Markdown table.
- Do not output any headings outside the table.
- Do not output Module titles outside the table.
- Do not output Screen titles outside the table.
- Every row must start with "|" and end with "|".
- Every row must contain exactly four columns.
- Never merge two screens into one row.

- Never split one screen into multiple rows.
- Use <br> for line breaks inside cells.
- Never insert blank lines inside the table.
- Stop immediately after the Knowledge Check row.
CRITICAL:
The Knowledge Check table must use exactly the same number of columns as every other storyboard row.

Every Knowledge Check row must begin and end with the "|" character.

Do not output standalone lines such as
"Visual Instructions:"
or
"Audio Narration:"

Everything must remain inside Markdown table cells.
Do not close the table until the final Knowledge Check row has been completed."""
    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=(
            """You are a senior eLearning Storyboard Developer.

Always return valid GitHub-Flavored Markdown.

Every response must be exactly one Markdown table.

Never output standalone headings.

Never output Module titles outside the table.

Never output Screen titles outside the table.

Every value in the Screen column must begin with the current module identifier.

Every row begins with "|" and ends with "|".

Never omit the Markdown separator row immediately after the table header.

Use <br> inside table cells.

Do not use Markdown bullet lists inside table cells.

Do not leave the table until the Knowledge Check row is complete.

"""
            + prompt
        ),
    )

    return response.text


def _generate_single_module_type2(client, module_num: int, total_modules: int, design_doc: str, intake_data: Dict, content: str, strategies: Dict) -> str:
    """Generate storyboard for a single module (Type 2 tabular format). Kept under 6000 TPM."""

    module_knowledge_check = extract_module_knowledge_check(design_doc, module_num)

    prompt = f"""Generate Type 2 tabular storyboard for MODULE {module_num} ONLY (of {total_modules}).


DESIGN DOCUMENT:
{design_doc[:2200]}

MODULE KNOWLEDGE CHECK:
{module_knowledge_check}

SOURCE CONTENT (REFERENCE ONLY)

---------------- START SOURCE ----------------

{content[:1200]}

---------------- END SOURCE ----------------
IMPORTANT:

Use the SOURCE CONTENT only as reference material.

Do NOT copy paragraphs.

Do NOT summarize the source.

Do NOT reproduce the source document.



RULES:
{get_quality_rules(intake_data)}
{get_knowledge_check_rules(intake_data)}
- Include a Knowledge Check row as the final row for this module.
- SECTION: Every Section value MUST begin with "Module {module_num} - ". Examples: "Module {module_num} - Introduction", "Module {module_num} - Core Concepts", "Module {module_num} - Activity", "Module {module_num} - Summary", and "Module {module_num} - Knowledge Check".
- Never omit the module number from the Section column.
- TOPICS: Specific objectives and concise learner-facing statements separated using <br>.
- VISUAL: Specific directions ("Show static image of X", animations, layouts, facilitator videos).
- OST: Actual learner-facing text. Present concise facts and definitions separated with <br>. NEVER meta-descriptions.
- INTRODUCTION SCREEN OST: Never write generic greetings such as "Welcome to this module" in the On-Screen Text. The OST for the introduction row must contain meaningful, module-specific content derived from the Design Document and Source Content, such as the module topic, key concepts, or learning focus. Welcome greetings are allowed only in AUDIO NARRATION.
- AUDIO: Actual narrator script. Conversational, professional. NEVER "The narrator explains". Include cues like "Show image #1>>". End with "Click Next to continue."
- STATUS: "Draft".
- ACTIONS: Production notes ("Slide design required", "Animation needed").
- Use <br> for line breaks. Each row = ONE line. 7 columns exactly.
- LANGUAGE: Write the entire storyboard in {intake_data.get('preferred_english', 'American English')}. Follow the spelling, grammar, punctuation, and vocabulary conventions of that English variant consistently.
KNOWLEDGE CHECK REQUIREMENTS:

- At the end of every module, generate ONE dedicated Knowledge Check screen.

- Use ONLY the Knowledge Check questions provided under "MODULE KNOWLEDGE CHECK".

- Do NOT generate new questions.

- Do NOT modify the wording of the provided questions unless required for grammar or formatting.

- The Knowledge Check screen must include:
    - Screen Title: Knowledge Check
    - Question Type
    - Question
    - Options (if applicable)
    - Correct Answer
    - Explanation
    - Audio narration instructing the learner to answer the question before proceeding.
    - Visual instructions describing interactive answer buttons and immediate learner feedback.

- The Knowledge Check must always be the FINAL screen of Module {module_num}.

- If no Module Knowledge Check is provided, skip the Knowledge Check screen and generate only the instructional screens.



FORMAT:

Return ONE valid GitHub-Flavored Markdown table.

The table MUST contain EXACTLY these seven columns.

| Section | Topics | Visual Instructions & Developer Notes | On-Screen Text | Audio Narration | Status | Actions Required |
|---------|--------|----------------------------------------|----------------|-----------------|--------|------------------|
| Module {module_num} -| Introduction | Cyber Security Basics<br>Threat Landscape | Show title banner and cyber security icon. | Cyber security protects systems, networks, and information.<br>This module explores key threats and fundamental protection concepts. | Welcome to this module. Today we will explore cyber security fundamentals and the key concepts covered in this module. Click Next to continue. | Draft | Create title slide | 
| Module {module_num} - Core Concepts | Malware<br>Phishing | Show malware infographic. | Malware includes viruses, worms and trojans.<br>Phishing targets users through deception. | Let's understand the most common cyber threats. Click Next to continue. | Draft | Design infographic |


Continue using EXACTLY the same table structure.

Rules:

- Every screen must be one table row.
- Every row begins with "|".
- Every row ends with "|".
- Every row contains exactly seven columns.
- The Markdown separator row (|----|----|...) must appear immediately after the table header.
- Never merge two screens into one row.
- Never split one screen into multiple rows.
- Never insert blank lines inside the table.
- Use <br> for line breaks inside cells.
- The Knowledge Check must be the final table row, and its Section value MUST be "Module {module_num} - Knowledge Check".
- Do not close the table until the final Knowledge Check row has been completed.
- The Knowledge Check must remain inside the table.

CRITICAL OUTPUT RULES

- Return ONLY one Markdown table.
- Do not output any headings outside the table.
- Every row must begin with "|" and end with "|".
- Every row must contain exactly seven columns.
- Never merge two screens into one row.
- Never split one screen into multiple rows.
- Never insert blank lines inside the table.
- Stop immediately after the Knowledge Check row.

CRITICAL:
The Knowledge Check table must use exactly the same number of columns as every other storyboard row.

Every Knowledge Check row must begin and end with the "|" character.

Do not output standalone lines such as
"Visual Instructions:"
or
"Audio Narration:"

Everything must remain inside Markdown table cells.
Return nothing except the completed Markdown table."""

    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=(
        """You are a senior eLearning Storyboard Developer.

Always return valid GitHub-Flavored Markdown.

Every response must be exactly one Markdown table.

Never output standalone headings.

Never output Module titles outside the table.

Never output Screen titles outside the table.

Every value in the Section column must begin with the current module identifier, for example "Module 1 - Introduction".

Every row begins with "|" and ends with "|".

Never omit the Markdown separator row immediately after the table header.

Use <br> inside table cells.

Do not use Markdown bullet lists inside table cells.

Do not leave the table until the Knowledge Check row is complete.

"""
        + prompt
        ),
    )

    return response.text

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=3, min=5, max=60), reraise=True)
def _call_module_with_retry(generate_fn, client, module_num, total_modules, design_doc, intake_data, content, strategies):
    """Wrapper to retry individual module generation with exponential backoff for rate limits."""
    return generate_fn(client, module_num, total_modules, design_doc, intake_data, content, strategies)
def extract_module_knowledge_check(design_doc: str, module_num: int) -> str:
    """
    Extract the Knowledge Check for a specific module from the Design Document.
    """
    if not design_doc:
        return ""

    start = design_doc.find("7. KNOWLEDGE CHECK")
    if start == -1:
        return ""

    knowledge_section = design_doc[start:]

    possible_headers = [
        f"### Module {module_num}",
        f"Module {module_num}"
    ]

    module_start = -1
 
    for header in possible_headers:
        module_start = knowledge_section.find(header)
        if module_start != -1:
            break

    possible_next_headers = [
        f"### Module {module_num + 1}",
        f"Module {module_num + 1}"
    ]


    if module_start == -1:
        return ""

    module_end = -1

    for header in possible_next_headers:
        module_end = knowledge_section.find(header, module_start)
        if module_end != -1:
            break
    

    if module_end == -1:
        return knowledge_section[module_start:].strip()

    return knowledge_section[module_start:module_end].strip()

def generate_storyboard(api_key: str, design_doc: str, intake_data: Dict, content: str, storyboard_type: str) -> str:
    """Generate Storyboard module-by-module to avoid token truncation."""
    try:
        if not api_key:
            raise HTTPException(status_code=401, detail="Groq API key is missing")

        client = genai.Client(api_key=api_key)
        strategies = get_strategy_for_level(intake_data.get('interactivity_level', ''))
        num_modules = int(intake_data.get('num_modules', 3))

        generate_fn = _generate_single_module_type1 if storyboard_type == "Type 1" else _generate_single_module_type2

        course_title = intake_data.get('course_title', 'Untitled Course')
        all_modules = []
        all_modules.append(f"# STORYBOARD â€” {course_title}\n")

        for i in range(1, num_modules + 1):
            module_content = _call_module_with_retry(
                generate_fn,
                client,
                i,
                num_modules,
                design_doc,
                intake_data,
                content,
                strategies
            )

            print("\n" + "=" * 80)
            print(f"MODULE {i} RAW OUTPUT")
            print("=" * 80)
            print(module_content)
            print("=" * 80 + "\n")

            all_modules.append(module_content)
            # Rate limit delay between modules (Groq free tier)
            # 20s gap prevents TPM (tokens per minute) limit errors with larger outputs
            if i < num_modules:
                _time.sleep(20)
        return "\n\n---\n\n".join(all_modules)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating Storyboard: {str(e)}")

def fix_markdown_tables(text: str):
    """Post-process AI output to fix common markdown table formatting issues.
    
    Fixes:
    1. Heading markers (##) on pipe-delimited table rows
    2. Bold wrappers (**) around table rows
    3. Missing leading/trailing pipes
    4. Missing separator lines
    5. CRITICAL: Merges 'continuation rows' â€” rows that are missing pipes 
       or have very few pipes, which means the AI split a single cell 
       across multiple lines.
    """
    if not text:
        return text
    
    lines = text.split('\n')
    
    # === PASS 1: Normalize & Fix basic formatting ===
    pass1 = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            pass1.append("")
            continue
            
        # Remove heading markers from table lines
        heading_match = re.match(r'^(#{1,6})\s*(.+\|.+)$', stripped)
        if heading_match:
            stripped = heading_match.group(2).strip()
            line = stripped
        
        # Remove bold wrappers from table rows
        bold_match = re.match(r'^\*\*(.+\|.+)\*\*$', stripped)
        if bold_match:
            stripped = bold_match.group(1).strip()
            line = stripped
            
        pass1.append(line)
        
    # === PASS 2: Table Reconstruction & Continuation Merging ===
    final = []
    i = 0
    while i < len(pass1):
        line = pass1[i]
        stripped = line.strip()
        
        # Detect if this line looks like a table row (contains pipes) or follows one
        is_sep = bool(re.match(r'^\|?[\s\-:|]+\|?$', stripped))
        pipe_count = stripped.count('|')
        
        # If it's a separator, ensure it has enough pipes if possible
        if is_sep and final and final[-1].strip().count('|') >= 2:
            prev_cols = final[-1].strip().count('|') - (1 if final[-1].strip().startswith('|') else 0) - (1 if final[-1].strip().endswith('|') else 0) + 1
            if pipe_count < 2: # Fix |---| style
                line = '|' + '|'.join(['---'] * prev_cols) + '|'
            final.append(line)
            i += 1
            continue

        # Logic: If a line has 2+ pipes, it's a row.
        # If the next few lines are "loose" (0 pipes or 1 pipe), they belong to this row.
        # Valid storyboard rows always contain several pipes.
        # Ignore short accidental pipe usage inside text.
        if pipe_count >= 4:
            # Ensure it starts and ends with pipes.
            if not stripped.startswith('|'): stripped = '| ' + stripped
            if not stripped.endswith('|'): stripped = stripped + ' |'
            
            # Extract cells
            current_cells = [c.strip() for c in stripped[1:-1].split('|')]
            # Keep storyboard tables structurally consistent.
            # Type 1 = 3 columns
            # Type 2 = 7 columns
            if len(current_cells) < 3:
                current_cells.extend([""] * (3 - len(current_cells)))
            
            j = i + 1
            while j < len(pass1):
                next_line = pass1[j]
                next_stripped = next_line.strip()
                
                # If next line is empty, skip it and continue lookahead (AI often adds random newlines)
                if not next_stripped:
                    j += 1
                    continue
                
                next_pipe_count = next_stripped.count('|')
                
                # CRITICAL: If the next line has 2+ pipes, it's definitely a NEW row. Stop lookahead.
                if next_pipe_count >= 2:
                    break
                    
                # If it's a header or obvious non-table text, stop.
                if next_stripped.startswith('#') or next_stripped.upper().startswith('SCREEN') or next_stripped.upper().startswith('MODULE'):
                    break
                
                # Merge into the last non-empty cell (usually Actions/Visuals or OST)
                for idx in range(len(current_cells)-1, -1, -1):
                    if current_cells[idx] or idx == 0:
                        # Prevent duplicate breaks.
                        if current_cells[idx]:
                            current_cells[idx] += "<br>" + next_stripped
                        else:
                            current_cells[idx] = next_stripped
                        break
                j += 1
            
            # Rebuild the markdown row cleanly.
            rebuilt_row = "| " + " | ".join(cell.strip() for cell in current_cells) + " |"
            final.append(rebuilt_row)
            i = j
        else:
            final.append(line)
            i += 1
            
    return '\n'.join(final)
    


@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, min=4, max=30), reraise=True)
def beautify_uploaded_content(api_key: str, content: str, target_type: str, storyboard_type: Optional[str] = None) -> str:
    """Uses AI to format a raw file dump into a professional project document."""
    try:
        if not api_key:
            raise HTTPException(status_code=401, detail="Gemini API key is missing")

        client = genai.Client(api_key=api_key)
        
        # Storyboard Format Detection
        is_storyboard_type2 = False
        if target_type == "storyboard":
            if storyboard_type == "Type 2":
                 is_storyboard_type2 = True
            elif storyboard_type == "Type 1":
                 is_storyboard_type2 = False
            else:
                # Auto-detect if not explicitly provided
                # Check for 7-column pattern in first 10,000 characters
                sample_lines = content[:10000].split('\n')
                for line in sample_lines:
                    if line.count('|') >= 7: 
                        is_storyboard_type2 = True
                        break
        
        doc_name = "Design Document" if target_type == "design_doc" else "Storyboard"
        
        design_doc_rules = """
2. TARGET DOCUMENT: Design Document (High-Level Course Map)
   - METADATA RULE: Headers like "TRAINING PROGRAM FOR IT", "Trainers", or "Instructor" MUST be standard text headers (###) outside the table.
   - CRITICAL: NEVER put "Program Titles" or "Trainers" as headers of a Markdown table.
   - TABLE START: The table MUST start with exactly these headers: | Module | Delivery Mode | Learning Objectives | Topics | Recommended Strategy | Activities/Assessment | Duration
   - AGGREGATION: You MUST group all content for one module (e.g., Module 1) into exactly ONE row. Use <br> for bullet points.
   - DO NOT create multiple rows for the same module. If you see objectives scattered across lines, MERGE THEM into the 'Learning Objectives' cell."""

        # Type 1 Storyboard Rules (3 Columns)
        type1_storyboard_rules = """
2. TARGET DOCUMENT: Storyboard (3-Column Format)
   - You MUST act as a STRICT LITERAL MAPPER.
   - For EACH screen, you MUST output:
     Screen X.X Title: [Title Name]
     
     | On-Screen Text (OST) | Audio Narration | Visual Instructions & Developer Notes |
     | :--- | :--- | :--- |
     | [OST content] | [Narration content] | [Visuals content] |
     
   - EACH screen title and table MUST be on its own line.
   - Use <br> for line breaks inside table cells.
   - DO NOT combine multiple screens into one table.
   - DO NOT summarize or truncate. Output the ENTIRE document exactly as provided."""

        # Type 2 Storyboard Rules (7 Columns)
        type2_storyboard_rules = """
2. TARGET DOCUMENT: Storyboard (7-Column Format)
   - You MUST act as a STRICT LITERAL MAPPER for this tabular format.
   - You MUST output a Markdown table with EXACTLY 7 COLUMNS for each module.
   - HEADERS: Section | Topics | Visual Instructions/Developer Notes | On-screen text | Audio Narration | Status | Actions required
   - YOU MUST output the standard Markdown separator line exactly like this after the headers: `|---|---|---|---|---|---|---|`
   - For EACH module, start with a header like "MODULE X: [Module Title]".
   - Use <br> for line breaks inside cells.
   - DO NOT summarize or truncate. Output the ENTIRE document exactly as provided."""

        if target_type == "design_doc":
            type_rules = design_doc_rules
        elif is_storyboard_type2:
            type_rules = type2_storyboard_rules
        else:
            type_rules = type1_storyboard_rules

        overview_rule = ""
        if target_type == "design_doc":
            overview_rule = '4. STRUCTURE: Add a professional "PROJECT INFORMATION" and "COURSE OVERVIEW" section at the VERY TOP.'
        else:
            overview_rule = '4. STRUCTURE: DO NOT include Project Information or Course Overview. Start directly with the first Module or Screen header.'

        prompt = f"""You are an expert Instructional Designer. 
I have extracted raw text from an uploaded file (likely an Excel or PPTX). 

TASK:
Convert this raw text into a professional {doc_name} ONLY in Markdown format.

THE INPUT DATA:
This is raw text extracted from a file. If it was extracted from a spreadsheet, columns will be separated by pipes (|).

STRICT RULES:
1. YOU ARE A REFORMATTER, NOT A SUMMARIZER. Do not discard any info. You must return 100% of the original content.
{type_rules}

3. CRITICAL TABLE FORMATTING RULES (MUST FOLLOW EXACTLY):
   - NEVER use Markdown heading syntax (## or #) on a line that contains a table row with pipes.
   - EVERY table row (header AND data) MUST start with | and end with |
   - The separator line MUST appear immediately after the header row (e.g. |---|---|---|)
   - There MUST be a blank line before the table header and after the last table row
   - Do NOT wrap table rows in bold (**) markers

{overview_rule}

5. FORMAT:
   - Use professional language. No AI fluff.
   - Do NOT add introductory text. Just the Markdown doc.
   - Do NOT use heading syntax (# or ##) on any line that contains pipe characters (|).

RAW EXTRACTED CONTENT:
{content[:25000]}

Generate the professional {doc_name} Markdown now:"""

        # Using the most powerful 70B model for multi-instruction adherence
        print("Using Gemini 2.5 Flash for High-Precision Beautify...")

        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=(
                "You are a master Instructional Designer. "
                "You follow structural and formatting constraints perfectly. "
                "You never put non-table data inside a table.\n\n"
                + prompt
            ),
        )

        result = response.text

        return fix_markdown_tables(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error beautifying content: {str(e)}")




