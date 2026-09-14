export const PRODUCT_NAME = "Edunoza" as const;
export const LEGACY_PRODUCT_NAME = "ProfePlus" as const;
export const PRODUCT_DOMAIN = "edunoza.com" as const;

export type CompatibleProductName = typeof PRODUCT_NAME | typeof LEGACY_PRODUCT_NAME;

export function isCompatibleProductName(value: unknown): value is CompatibleProductName {
  return value === PRODUCT_NAME || value === LEGACY_PRODUCT_NAME;
}
