/** Near the top of the page a floating control always shows (px). */
export const SCROLL_TOP_ZONE = 24;
/** Smaller moves (momentum jitter, rubber-banding) keep the current state (px). */
export const SCROLL_JITTER = 4;

/**
 * One scroll sample for a floating control: hidden while scrolling down, shown again on
 * scrolling up or near the top. `anchor` is the position the direction is measured from; it
 * only moves once the page has moved more than the jitter, so smooth scrolling (a few px a
 * frame) still adds up to a direction.
 */
export function scrollStep(
  anchor: number,
  y: number,
  hidden: boolean,
): { hidden: boolean; anchor: number } {
  if (y <= SCROLL_TOP_ZONE) return { hidden: false, anchor: y };
  if (y > anchor + SCROLL_JITTER) return { hidden: true, anchor: y };
  if (y < anchor - SCROLL_JITTER) return { hidden: false, anchor: y };
  return { hidden, anchor };
}
