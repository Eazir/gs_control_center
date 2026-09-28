import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  CreateProductInput,
  CreateProductInputSchema,
  ProductItem,
  UpdateProductInput,
  UpdateProductInputSchema,
} from '@gs/contracts';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/ports/project-repository.port';
import { SalesService } from '../../../sales';

@Injectable()
export class AddProductUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository
  ) {}

  async execute(projectId: string, input: CreateProductInput): Promise<ProductItem> {
    const validated = CreateProductInputSchema.parse(input);

    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Proyecto con id '${projectId}' no encontrado.`);
    }

    const product: ProductItem = {
      id: crypto.randomUUID(),
      name: validated.name.trim(),
      offerCode: validated.offerCode?.trim() || null,
      sku: validated.sku?.trim() || null,
      sck: validated.sck?.trim() || null,
      price: Number(validated.price),
      installments: validated.installments ?? 1,
      currency: validated.currency.toUpperCase(),
      ownerCloserId: validated.ownerCloserId || null,
      externalLabel: validated.externalLabel?.trim() || null,
      active: validated.active ?? true,
    };

    project.addProduct(product);

    await this.projectRepository.update(projectId, {
      products: project.products,
    });

    return product;
  }
}

@Injectable()
export class UpdateProductUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository
  ) {}

  async execute(
    projectId: string,
    productId: string,
    input: UpdateProductInput
  ): Promise<ProductItem> {
    const validated = UpdateProductInputSchema.parse(input);

    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Proyecto con id '${projectId}' no encontrado.`);
    }

    const existingProduct = project.products.find((p) => p.id === productId);
    if (!existingProduct) {
      throw new NotFoundException(
        `Producto con id '${productId}' no encontrado en el catálogo del proyecto.`
      );
    }

    const updatedData: Partial<ProductItem> = {};
    if (validated.name !== undefined) updatedData.name = validated.name.trim();
    if (validated.offerCode !== undefined) updatedData.offerCode = validated.offerCode?.trim() || null;
    if (validated.sku !== undefined) updatedData.sku = validated.sku?.trim() || null;
    if (validated.sck !== undefined) updatedData.sck = validated.sck?.trim() || null;
    if (validated.price !== undefined) updatedData.price = Number(validated.price);
    if (validated.installments !== undefined) updatedData.installments = validated.installments;
    if (validated.currency !== undefined) updatedData.currency = validated.currency.toUpperCase();
    if (validated.ownerCloserId !== undefined) updatedData.ownerCloserId = validated.ownerCloserId || null;
    if (validated.externalLabel !== undefined) updatedData.externalLabel = validated.externalLabel?.trim() || null;
    if (validated.active !== undefined) updatedData.active = validated.active;

    project.updateProduct(productId, updatedData);

    await this.projectRepository.update(projectId, {
      products: project.products,
    });

    return project.products.find((p) => p.id === productId)!;
  }
}

@Injectable()
export class RemoveProductUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Optional()
    @Inject(forwardRef(() => SalesService))
    private readonly salesService?: SalesService
  ) {}

  async execute(projectId: string, productId: string): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Proyecto con id '${projectId}' no encontrado.`);
    }

    const existingProduct = project.products.find((p) => p.id === productId);
    if (!existingProduct) {
      throw new NotFoundException(
        `Producto con id '${productId}' no encontrado en el catálogo del proyecto.`
      );
    }

    // Validación preventiva: no permitir eliminar si tiene transacciones históricas
    if (this.salesService) {
      const salesCount = await this.salesService.countSalesForProduct(
        projectId,
        productId,
        existingProduct.offerCode
      );
      if (salesCount > 0) {
        throw new BadRequestException(
          `No es posible eliminar '${existingProduct.name}' porque tiene ${salesCount} transacción(es) histórica(s) asociada(s). Te sugerimos desactivarlo para que deje de admitir ventas sin alterar el historial contable ni los reportes.`
        );
      }
    }

    project.removeProduct(productId);

    await this.projectRepository.update(projectId, {
      products: project.products,
    });
  }
}

@Injectable()
export class ListProjectProductsUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository
  ) {}

  async execute(projectId: string): Promise<ProductItem[]> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Proyecto con id '${projectId}' no encontrado.`);
    }

    return project.products;
  }
}
