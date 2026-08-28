import crypto from "node:crypto";
import type {
  MobileCartOp,
  SharedCartPriceSource,
  SharedPosCartLineDto,
  SharedPosCartSnapshot
} from "../src/types/sharedPosCart";

class SharedPosCartService {
  private revision = 0;
  private activeCartId = 1;
  private lines: SharedPosCartLineDto[] = [];
  private pendingOps: MobileCartOp[] = [];

  getSnapshot(): SharedPosCartSnapshot {
    return {
      revision: this.revision,
      activeCartId: this.activeCartId,
      lines: this.lines.map((line) => ({ ...line })),
      pendingOps: this.pendingOps.map((op) => ({ ...op }))
    };
  }

  pushFromPc(activeCartId: number, lines: SharedPosCartLineDto[]): void {
    this.activeCartId = activeCartId;
    this.lines = lines.map((line) => ({ ...line }));
    this.revision += 1;
  }

  enqueueBarcode(barcode: string, priceSource: SharedCartPriceSource = "retail"): MobileCartOp {
    const op: MobileCartOp = {
      id: crypto.randomUUID(),
      type: "add_barcode",
      barcode: barcode.trim(),
      qty: 1,
      priceSource,
      createdAt: new Date().toISOString()
    };
    this.pendingOps.push(op);
    this.revision += 1;
    return op;
  }

  enqueueProduct(
    productId: number,
    qty = 1,
    priceSource: SharedCartPriceSource = "retail"
  ): MobileCartOp {
    const op: MobileCartOp = {
      id: crypto.randomUUID(),
      type: "add_product",
      productId,
      qty: Math.max(1, Math.floor(qty)),
      priceSource,
      createdAt: new Date().toISOString()
    };
    this.pendingOps.push(op);
    this.revision += 1;
    return op;
  }

  ackOps(ids: string[]): void {
    if (!ids.length) return;
    const drop = new Set(ids);
    const before = this.pendingOps.length;
    this.pendingOps = this.pendingOps.filter((op) => !drop.has(op.id));
    if (this.pendingOps.length !== before) {
      this.revision += 1;
    }
  }

  clear(): void {
    this.lines = [];
    this.pendingOps = [];
    this.activeCartId = 1;
    this.revision += 1;
  }
}

export const sharedPosCart = new SharedPosCartService();
