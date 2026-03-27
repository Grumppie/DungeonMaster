export const LIVE_TRANSCRIPT_LIMIT = 3;
export const GRID_FEET_PER_CELL = 5;
export const DEFAULT_MAP_WIDTH = 12;
export const DEFAULT_MAP_HEIGHT = 8;

export function makeGridCellKey(x, y) {
  return `${x}:${y}`;
}

