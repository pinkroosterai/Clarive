export function slugifyFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function buildPdfFilename(entryTitle: string): string {
  const slug = slugifyFilename(entryTitle) || 'report';
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}-playground-report-${date}.pdf`;
}
