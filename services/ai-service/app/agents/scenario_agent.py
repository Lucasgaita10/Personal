from app.agents.base import Agent
from app.prompts.system import SCENARIO_AGENT_V1


class ScenarioAgent(Agent):
    name = "scenario_agent"
    system = SCENARIO_AGENT_V1
    model_class = "reasoning"
