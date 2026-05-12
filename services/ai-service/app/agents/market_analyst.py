from app.agents.base import Agent
from app.prompts.system import MARKET_ANALYST_V1


class MarketAnalyst(Agent):
    name = "market_analyst"
    system = MARKET_ANALYST_V1
    model_class = "reasoning"
