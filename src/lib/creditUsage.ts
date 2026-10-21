export const creditCategories = ["backend_credits", "function_credits", "storage_credits", "traffic_credits"] as const;
export type CreditCategory = typeof creditCategories[number];
export interface DailyCreditUsage {
  recorded_date: string;
  backend_credits: number;
  function_credits: number;
  storage_credits: number;
  traffic_credits: number;
  is_partial_day: boolean;
  result_partial: boolean;
  recorded_to_exclusive: string;
  retrieved_at: string;
}
export const dailyCreditTotal = (row: DailyCreditUsage) =>
  creditCategories.reduce((sum, key) => sum + Number(row[key]), 0);
export const usageInRange = (rows: DailyCreditUsage[], start: string, end: string) =>
  rows.filter(row => row.recorded_date >= start && row.recorded_date <= end)
    .sort((a, b) => a.recorded_date.localeCompare(b.recorded_date));
export const sumCreditUsage = (rows: DailyCreditUsage[]) => {
  const totals = { backend_credits: 0, function_credits: 0, storage_credits: 0, traffic_credits: 0 };
  for (const row of rows) for (const key of creditCategories) totals[key] += Number(row[key]);
  return totals;
};
export const formatCredits = (value: number) => value.toLocaleString("en-ZA", {
  minimumFractionDigits: 2, maximumFractionDigits: value !== 0 && value < 0.01 ? 9 : 6,
});