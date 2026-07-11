import { Controller, Delete, Get, Param } from '@nestjs/common';
import { Cap } from '../auth/decorators';
import { AnkoService } from './anko.service';

/** Admin — live anko exclusivity locks (who holds which fabric, until when). */
@Controller('anko')
export class AnkoController {
  constructor(private anko: AnkoService) {}

  @Get('locks')
  @Cap('products.view')
  locks() {
    return this.anko.listLocks();
  }

  @Delete('locks/:productId')
  @Cap('products.create_edit')
  release(@Param('productId') productId: string) {
    return this.anko.release(productId);
  }
}
