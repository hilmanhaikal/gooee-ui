/** Width over height as one number: 16 / 9 and "16 / 9" both give 1.777. */
export function ratioNumber(ratio: number | string) {
  if (typeof ratio === 'number') return ratio
  const [w, h = 1] = ratio.split('/').map(Number)
  return w / h
}
