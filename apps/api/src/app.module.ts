import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SettingsModule } from './settings/settings.module';
import { AuthModule } from './auth/auth.module';
import { StaffModule } from './staff/staff.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { CustomersModule } from './customers/customers.module';
import { DiscountsModule } from './discounts/discounts.module';
import { OrdersModule } from './orders/orders.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ContentModule } from './content/content.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { StorefrontModule } from './storefront/storefront.module';
import { SupportModule } from './support/support.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AnkoModule } from './anko/anko.module';
import { ContactModule } from './contact/contact.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    SettingsModule,
    AuthModule,
    NotificationsModule,
    StaffModule,
    CatalogModule,
    InventoryModule,
    CustomersModule,
    DiscountsModule,
    OrdersModule,
    ContentModule,
    DashboardModule,
    StorefrontModule,
    SupportModule,
    ReviewsModule,
    AnkoModule,
    ContactModule,
    WalletModule,
  ],
})
export class AppModule {}
