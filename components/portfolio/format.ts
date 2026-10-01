const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-07-09T…" -> "Jul 2026" (fixed format so server and browser render the same text). */
export function formatMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Scores up to 10 read as CGPA, larger ones as percentages. */
export function formatScore(score: string): string {
  const n = Number(score.replace(/[^\d.]/g, ''));
  if (!score || !Number.isFinite(n)) return score;
  if (/%|cgpa|gpa/i.test(score)) return score;
  return n <= 10 ? `CGPA ${score}` : `${score}%`;
}

export function displayUrl(url: string): string {
  return url.replace(/^mailto:/, '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}
