import type { OrderEarnings, OrderEarningsDto } from "~/types/earnings";
import { toAmount } from "~/utils/currency";

export const mapOrderEarningsDto = (dto: OrderEarningsDto): OrderEarnings => ({
  orderId: Number(dto.order_id),
  wage: toAmount(dto.wage),
  collectedFromCustomer: toAmount(dto.collected_from_customer),
  foodCollected: toAmount(dto.food_collected),
  deliveryCollected: toAmount(dto.delivery_collected),
  date: dto.date,
  paymentTypeLabel: dto.payment_type_label,
  payRateLabel: dto.pay_rate_label,
  payRateDetail: dto.pay_rate_detail,
  cashEffect: toAmount(dto.cash_effect),
});
