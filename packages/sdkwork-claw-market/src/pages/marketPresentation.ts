import type { Skill, SkillPack } from '@sdkwork/claw-types';

const PREFERRED_CATEGORY_ORDER = [
  'Productivity',
  'Development',
  'System',
  'AI Models',
  'Utilities',
] as const;

interface CatalogInput {
  keyword: string;
  activeCategory: string;
}

interface CategoryCatalog extends CatalogInput {
  categories: string[];
}

export interface SkillCatalog extends CategoryCatalog {
  skills: Skill[];
}

export interface PackCatalog extends CategoryCatalog {
  packs: SkillPack[];
}

export interface MySkillsCatalog extends CategoryCatalog {
  skills: Skill[];
}

function normalizeKeyword(keyword: string) {
  return keyword.trim().toLowerCase();
}

function matchesKeyword(values: Array<string | undefined>, keyword: string) {
  if (!keyword) {
    return true;
  }

  return values.some((value) => value?.toLowerCase().includes(keyword) === true);
}

function matchesCategory(category: string | undefined, activeCategory: string) {
  return activeCategory === 'All' || category === activeCategory;
}

export function createCategoryIds(items: Array<{ category?: string }>) {
  const existingCategories = new Set(
    items
      .map((item) => item.category?.trim())
      .filter((category): category is string => Boolean(category)),
  );

  const preferredCategories = PREFERRED_CATEGORY_ORDER.filter((category) =>
    existingCategories.has(category),
  );
  const extraCategories = [...existingCategories]
    .filter(
      (category) =>
        !PREFERRED_CATEGORY_ORDER.includes(category as (typeof PREFERRED_CATEGORY_ORDER)[number]),
    )
    .sort((left, right) => left.localeCompare(right));

  return ['All', ...preferredCategories, ...extraCategories];
}

function sortSkills(skills: Skill[]) {
  return [...skills].sort((left, right) => {
    if (right.rating !== left.rating) {
      return right.rating - left.rating;
    }

    if (right.downloads !== left.downloads) {
      return right.downloads - left.downloads;
    }

    return left.name.localeCompare(right.name);
  });
}

function sortPacks(packs: SkillPack[]) {
  return [...packs].sort((left, right) => {
    if (right.rating !== left.rating) {
      return right.rating - left.rating;
    }

    if (right.downloads !== left.downloads) {
      return right.downloads - left.downloads;
    }

    return left.name.localeCompare(right.name);
  });
}

function filterSkills(skills: Skill[], { keyword, activeCategory }: CatalogInput) {
  const normalizedKeyword = normalizeKeyword(keyword);

  return skills.filter(
    (skill) =>
      matchesCategory(skill.category, activeCategory) &&
      matchesKeyword(
        [skill.name, skill.description, skill.author, skill.category, skill.readme],
        normalizedKeyword,
      ),
  );
}

function filterPacks(packs: SkillPack[], { keyword, activeCategory }: CatalogInput) {
  const normalizedKeyword = normalizeKeyword(keyword);

  return packs.filter(
    (pack) =>
      matchesCategory(pack.category, activeCategory) &&
      matchesKeyword(
        [
          pack.name,
          pack.description,
          pack.author,
          pack.category,
          ...pack.skills.map((skill) => skill.name),
        ],
        normalizedKeyword,
      ),
  );
}

export function createSkillCatalog({
  skills,
  keyword,
  activeCategory,
}: {
  skills: Skill[];
  keyword: string;
  activeCategory: string;
}): SkillCatalog {
  const filters = { keyword, activeCategory };

  return {
    ...filters,
    categories: createCategoryIds(skills),
    skills: sortSkills(filterSkills(skills, filters)),
  };
}

export function createPackCatalog({
  packs,
  keyword,
  activeCategory,
}: {
  packs: SkillPack[];
  keyword: string;
  activeCategory: string;
}): PackCatalog {
  const filters = { keyword, activeCategory };

  return {
    ...filters,
    categories: createCategoryIds(packs),
    packs: sortPacks(filterPacks(packs, filters)),
  };
}

export function createMySkillsCatalog({
  skills,
  keyword,
  activeCategory,
}: {
  skills: Skill[];
  keyword: string;
  activeCategory: string;
}): MySkillsCatalog {
  const filters = { keyword, activeCategory };

  return {
    ...filters,
    categories: createCategoryIds(skills),
    skills: sortSkills(filterSkills(skills, filters)),
  };
}
