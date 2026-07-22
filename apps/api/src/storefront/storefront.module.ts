import { Module } from '@nestjs/common';
import { StorePublicController } from './store-public.controller';
import { StoreCheckoutController } from './store-checkout.controller';
import { StoreAccountController } from './store-account.controller';
import { MimAdminController } from './mim-admin.controller';
import { StoreCatalogService } from './store-catalog.service';
import { StoreSearchService } from './store-search.service';
import { StoreCheckoutService } from './store-checkout.service';
import { CustomerAuthService } from './customer-auth.service';
import { WishlistAlertsService } from './wishlist-alerts.service';
import { CatalogModule } from '../catalog/catalog.module';
import { DiscountsModule } from '../discounts/discounts.module';
import { CustomersModule } from '../customers/customers.module';
import { OrdersModule } from '../orders/orders.module';
import { ContentModule } from '../content/content.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AnkoModule } from '../anko/anko.module';
import { ContactModule } from '../contact/contact.module';
import { WalletModule } from '../wallet/wallet.module';
import { CollectionsModule } from '../collections/collections.module';
import { NewsletterModule } from '../newsletter/newsletter.module';

@Module({
  imports: [CatalogModule, DiscountsModule, CustomersModule, OrdersModule, ContentModule, ReviewsModule, AnkoModule, ContactModule, WalletModule, CollectionsModule, NewsletterModule],
  controllers: [StorePublicController, StoreCheckoutController, StoreAccountController, MimAdminController],
  providers: [StoreCatalogService, StoreSearchService, StoreCheckoutService, CustomerAuthService, WishlistAlertsService],
})
export class StorefrontModule {}
