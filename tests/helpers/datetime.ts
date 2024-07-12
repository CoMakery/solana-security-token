export function fromDaysToSeconds(numDays: number): number {
  return 60 * 60 * 24 * numDays;
}

export function fromMonthsToSeconds(numMonths: number): number {
  return fromDaysToSeconds(30 * numMonths);
}
