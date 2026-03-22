export interface CatalogGridStyle {
  gridTemplateColumns: string;
  justifyContent?: 'start';
}

export interface CreateCatalogGridStyleInput {
  itemCount: number;
  minCardWidthRem: number;
  singleCardMaxWidthRem: number;
  multiCardMaxWidthRem?: number;
}

const SKILL_CARD_MIN_WIDTH_REM = 19;
const SKILL_CARD_MAX_WIDTH_REM = 24;
const PACK_CARD_MIN_WIDTH_REM = 23;
const PACK_CARD_MAX_WIDTH_REM = 29;

export function createCatalogGridStyle({
  itemCount,
  minCardWidthRem,
  singleCardMaxWidthRem,
  multiCardMaxWidthRem,
}: CreateCatalogGridStyleInput): CatalogGridStyle {
  const safeMinWidth = `min(100%, ${minCardWidthRem}rem)`;

  if (itemCount === 1) {
    return {
      gridTemplateColumns: `minmax(${safeMinWidth}, ${singleCardMaxWidthRem}rem)`,
      justifyContent: 'start',
    };
  }

  if (typeof multiCardMaxWidthRem === 'number') {
    return {
      gridTemplateColumns: `repeat(auto-fit, minmax(${safeMinWidth}, ${multiCardMaxWidthRem}rem))`,
      justifyContent: 'start',
    };
  }

  return {
    gridTemplateColumns: `repeat(auto-fit, minmax(${safeMinWidth}, 1fr))`,
  };
}

export function createSkillCatalogGridStyle(itemCount: number): CatalogGridStyle {
  return createCatalogGridStyle({
    itemCount,
    minCardWidthRem: SKILL_CARD_MIN_WIDTH_REM,
    singleCardMaxWidthRem: SKILL_CARD_MAX_WIDTH_REM,
    multiCardMaxWidthRem: SKILL_CARD_MAX_WIDTH_REM,
  });
}

export function createMySkillsCatalogGridStyle(itemCount: number): CatalogGridStyle {
  return createSkillCatalogGridStyle(itemCount);
}

export function createPackCatalogGridStyle(itemCount: number): CatalogGridStyle {
  return createCatalogGridStyle({
    itemCount,
    minCardWidthRem: PACK_CARD_MIN_WIDTH_REM,
    singleCardMaxWidthRem: PACK_CARD_MAX_WIDTH_REM,
    multiCardMaxWidthRem: PACK_CARD_MAX_WIDTH_REM,
  });
}
