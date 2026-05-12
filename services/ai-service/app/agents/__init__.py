from app.agents.document_analyst import DocumentAnalyst
from app.agents.financial_analyst import FinancialAnalyst
from app.agents.risk_analyst import RiskAnalyst
from app.agents.market_analyst import MarketAnalyst
from app.agents.market_researcher import MarketResearcher
from app.agents.legal_reviewer import LegalReviewer
from app.agents.ic_writer import ICWriter
from app.agents.challenger import ICChallenger
from app.agents.scenario_agent import ScenarioAgent
from app.agents.portfolio_agent import PortfolioAgent
from app.agents.gap_agent import GapAgent
from app.agents.synthesis import SynthesisAgent

REGISTRY = {
    "document_analyst": DocumentAnalyst(),
    "financial_analyst": FinancialAnalyst(),
    "risk_analyst": RiskAnalyst(),
    "market_analyst": MarketAnalyst(),
    "market_researcher": MarketResearcher(),
    "legal_reviewer": LegalReviewer(),
    "ic_writer": ICWriter(),
    "ic_challenger": ICChallenger(),
    "scenario_agent": ScenarioAgent(),
    "portfolio_agent": PortfolioAgent(),
    "gap_agent": GapAgent(),
    "synthesis_agent": SynthesisAgent(),
}
