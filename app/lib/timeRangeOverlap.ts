/**
 * Returns true if two time ranges overlap (share any moment in time).
 * Ranges are inclusive of start, exclusive of end (standard half-open interval).
 *
 * Overlap when: startA < endB && endA > startB
 *
 * @param startA - start of first range (ms or comparable number)
 * @param endA - end of first range
 * @param startB - start of second range
 * @param endB - end of second range
 */
export function timeRangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
}
