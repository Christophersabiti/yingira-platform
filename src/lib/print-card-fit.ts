/** Fit stationery by reflowing text and spacing, never scaling its QR codes. */
export function fitPrintCard(card: HTMLElement): boolean {
  const content = card.querySelector<HTMLElement>('.print-card-content');
  if (!content) return false;
  for (const density of ['comfortable', 'compact', 'condensed']) {
    card.dataset.density = density;
    const last = content.lastElementChild;
    const bottom = last?.getBoundingClientRect().bottom ?? 0;
    const safeBottom =
      content.getBoundingClientRect().bottom -
      parseFloat(getComputedStyle(content).paddingBottom);
    if (
      bottom <= safeBottom + 1 &&
      content.scrollWidth <= content.clientWidth + 1
    ) {
      card.dataset.printFits = 'true';
      return true;
    }
  }
  card.dataset.printFits = 'false';
  return false;
}
