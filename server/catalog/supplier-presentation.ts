export type SupplierPresentationSkuStatus = "ACTIVE" | "INACTIVE";

export function resolveSupplierPresentationSkuStatuses(input: {
  productWasActive: boolean;
  productWillBeActive: boolean;
  skus: ReadonlyArray<{ id: number; status: SupplierPresentationSkuStatus }>;
  enabledBindingSkuIds: ReadonlySet<number>;
}) {
  const requestedActiveBoundSkuIds = input.skus
    .filter((sku) => sku.status === "ACTIVE" && input.enabledBindingSkuIds.has(sku.id))
    .map((sku) => sku.id);
  // Historical supplier imports were created with every SKU inactive. Preserve
  // the one-time publishing convenience without overriding later admin choices.
  const activateImportedDefaults = input.productWillBeActive
    && !input.productWasActive
    && requestedActiveBoundSkuIds.length === 0;
  const statusBySkuId = new Map<number, SupplierPresentationSkuStatus>();
  for (const sku of input.skus) {
    const hasEnabledBinding = input.enabledBindingSkuIds.has(sku.id);
    statusBySkuId.set(sku.id, hasEnabledBinding && (sku.status === "ACTIVE" || activateImportedDefaults) ? "ACTIVE" : "INACTIVE");
  }
  return {
    statusBySkuId,
    activeSkuIds: [...statusBySkuId].filter(([, status]) => status === "ACTIVE").map(([skuId]) => skuId),
  };
}
