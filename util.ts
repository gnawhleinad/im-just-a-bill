export function isWithinPreviousDays(
  dateString: string,
  today: Date,
  bufferDays: number,
): boolean {
  const targetDate = new Date(`${dateString}T00:00:00`);

  const daysFromNow = new Date(today);
  daysFromNow.setDate(today.getDate() - bufferDays);

  return targetDate >= daysFromNow && targetDate <= today;
}