from app.agents.base import Agent
from app.prompts.system import IC_CHALLENGER_V1


class ICChallenger(Agent):
    name = "ic_challenger"
    system = IC_CHALLENGER_V1
    model_class = "reasoning"
