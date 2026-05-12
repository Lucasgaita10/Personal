from app.agents.base import Agent
from app.prompts.system import IC_WRITER_V1


class ICWriter(Agent):
    name = "ic_writer"
    system = IC_WRITER_V1
    model_class = "reasoning"  # Opus for memo writing
