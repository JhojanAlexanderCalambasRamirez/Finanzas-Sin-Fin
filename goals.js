import { validDate, validId, validText } from './validation.js';

export const goalList = state => state.goals === undefined ? [] : state.goals;
export const contributionList = state => state.contributions === undefined ? [] : state.contributions;
export function validGoals(state) {
  const goals = goalList(state); const contributions = contributionList(state);
  if (!Array.isArray(goals) || goals.length > 100 || !Array.isArray(contributions) || contributions.length > 5000) return false;
  if (!Array.from(goals).every(goal => goal && validId(goal.id) && validText(goal.name, 60)
    && Number.isSafeInteger(goal.targetAmount) && goal.targetAmount > 0 && goal.targetAmount <= 1000000000000
    && validDate(goal.startDate) && (goal.targetDate === '' || (validDate(goal.targetDate) && goal.targetDate >= goal.startDate))
    && typeof goal.archived === 'boolean') || new Set(goals.map(goal => goal.id)).size !== goals.length) return false;
  const byId = new Map(goals.map(goal => [goal.id, goal]));
  return Array.from(contributions).every(item => item && validId(item.id) && byId.has(item.goalId)
    && Number.isSafeInteger(item.amount) && item.amount > 0 && item.amount <= 1000000000000
    && validDate(item.date) && item.date >= byId.get(item.goalId).startDate && validText(item.note, 120))
    && new Set(contributions.map(item => item.id)).size === contributions.length;
}
export function goalSummary(state, asOf) {
  const totals = new Map();
  for (const item of contributionList(state)) if (item.date <= asOf) totals.set(item.goalId, (totals.get(item.goalId) || 0) + item.amount);
  return goalList(state).map(goal => {
    const saved = totals.get(goal.id) || 0;
    return { ...goal, saved, remaining: Math.max(0, goal.targetAmount - saved), percent: saved / goal.targetAmount * 100,
      status: goal.startDate > asOf ? 'not-started' : saved >= goal.targetAmount ? 'completed' : goal.targetDate && goal.targetDate < asOf ? 'overdue' : 'in-progress' };
  });
}
