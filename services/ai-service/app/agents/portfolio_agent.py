from app.agents.base import Agent
from app.prompts.system import PORTFOLIO_AGENT_V1


class PortfolioAgent(Agent):
    name = "portfolio_agent"
    system = PORTFOLIO_AGENT_V1
    model_class = "reasoning"
