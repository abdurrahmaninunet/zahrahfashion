import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { AttributesController } from './attributes.controller';
import { UnitsController } from './units.controller';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [CategoriesController, AttributesController, UnitsController, ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class CatalogModule {}
