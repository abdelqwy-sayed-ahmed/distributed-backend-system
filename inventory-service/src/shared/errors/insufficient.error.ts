
export class InsufficientStockError extends Error {
  constructor(public productId: string) {
    super(`Insufficient stock for ${productId}`);
  }
}