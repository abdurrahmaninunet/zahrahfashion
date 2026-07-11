/**
 * Hardcoded content pages. The `/pages/[slug]` route renders these directly
 * (bypassing the CMS): the `title` becomes the page heading and `body` is
 * sanitized-safe HTML shown in a prose article.
 */
export interface StaticPage {
  title: string;
  body: string;
  redirect?: string;
}

export const STATIC_PAGES: Record<string, StaticPage> = {
  'about-us': {
    title: 'About Us',
    body: `
<p>At Zahrah Fashion, we believe looking your best should feel effortless. We offer carefully selected premium fabrics, luxurious fragrances, and timeless accessories that help you celebrate life's special moments in style. Wherever you are in Nigeria, we're here to bring quality and elegance right to your doorstep.</p>

<h2>Our Story</h2>
<p>Zahrah Fashion was born in Abuja with a simple idea: everyone deserves to look and feel their best, whether it's for a wedding, an owambe, Friday prayers, or everyday life. What started as a passion for beautiful fabrics has grown into a trusted destination for Swiss voile lace, rich Ankara prints, long-lasting oud perfumes, handwoven caps, and more.</p>
<p>Every item we offer is chosen with care — because we know it's not just about what you wear, it's about how it makes you feel.</p>

<h2>What We Stand For</h2>
<p><strong>Quality You Can Trust</strong><br/>We carefully source fabrics with beautiful finishes and fragrances that leave a lasting impression.</p>
<p><strong>Friendly, Honest Service</strong><br/>We're real people who genuinely care about helping you find exactly what you need. Our team is always available on WhatsApp to answer your questions and guide you through your order.</p>
<p><strong>Something for Every Occasion</strong><br/>Whether you're buying a single wrapper, shopping for yourself, or placing a full aso-ebi order for a celebration, we've got you covered.</p>

<h2>Style That Speaks for You</h2>
<p>From weddings and family celebrations to everyday elegance, Zahrah Fashion is here to help you express your style with confidence. Whatever the occasion, we're proud to be part of your journey — bringing quality, tradition, and modern fashion together in one place.</p>
`.trim(),
  },

  'privacy-policy': {
    title: 'Privacy Policy',
    body: `
<p>At Zahrah Fashion, your privacy matters to us. We are committed to protecting your personal information and being transparent about how we collect, use, and safeguard it. This Privacy Policy explains our practices and is provided for general information only — it does not constitute legal advice.</p>

<h2>Information We Collect</h2>
<p>When you shop with us or contact us, we may collect:</p>
<ul>
  <li>Your name, phone number, email address, and delivery address.</li>
  <li>Order and payment details needed to process your purchase. Payments are securely processed through Paystack, and we do not store your full card information.</li>
  <li>Basic website usage information, such as the pages you visit, to help us improve your shopping experience.</li>
</ul>

<h2>How We Use Your Information</h2>
<p>We use your information to:</p>
<ul>
  <li>Process and deliver your orders.</li>
  <li>Provide customer support and respond to your enquiries.</li>
  <li>Protect against fraud and maintain the security of our services.</li>
  <li>Send updates, promotions, and new-arrival notifications if you have chosen to receive them.</li>
</ul>

<h2>How We Share Your Information</h2>
<p>We only share your information with trusted service providers that help us operate our business, such as payment processors, delivery partners, and messaging services. We may also disclose information where required by law.</p>
<p>We never sell your personal information to third parties.</p>

<h2>Your Rights and Choices</h2>
<p>You can update your personal information or request the deletion of your account at any time through your account settings or by contacting our support team. If you receive marketing messages from us, you can unsubscribe whenever you choose.</p>

<h2>Contact Us</h2>
<p>If you have any questions about this Privacy Policy or how we handle your information, please contact us at <a href="mailto:hello@zahrahfashion.com">hello@zahrahfashion.com</a>.</p>
<p>Thank you for trusting Zahrah Fashion. We value your privacy and are committed to keeping your information safe.</p>
`.trim(),
  },

  'terms-of-service': {
    title: 'Terms of Service',
    body: `
<p>Welcome to Zahrah Fashion. These Terms of Service govern your use of our website and the purchase of our products. By accessing or using our website, you agree to be bound by these terms.</p>

<h2>Orders</h2>
<p>All orders are subject to product availability and our acceptance. While we strive to keep our inventory and pricing accurate, errors may occasionally occur. We reserve the right to refuse or cancel any order and issue a full refund if a product is unavailable, incorrectly priced, or cannot be fulfilled.</p>

<h2>Pricing and Payment</h2>
<p>All prices are displayed in Nigerian Naira (₦).</p>
<p>Payments are processed securely through Paystack. Where available, we may also offer Pay on Delivery as a payment option. By placing an order, you confirm that you are authorised to use the payment method you have selected.</p>

<h2>Tax</h2>
<p>Where applicable, tax is calculated as a percentage of your order's product subtotal and added on top of the item prices. It is not included in the price shown on each product and does not apply to delivery fees. Any tax due is shown clearly as a separate <strong>&ldquo;Tax&rdquo;</strong> line in your order summary at checkout before you pay, and is included in your final order total. Tax rates may change from time to time, and the rate applied is the one in effect at the time your order is placed.</p>

<h2>Delivery and Returns</h2>
<p>We work to deliver your orders as quickly as possible, but delivery times are estimates and may vary depending on your location and other circumstances.</p>
<p>Returns, exchanges, and refunds are handled in accordance with our <a href="/pages/returns-policy">Returns &amp; Refunds Policy</a>.</p>

<h2>Acceptable Use</h2>
<p>When using our website, you agree not to:</p>
<ul>
  <li>Use the website for any unlawful or fraudulent purpose.</li>
  <li>Attempt to interfere with the security, performance, or operation of the website.</li>
  <li>Copy, reproduce, distribute, or use our content, images, logos, or trademarks without our written permission.</li>
  <li>Violate the intellectual property rights of Zahrah Fashion or any third party.</li>
</ul>

<h2>Changes to These Terms</h2>
<p>We may update these Terms of Service from time to time. Any changes will take effect once they are published on this website. By continuing to use our website after updates are posted, you agree to the revised terms.</p>

<h2>Contact Us</h2>
<p>If you have any questions about these Terms of Service, please contact us at <a href="mailto:hello@zahrahfashion.com">hello@zahrahfashion.com</a>.</p>
`.trim(),
  },

  'delivery-information': {
    title: 'Delivery Information',
    body: `
<p>We deliver premium fabrics, perfumes, accessories, and gift packages to customers across Nigeria with fast, reliable service.</p>

<h2>Delivery Times</h2>
<ul>
  <li><strong>Abuja:</strong> 1–2 business days</li>
  <li><strong>Lagos &amp; other major cities:</strong> 2–4 business days</li>
  <li><strong>Rest of Nigeria:</strong> 3–6 business days</li>
</ul>
<p>Please note that delivery times are estimates and may vary due to weather, public holidays, or courier operations.</p>

<h2>Delivery Fees</h2>
<p>Delivery fees are calculated at checkout based on your location.</p>
<p>We also offer <strong>free delivery within Abuja</strong> on qualifying orders. Orders are processed and dispatched once payment has been confirmed or, where available, after a Pay on Delivery order has been verified.</p>

<h2>Pay on Delivery</h2>
<p>Pay on Delivery is available on eligible orders within <strong>Abuja</strong>.</p>
<p>You can also pay securely online using your debit or credit card, bank transfer, or USSD through Paystack.</p>

<h2>Tracking Your Order</h2>
<p>Once your order has been dispatched, you'll receive a tracking link so you can follow its progress.</p>
<p>You can also check your order status anytime from <a href="/account">My Orders</a> in your account or contact us on WhatsApp, and our team will be happy to assist you.</p>
`.trim(),
  },

  'returns-policy': {
    title: 'Returns & Refunds',
    body: `
<p>We want you to shop with confidence. If you're not completely satisfied with your purchase, we're here to help.</p>

<h2>7-Day Return Policy</h2>
<p>Eligible items can be returned within <strong>7 days</strong> of delivery, provided they:</p>
<ul>
  <li>Have not been used, worn, or washed.</li>
  <li>Are returned in their original packaging.</li>
  <li>Have all original tags and labels attached.</li>
  <li>Are in the same condition in which they were received.</li>
</ul>

<h2>Items That Cannot Be Returned</h2>
<p>For hygiene and product-specific reasons, the following items are not eligible for return:</p>
<ul>
  <li>Cut fabrics or fabrics sold by custom measurement.</li>
  <li>Made-to-measure or customised products.</li>
  <li>Opened perfumes, fragrances, or cosmetic products.</li>
  <li><strong>Gift cards and store balance top-ups</strong> — these are non-refundable.</li>
  <li>Items marked as <strong>Final Sale</strong> or <strong>Non-Returnable</strong>.</li>
</ul>

<h2>How to Request a Return</h2>
<p>To start a return, simply:</p>
<ul>
  <li>Visit <a href="/account">My Orders</a> in your account and select the item you wish to return, or</li>
  <li>Contact us on WhatsApp with your order number.</li>
</ul>
<p>Our team will guide you through the return process, including pickup or drop-off instructions where applicable.</p>

<h2>Refunds</h2>
<p>Once we receive and inspect your returned item, we'll let you know whether your refund has been approved.</p>
<p>If approved, your refund will be processed to your original payment method within <strong>5–10 business days</strong>.</p>
<p>Please note that delivery charges are non-refundable unless the return is the result of an incorrect, damaged, or defective item sent by Zahrah Fashion.</p>
<p><strong>Gift cards and store balance top-ups are non-refundable and cannot be exchanged for cash.</strong></p>

<h2>Need Help?</h2>
<p>If you have any questions about returns or refunds, our customer support team is always happy to assist you through WhatsApp or our support email.</p>
`.trim(),
  },

  contact: {
    title: 'Contact us',
    body: `
<p>We'd love to hear from you. Our team responds fastest on WhatsApp.</p>
<h2>Chat with us</h2>
<p>Tap the WhatsApp button in the corner of any page for quick help with orders, sizing, bulk enquiries and more.</p>
<h2>Email</h2>
<p><a href="mailto:hello@zahrahfashion.com">hello@zahrahfashion.com</a></p>
<h2>Visit our shops</h2>
<p>See our store locations and opening hours on the <a href="/shops">Shops</a> page.</p>
<h2>Support hours</h2>
<p>Monday–Saturday, 9am–7pm (WAT). Messages sent outside these hours are answered the next working day.</p>
`.trim(),
  },

  faq: {
    title: 'Frequently Asked Questions',
    body: `
<h2>How do I place an order?</h2>
<p>Browse our collection, add your favourite items to your cart, and proceed to checkout. If you'd rather order through WhatsApp, simply tap the WhatsApp button and our team will assist you.</p>

<h2>What payment methods do you accept?</h2>
<p>We accept secure payments by debit or credit card, bank transfer, and USSD through Paystack. Pay on Delivery is also available on eligible orders within Abuja.</p>

<h2>Do you deliver nationwide?</h2>
<p>Yes. We deliver to customers across Nigeria. Visit our <a href="/pages/delivery-information">Delivery Information</a> page for estimated delivery times and shipping fees.</p>

<h2>How do I track my order?</h2>
<p>Once your order has been dispatched, we'll send you a tracking link. You can also view the latest status anytime from <a href="/account">My Orders</a> in your account.</p>

<h2>What is your return policy?</h2>
<p>Eligible items can be returned within <strong>7 days</strong> of delivery, provided they meet our return conditions. For full details, please see our <a href="/pages/returns-policy">Returns &amp; Refunds</a> policy.</p>
`.trim(),
  },
};
