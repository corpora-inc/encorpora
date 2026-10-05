import { format2z, type AppBudget, type SpendingSnapshot } from '../provider/free2z';

/** Read-only Settings figures. The budget is the user's choice in Free2Z; AHA only shows it. */
export interface SpendingSummary { budget?: string; budgetLeft?: string; batchCost?: string }

const PERIOD: Record<NonNullable<AppBudget>['period'], string> = {day: 'per day', week: 'per week', month: 'per month', total: 'in total'};

export function describeBudget(budget: AppBudget | undefined): string | undefined {
  if (budget === undefined) return undefined;
  return budget === null ? 'No app budget' : `${budget.limit2z} 2Z ${PERIOD[budget.period]}`;
}

/** `budget` undefined: no grant read yet. A settled batch charge beats the estimate's upper bound. */
export function spendingSummary(budget: AppBudget | undefined, spending: SpendingSnapshot): SpendingSummary {
  const left = budget && typeof spending.capRemainingMilli2z === 'bigint' ? format2z(spending.capRemainingMilli2z) : undefined;
  const cost = spending.batchCharge2z !== undefined ? `About ${spending.batchCharge2z} 2Z`
    : spending.batchEstimate2z !== undefined ? `Up to ${spending.batchEstimate2z} 2Z` : undefined;
  const label = describeBudget(budget);
  return {...(label ? {budget: label} : {}), ...(left ? {budgetLeft: left} : {}), ...(cost ? {batchCost: cost} : {})};
}
