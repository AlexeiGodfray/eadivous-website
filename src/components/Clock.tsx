import { useEffect, useState } from 'react';

function formatTime(date: Date): string {
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  const tz =
    new Intl.DateTimeFormat('en-US', { timeZoneName: 'short', hour: 'numeric' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? '';

  return `${tz} ${time}`.trim();
}

export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time className="hero-clock animate-logo-enter" dateTime={now.toISOString()}>
      {formatTime(now)}
    </time>
  );
}
