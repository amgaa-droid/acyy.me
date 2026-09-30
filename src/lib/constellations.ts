/**
 * Stylised constellation drawings for the 12 signs (decorative artwork, 0–100 viewBox).
 * `lines` join star indexes; `bright` is the highlighted star.
 * Keyed by `zodiac_signs.code`; sign date ranges still come from the DB.
 */
export type Constellation = {
  stars: readonly (readonly [number, number])[];
  lines: readonly (readonly [number, number])[];
  bright: number;
};

const chain = (n: number, from = 0) =>
  Array.from({ length: n - 1 }, (_, i) => [from + i, from + i + 1] as const);

export const CONSTELLATIONS: Record<string, Constellation> = {
  aries: {
    stars: [
      [20, 42],
      [48, 30],
      [68, 36],
      [80, 54],
    ],
    lines: chain(4),
    bright: 1,
  },
  taurus: {
    stars: [
      [18, 22],
      [38, 40],
      [50, 50],
      [62, 46],
      [84, 30],
      [46, 64],
      [30, 78],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [2, 5],
      [5, 6],
    ],
    bright: 2,
  },
  gemini: {
    stars: [
      [26, 16],
      [28, 34],
      [30, 54],
      [24, 78],
      [56, 14],
      [58, 34],
      [62, 56],
      [70, 80],
    ],
    lines: [...chain(4), ...chain(4, 4), [1, 5]],
    bright: 4,
  },
  cancer: {
    stars: [
      [50, 18],
      [50, 44],
      [52, 58],
      [30, 74],
      [72, 76],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
    ],
    bright: 1,
  },
  leo: {
    stars: [
      [62, 44],
      [54, 32],
      [42, 30],
      [36, 40],
      [44, 48],
      [52, 50],
      [56, 62],
      [70, 66],
      [82, 76],
      [40, 62],
      [30, 72],
    ],
    lines: [...chain(9), [5, 9], [9, 10], [10, 6]],
    bright: 5,
  },
  virgo: {
    stars: [
      [20, 20],
      [34, 34],
      [46, 44],
      [60, 40],
      [76, 30],
      [52, 60],
      [44, 78],
      [66, 72],
      [84, 84],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [2, 5],
      [5, 6],
      [5, 7],
      [7, 8],
    ],
    bright: 6,
  },
  libra: {
    stars: [
      [50, 18],
      [30, 44],
      [70, 44],
      [36, 72],
      [66, 76],
    ],
    lines: [
      [0, 1],
      [0, 2],
      [1, 2],
      [1, 3],
      [2, 4],
    ],
    bright: 0,
  },
  scorpio: {
    stars: [
      [24, 14],
      [28, 26],
      [20, 34],
      [38, 32],
      [46, 40],
      [52, 50],
      [56, 60],
      [62, 68],
      [70, 74],
      [78, 74],
      [84, 68],
      [82, 60],
      [76, 58],
    ],
    lines: [[0, 1], [1, 2], [1, 3], ...chain(10, 3)],
    bright: 4,
  },
  sagittarius: {
    stars: [
      [24, 60],
      [36, 48],
      [50, 50],
      [62, 40],
      [74, 46],
      [70, 62],
      [52, 66],
      [38, 70],
      [84, 32],
    ],
    lines: [...chain(8), [7, 0], [2, 6], [3, 8]],
    bright: 5,
  },
  capricorn: {
    stars: [
      [18, 32],
      [34, 38],
      [52, 36],
      [70, 30],
      [84, 26],
      [78, 46],
      [64, 62],
      [48, 72],
      [34, 62],
    ],
    lines: [...chain(9), [8, 0]],
    bright: 4,
  },
  aquarius: {
    stars: [
      [14, 30],
      [30, 24],
      [44, 34],
      [58, 28],
      [70, 40],
      [62, 58],
      [76, 70],
      [40, 60],
      [52, 76],
    ],
    lines: [...chain(7), [5, 7], [7, 8]],
    bright: 3,
  },
  pisces: {
    stars: [
      [16, 24],
      [24, 40],
      [34, 58],
      [50, 76],
      [64, 62],
      [76, 50],
      [84, 40],
      [80, 28],
      [92, 30],
    ],
    lines: [...chain(8), [8, 6]],
    bright: 3,
  },
};
