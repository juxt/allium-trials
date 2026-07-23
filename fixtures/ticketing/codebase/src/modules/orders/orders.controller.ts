/**
 * Attendee-facing order surface: create an order (reserving tickets), and
 * cancel a still-pending order.
 */

import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order } from '../../entities/order.entity';
import { RoleGuard, Roles, RequestPrincipal } from '../../common/auth';

interface CreateOrderDto {
  eventId: string;
  quantity: number;
  unitPriceCents: number;
}

@Controller('orders')
@UseGuards(RoleGuard)
@Roles('attendee')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  async create(
    @Req() req: { principal: RequestPrincipal },
    @Body() dto: CreateOrderDto,
  ): Promise<Order> {
    return this.orders.createOrder(
      req.principal.id,
      dto.eventId,
      dto.quantity,
      dto.unitPriceCents,
    );
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string): Promise<Order> {
    return this.orders.cancel(id);
  }
}
