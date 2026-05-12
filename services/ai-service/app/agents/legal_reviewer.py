from app.agents.base import Agent
from app.prompts.system import LEGAL_REVIEWER_V1


class LegalReviewer(Agent):
    name = "legal_reviewer"
    system = LEGAL_REVIEWER_V1
    model_class = "reasoning"
