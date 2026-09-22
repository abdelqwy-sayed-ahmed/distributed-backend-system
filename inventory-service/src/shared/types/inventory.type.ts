

export type OrderItem = {
  productId: string,
  quantity: number,
}

export type OrderCreatedPayload ={
  eventId: string,
  orderId: string,
  items: OrderItem[],
  totalAmount: string,
  currency: string,
  createdAt: string,
}