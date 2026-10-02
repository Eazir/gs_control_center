import {
  ProjectStatus,
  GoalsConfig,
  ProductItem,
} from '@gs/contracts';

export interface ProjectEntityProps {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  directorId: string | null;
  products: ProductItem[];
  goalsConfig: GoalsConfig;
  commissionConfig: Record<string, unknown>;
  automationConfig: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  startDate: Date | null;
  endDate: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateProjectProps {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  status?: ProjectStatus;
  directorId?: string | null;
  products?: ProductItem[];
  goalsConfig?: GoalsConfig;
  commissionConfig?: Record<string, unknown>;
  automationConfig?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  startDate?: Date | null;
  endDate?: Date | null;
  createdBy?: string | null;
}

export class ProjectEntity {
  private constructor(private readonly props: ProjectEntityProps) {}

  public static create(props: CreateProjectProps): ProjectEntity {
    return new ProjectEntity({
      id: props.id ?? '',
      name: props.name,
      slug: props.slug,
      description: props.description ?? null,
      status: props.status ?? 'DRAFT',
      directorId: props.directorId ?? null,
      products: props.products ? [...props.products] : [],
      goalsConfig: props.goalsConfig ? { ...props.goalsConfig } : { monthlyTargetRevenue: 0, currency: 'USD', goals: [] },
      commissionConfig: props.commissionConfig ? { ...props.commissionConfig } : {},
      automationConfig: props.automationConfig ?? null,
      settings: props.settings ?? null,
      startDate: props.startDate ?? null,
      endDate: props.endDate ?? null,
      createdBy: props.createdBy ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
  }

  public static fromPersistence(props: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: ProjectStatus;
    directorId: string | null;
    products?: ProductItem[] | null;
    goalsConfig?: GoalsConfig | null;
    commissionConfig?: Record<string, unknown> | null;
    automationConfig?: Record<string, unknown> | null;
    settings?: Record<string, unknown> | null;
    startDate?: Date | null;
    endDate?: Date | null;
    createdBy?: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
  }): ProjectEntity {
    return new ProjectEntity({
      id: props.id,
      name: props.name,
      slug: props.slug,
      description: props.description,
      status: props.status,
      directorId: props.directorId,
      products: props.products ? [...props.products] : [],
      goalsConfig: props.goalsConfig
        ? { ...props.goalsConfig }
        : { monthlyTargetRevenue: 0, currency: 'USD', goals: [] },
      commissionConfig: props.commissionConfig ? { ...props.commissionConfig } : {},
      automationConfig: props.automationConfig ?? null,
      settings: props.settings ?? null,
      startDate: props.startDate ?? null,
      endDate: props.endDate ?? null,
      createdBy: props.createdBy ?? null,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      deletedAt: props.deletedAt ?? null,
    });
  }

  public get id(): string {
    return this.props.id;
  }

  public get name(): string {
    return this.props.name;
  }

  public get slug(): string {
    return this.props.slug;
  }

  public get description(): string | null {
    return this.props.description;
  }

  public get status(): ProjectStatus {
    return this.props.status;
  }

  public get directorId(): string | null {
    return this.props.directorId;
  }

  public get products(): ProductItem[] {
    return [...this.props.products];
  }

  public get goalsConfig(): GoalsConfig {
    return { ...this.props.goalsConfig };
  }

  public get commissionConfig(): Record<string, unknown> {
    return { ...this.props.commissionConfig };
  }

  public get automationConfig(): Record<string, unknown> | null {
    return this.props.automationConfig;
  }

  public get settings(): Record<string, unknown> | null {
    return this.props.settings;
  }

  public get startDate(): Date | null {
    return this.props.startDate;
  }

  public get endDate(): Date | null {
    return this.props.endDate;
  }

  public get createdBy(): string | null {
    return this.props.createdBy;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  public isActive(): boolean {
    return this.props.status === 'ACTIVE' && !this.props.deletedAt;
  }

  public isArchived(): boolean {
    return this.props.status === 'ARCHIVED' || !!this.props.deletedAt;
  }

  public updateDetails(name?: string, description?: string | null, slug?: string): void {
    if (name) this.props.name = name;
    if (description !== undefined) this.props.description = description;
    if (slug) this.props.slug = slug;
    this.props.updatedAt = new Date();
  }

  public updateStatus(status: ProjectStatus): void {
    this.props.status = status;
    this.props.updatedAt = new Date();
  }

  public updateGoals(goals: GoalsConfig): void {
    this.props.goalsConfig = { ...goals };
    this.props.updatedAt = new Date();
  }

  public assignDirector(directorId: string | null): void {
    this.props.directorId = directorId;
    this.props.updatedAt = new Date();
  }

  public addProduct(product: ProductItem): void {
    this.props.products = [...this.props.products, product];
    this.props.updatedAt = new Date();
  }

  public updateProduct(productId: string, data: Partial<ProductItem>): void {
    this.props.products = this.props.products.map((p) =>
      p.id === productId ? { ...p, ...data } : p
    );
    this.props.updatedAt = new Date();
  }

  public removeProduct(productId: string): void {
    this.props.products = this.props.products.filter((p) => p.id !== productId);
    this.props.updatedAt = new Date();
  }

  public toJSON(): ProjectEntityProps {
    return {
      ...this.props,
      products: this.products,
      goalsConfig: this.goalsConfig,
      commissionConfig: this.commissionConfig,
    };
  }
}
