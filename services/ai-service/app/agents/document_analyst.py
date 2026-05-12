from app.agents.base import Agent
from app.prompts.system import DOCUMENT_ANALYST_V1


class DocumentAnalyst(Agent):
    name = "document_analyst"
    system = DOCUMENT_ANALYST_V1
    model_class = "default"
