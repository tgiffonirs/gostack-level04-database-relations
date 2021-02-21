import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) throw new AppError('Customer not registered yet.');

    const registeredProducts = await this.productsRepository.findAllById(
      products,
    );

    if (!registeredProducts.length)
      throw new AppError(
        'There are no products registered with the given ids.',
      );

    const registeredProductsId = registeredProducts.map(product => product.id);

    const unregisteredProducts = products.filter(
      product => !registeredProductsId.includes(product.id),
    );

    if (unregisteredProducts.length)
      throw new AppError('There are unregistered products .');

    const findProductsWithoutQuantity = products.filter(
      productItem =>
        registeredProducts.filter(item => item.id === productItem.id)[0]
          .quantity < productItem.quantity,
    );

    if (findProductsWithoutQuantity.length)
      throw new AppError('There are no quantity products available.');

    const productsList = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: registeredProducts.filter(item => item.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: productsList,
    });

    const { order_products } = order;

    const updatedProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        registeredProducts.filter(item => item.id === product.product_id)[0]
          .quantity - product.quantity,
    }));

    await this.productsRepository.updateQuantity(updatedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
