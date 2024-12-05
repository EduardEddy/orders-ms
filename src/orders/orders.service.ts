import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrderPaginationDTO } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto } from './dto';
import { NATS_SERVICE, PRODUCTS_SERVICE } from 'src/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('OrdersService');

  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the database');
  }

  async create(createOrderDto: CreateOrderDto) {
    try {
      const productIds = createOrderDto.items.map(item => item.productId);
      const products = await firstValueFrom(this.client.send({ cmd: 'validate_products' }, productIds));

      const totalAmount = createOrderDto.items.reduce((acc, orderItem) => {
        const price = products.find(product => product.id === orderItem.productId).price;
        return price * orderItem.quantity;
      }, 0);

      const totalItems = createOrderDto.items.reduce((acc, orderItem) => {
        return acc + orderItem.quantity;
      }, 0)

      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map(orderItem => ({
                price: products.find(product => product.id === orderItem.productId).price,
                productId: orderItem.productId,
                quantity: orderItem.quantity
              }))
            }
          }
        },
        include: {
          //OrderItem: true
          OrderItem: {
            select: {
              id: true,
              price: true,
              quantity: true,
              productId: true
            }
          }
        }
      });

      return {
        ...order,
        OrderItem: order.OrderItem.map(orderItem => ({
          ...orderItem,
          name: products.find(product => product.id === orderItem.productId).name
        }))
      };
    } catch (error) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: error.message
      })
    }
  }

  async findAll(orderPaginationDTO: OrderPaginationDTO) {
    const totalPages = await this.order.count({
      where: {
        status: orderPaginationDTO.status
      }
    });
    const currentPage = orderPaginationDTO.page || 1;
    const perPage = orderPaginationDTO.limit || 10;

    return {
      data: await this.order.findMany({
        skip: (currentPage - 1) * perPage,
        take: perPage,
        where: {
          status: orderPaginationDTO.status
        }
      }),
      meta: {
        total: totalPages,
        page: currentPage,
        lastPage: Math.ceil(totalPages / perPage),
      }
    };
  }

  async findOne(id: string) {
    const orders = await this.order.findFirst(
      {
        where: { id }
        , include: {
          OrderItem: {
            select: {
              id: true,
              price: true,
              quantity: true,
              productId: true
            },
          }
        }
      });
    if (!orders) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Order with id ${id} not found`
      });
    }
    const productIds = orders.OrderItem.map(orderItem => orderItem.productId);
    const products = await firstValueFrom(this.client.send({ cmd: 'validate_products' }, productIds));

    return {
      ...orders,
      OrderItem: orders.OrderItem.map(orderItem => ({
        ...orderItem,
        name: products.find(product => product.id === orderItem.productId).name
      }))
    };
  }

  async changeOrderStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;
    const orders = await this.order.findFirst({ where: { id } });
    if (!orders) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Order with id ${id} not found`
      });
    }

    if (status === orders.status) {
      return orders;
    }

    return await this.order.update({
      where: { id },
      data: { status }
    });
  }
}
