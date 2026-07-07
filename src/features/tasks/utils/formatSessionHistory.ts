const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export function formatSessionDate(completedAt: number): string {
  return dateFormatter.format(new Date(completedAt));
}

export function formatEstimatedMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) {
    return '0 min';
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function formatTaskCount(count: number): string {
  return count === 1 ? '1 task created' : `${count} tasks created`;
}

export function formatReleasedCount(count: number): string {
  return count === 1 ? '1 item released' : `${count} items released`;
}
