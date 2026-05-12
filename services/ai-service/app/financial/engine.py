"""Deterministic financial computations: IRR, MOIC, DSCR, scenario recompute.

These functions are intentionally numeric-only and side-effect free so they
can be reused by the scenario API and by the IC writer.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

import numpy as np


def npv(rate: float, cashflows: Sequence[float]) -> float:
    return float(sum(cf / ((1 + rate) ** t) for t, cf in enumerate(cashflows)))


def irr(cashflows: Sequence[float], guess: float = 0.1) -> float:
    """Newton-Raphson IRR. Returns NaN on failure."""
    rate = guess
    for _ in range(100):
        f = npv(rate, cashflows)
        d = sum(-t * cf / ((1 + rate) ** (t + 1)) for t, cf in enumerate(cashflows))
        if d == 0:
            break
        new_rate = rate - f / d
        if abs(new_rate - rate) < 1e-7:
            return new_rate
        rate = new_rate
    # Fallback to bisection
    lo, hi = -0.99, 5.0
    for _ in range(200):
        mid = (lo + hi) / 2
        v = npv(mid, cashflows)
        if abs(v) < 1e-6:
            return mid
        if v > 0:
            lo = mid
        else:
            hi = mid
    return float("nan")


def moic(cashflows: Sequence[float]) -> float:
    inflows = sum(cf for cf in cashflows if cf > 0)
    outflows = -sum(cf for cf in cashflows if cf < 0)
    if outflows == 0:
        return float("nan")
    return inflows / outflows


def dscr(noi: float, debt_service: float) -> float:
    if debt_service == 0:
        return float("inf")
    return noi / debt_service


def debt_yield(noi: float, loan_amount: float) -> float:
    if loan_amount == 0:
        return float("inf")
    return noi / loan_amount


def cap_rate(noi: float, value: float) -> float:
    if value == 0:
        return float("nan")
    return noi / value


def break_even_occupancy(
    fixed_costs: float, debt_service: float, gross_potential_rent: float
) -> float:
    if gross_potential_rent == 0:
        return float("nan")
    return (fixed_costs + debt_service) / gross_potential_rent


@dataclass
class BaseCase:
    """Minimal underwriting structure used to recompute scenarios."""

    purchase_price: float
    equity_invested: float
    loan_amount: float
    interest_rate: float       # annual
    amortization_years: int
    hold_years: int
    base_noi: float            # year 1
    rent_growth: float         # e.g. 0.03
    expense_growth: float = 0.025
    occupancy: float = 0.95
    exit_cap: float = 0.06
    capex_per_year: float = 0.0


@dataclass
class CaseResult:
    irr: float
    moic: float
    dscr_min: float
    cash_on_cash: float
    break_even_occupancy: float
    cashflow: list[dict] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def _annual_debt_service(loan: float, rate: float, years: int) -> float:
    if rate == 0:
        return loan / years if years else 0.0
    n = years
    return loan * (rate * (1 + rate) ** n) / (((1 + rate) ** n) - 1)


def run_case(
    case: BaseCase,
    *,
    vacancy: float = 0.0,
    rate_shock_bps: float = 0.0,
    exit_cap_bps: float = 0.0,
    rent_growth_delta: float = 0.0,
    refinance_available: bool = True,
    noi_haircut: float = 0.0,
    capex_overrun: float = 0.0,
) -> CaseResult:
    rate = case.interest_rate + rate_shock_bps / 10_000
    exit_cap = case.exit_cap + exit_cap_bps / 10_000
    growth = case.rent_growth + rent_growth_delta
    occupancy = max(0.0, case.occupancy - vacancy)
    annual_ds = _annual_debt_service(case.loan_amount, rate, case.amortization_years)

    cashflow: list[dict] = [{"year": 0, "value": -case.equity_invested}]
    dscrs: list[float] = []
    cf_series: list[float] = [-case.equity_invested]
    noi = case.base_noi * (1 - noi_haircut)
    capex = case.capex_per_year * (1 + capex_overrun)

    for y in range(1, case.hold_years + 1):
        eff_noi = noi * occupancy
        ds = annual_ds
        free_cf = eff_noi - ds - capex
        if y == case.hold_years:
            sale_price = (eff_noi * (1 + growth)) / max(exit_cap, 1e-6)
            equity_at_exit = sale_price - case.loan_amount
            if not refinance_available and free_cf < 0:
                equity_at_exit *= 0.85  # haircut on forced sale
            free_cf += equity_at_exit
        cashflow.append({"year": y, "value": float(round(free_cf, 2))})
        cf_series.append(free_cf)
        dscrs.append(dscr(eff_noi, ds))
        noi *= 1 + growth

    irr_v = irr(cf_series)
    moic_v = moic(cf_series)
    coc = (cashflow[1]["value"]) / case.equity_invested if case.equity_invested else 0.0
    be = break_even_occupancy(
        case.capex_per_year + capex, annual_ds, case.base_noi or 1.0
    )

    notes = []
    if dscrs and min(dscrs) < 1.0:
        notes.append("DSCR breaches 1.00x in at least one period")
    if not refinance_available:
        notes.append("Refinance unavailable — forced sale assumed at exit")

    return CaseResult(
        irr=float(irr_v),
        moic=float(moic_v),
        dscr_min=float(min(dscrs)) if dscrs else float("nan"),
        cash_on_cash=float(coc),
        break_even_occupancy=float(be),
        cashflow=cashflow,
        notes=notes,
    )
