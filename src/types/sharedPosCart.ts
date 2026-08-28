export type SharedCartPriceSource = "retail" | "wholesale" | "alternate";

export type SharedPosCartLineDto = {
  productId: number;
  qty: number;
  priceSource: SharedCartPriceSource;
  manualUnitPriceKurus: number | null;
  lineExtraDiscountPercent: number;
  manualLineTotalTlWhole: number | null;
};

export type MobileCartOp = {
  id: string;
  type: "add_barcode" | "add_product";
  barcode?: string;
  productId?: number;
  qty: number;
  priceSource: SharedCartPriceSource;
  createdAt: string;
};

export type SharedPosCartSnapshot = {
  revision: number;
  activeCartId: number;
  lines: SharedPosCartLineDto[];
  pendingOps: MobileCartOp[];
};

export type SharedPosCartPushInput = {
  activeCartId: number;
  lines: SharedPosCartLineDto[];
};
