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
<p>From a single retail outlet to a growing premium fashion brand, ZAHRA FASHION HUB LIMITED was founded with one mission—to provide carefully curated fabrics, perfumes and accessories that inspire confidence, elegance and timeless style. Today, we proudly serve customers across Abuja while building a trusted retail brand for generations to come.</p>

<p>At Zahrah Fashion Hub, we believe looking your best should feel effortless. We offer carefully selected premium fabrics, luxurious fragrances, and timeless accessories that help you celebrate life's special moments in style. Wherever you are in Nigeria, we're here to bring quality and elegance right to your doorstep.</p>

<h2>Our Vision</h2>
<p>Our vision is to become Nigeria's most trusted premium fabrics retail brand, delivering exceptional products and memorable customer experiences.</p>

<h2>What We Stand For</h2>
<p><strong>Quality You Can Trust</strong><br/>We carefully source fabrics with beautiful finishes and fragrances that leave a lasting impression.</p>
<p><strong>Friendly, Honest Service</strong><br/>We're real people who genuinely care about helping you find exactly what you need. Our team is always available on WhatsApp to answer your questions and guide you through your order.</p>
<p><strong>Something for Every Occasion</strong><br/>Whether you're buying a single wrapper, shopping for yourself, or placing a full aso-ebi order for a celebration, we've got you covered.</p>

<h2>Style That Speaks for You</h2>
<p>From weddings and family celebrations to everyday elegance, Zahrah Fashion Hub is here to help you express your style with confidence. Whatever the occasion, we're proud to be part of your journey — bringing quality, tradition, and modern fashion together in one place.</p>
`.trim(),
  },

  'privacy-policy': {
    title: 'Privacy Policy',
    body: `
<p><strong>Effective Date:</strong> 10 July 2026<br/><strong>Last Updated:</strong> 10 July 2026</p>
<p>At ZAHRA FASHION HUB LIMITED ("ZAHRA FASHION HUB", "we", "our", or "us"), we respect your privacy and are committed to protecting your personal information.</p>
<p>This Privacy Policy explains how we collect, use, store, disclose and safeguard your personal information when you visit our website, purchase our products, communicate with us, or use any of our services.</p>
<p>By accessing or using this website, you acknowledge that you have read and understood this Privacy Policy.</p>

<h2>Information We Collect</h2>
<p>Depending on how you interact with our website, we may collect the following information:</p>
<h3>Personal Information</h3>
<ul>
  <li>Full Name</li>
  <li>Email Address</li>
  <li>Telephone Number</li>
  <li>WhatsApp Number</li>
  <li>Delivery Address</li>
  <li>Billing Address</li>
  <li>Order Information</li>
  <li>Payment Reference Information</li>
</ul>
<p><strong>Important:</strong> We do not store your debit card or credit card details. Payments are securely processed through trusted third-party payment providers such as Paystack.</p>
<h3>Technical Information</h3>
<p>We may automatically collect:</p>
<ul>
  <li>IP Address</li>
  <li>Browser Type</li>
  <li>Device Information</li>
  <li>Operating System</li>
  <li>Website Usage Information</li>
  <li>Pages Visited</li>
  <li>Time Spent on Pages</li>
  <li>Referral Source</li>
  <li>Cookies and Similar Technologies</li>
</ul>

<h2>How We Use Your Information</h2>
<p>We use your information to:</p>
<ul>
  <li>Process and fulfil your orders.</li>
  <li>Deliver purchased products.</li>
  <li>Respond to customer enquiries.</li>
  <li>Provide customer support.</li>
  <li>Send order confirmations and delivery updates.</li>
  <li>Improve our website and services.</li>
  <li>Personalise your shopping experience.</li>
  <li>Prevent fraud and enhance security.</li>
  <li>Comply with legal obligations.</li>
  <li>Send promotional offers where you have chosen to receive them.</li>
</ul>

<h2>Cookies and Tracking Technologies</h2>
<p>Our website uses cookies and similar technologies to improve your browsing experience. These technologies help us:</p>
<ul>
  <li>Remember your preferences.</li>
  <li>Improve website performance.</li>
  <li>Understand visitor behaviour.</li>
  <li>Measure advertising effectiveness.</li>
  <li>Deliver more relevant advertising.</li>
</ul>
<p>You may disable cookies through your browser settings; however, some website features may not function properly.</p>

<h2>Analytics and Advertising Technologies</h2>
<p>To improve our services and marketing performance, we may use trusted analytics and advertising technologies to boost awareness.</p>

<h2>WhatsApp Communication</h2>
<p>When you contact us through WhatsApp, you voluntarily provide information that allows us to respond to your enquiries and provide customer support. We may also use WhatsApp to:</p>
<ul>
  <li>Confirm orders</li>
  <li>Provide delivery updates</li>
  <li>Respond to customer enquiries</li>
  <li>Share promotional offers (only where permitted)</li>
</ul>
<p>You may request to stop receiving promotional WhatsApp messages at any time.</p>

<h2>How We Share Your Information</h2>
<p>We value your privacy. We do not sell your personal information. However, we may share information with trusted third parties where necessary, including:</p>
<ul>
  <li>Payment processors</li>
  <li>Delivery partners</li>
  <li>Analytics providers</li>
  <li>Advertising platforms</li>
  <li>Government authorities where required by law</li>
</ul>
<p>All third parties are expected to protect your information appropriately.</p>

<h2>Data Security</h2>
<p>We implement appropriate administrative, technical and organisational measures designed to protect your personal information against:</p>
<ul>
  <li>Unauthorised access</li>
  <li>Loss</li>
  <li>Misuse</li>
  <li>Disclosure</li>
  <li>Alteration</li>
  <li>Destruction</li>
</ul>
<p>While we take reasonable precautions, no internet transmission or electronic storage system can be guaranteed to be completely secure.</p>

<h2>Data Retention</h2>
<p>We retain your personal information to:</p>
<ul>
  <li>Provide our services.</li>
  <li>Complete transactions.</li>
  <li>Comply with legal obligations.</li>
  <li>Resolve disputes.</li>
  <li>Enforce our agreements.</li>
</ul>
<p>When your information is no longer required, it will be securely deleted or anonymised.</p>

<h2>Your Rights</h2>
<p>Subject to applicable law, you may have the right to:</p>
<ul>
  <li>Request access to your personal information.</li>
  <li>Request correction of inaccurate information.</li>
  <li>Request deletion of your personal information.</li>
  <li>Withdraw consent where applicable.</li>
  <li>Object to certain processing activities.</li>
  <li>Request restriction of processing.</li>
  <li>Request a copy of your personal information.</li>
</ul>
<p>To exercise any of these rights, please contact us using the details below.</p>

<h2>Marketing Communications</h2>
<p>If you subscribe to receive promotional communications, we may send information about:</p>
<ul>
  <li>New arrivals</li>
  <li>Special offers</li>
  <li>Seasonal collections</li>
  <li>Promotions</li>
  <li>Events</li>
</ul>
<p>You may unsubscribe at any time by clicking the unsubscribe link in our emails, contacting us directly, or sending us a WhatsApp message requesting removal.</p>

<h2>Children's Privacy</h2>
<p>Our website is intended for adults. We do not knowingly collect personal information from children under the age of 18 without appropriate parental or guardian consent.</p>

<h2>Third-Party Websites</h2>
<p>Our website may contain links to third-party websites. We are not responsible for the privacy practices or content of external websites. We encourage you to review their privacy policies before providing personal information.</p>

<h2>Changes to This Privacy Policy</h2>
<p>We may update this Privacy Policy from time to time. Any changes will be posted on this page together with the updated revision date. Your continued use of the website after changes are published constitutes acceptance of the updated Privacy Policy.</p>

<h2>Governing Law</h2>
<p>This Privacy Policy shall be governed by and interpreted in accordance with the laws of the Federal Republic of Nigeria, including the Nigeria Data Protection Act (NDPA) 2023, where applicable.</p>

<h2>Contact Us</h2>
<p>If you have any questions regarding this Privacy Policy or how we handle your personal information, please contact us:</p>
<p><strong>ZAHRA FASHION HUB LIMITED</strong></p>
[[SHOPS]]

<h2>Thank You</h2>
<p>Thank you for trusting ZAHRA FASHION HUB LIMITED. Your privacy is important to us, and we remain committed to protecting your personal information while providing premium products, exceptional customer service, and a secure online shopping experience.</p>
<p><em>Style Defined.</em></p>
`.trim(),
  },

  'terms-of-service': {
    title: 'Terms of Service',
    body: `
<p><strong>Effective Date:</strong> 10 July 2026<br/><strong>Last Updated:</strong> 10 July 2026</p>

<h2>1. Introduction</h2>
<p>Welcome to ZAHRA FASHION HUB LIMITED ("ZAHRA FASHION HUB", "we", "our", or "us"). These Terms of Service ("Terms") govern your access to and use of our website, products, services and online store.</p>
<p>By accessing our website or placing an order, you agree to be bound by these Terms. If you do not agree with these Terms, please do not use this website.</p>

<h2>2. Eligibility</h2>
<p>By using this website, you confirm that:</p>
<ul>
  <li>You are at least 18 years old or have the permission of a parent or legal guardian.</li>
  <li>The information you provide is accurate and complete.</li>
  <li>You have the legal authority to enter into this agreement.</li>
</ul>

<h2>3. Products</h2>
<p>We make every effort to display our products accurately. However:</p>
<ul>
  <li>Colours may vary depending on your device or screen settings.</li>
  <li>Fabric patterns may vary slightly from photographs.</li>
  <li>Measurements are approximate.</li>
  <li>Product availability may change without notice.</li>
</ul>
<p>We reserve the right to discontinue or modify products at any time.</p>

<h2>4. Pricing</h2>
<p>All prices are displayed in Nigerian Naira (₦) unless otherwise stated. Prices may change without prior notice. The applicable price is the one displayed at the time your order is confirmed.</p>

<h2>5. Orders</h2>
<p>Placing an order does not automatically guarantee acceptance. We reserve the right to:</p>
<ul>
  <li>Accept or decline any order.</li>
  <li>Limit purchase quantities.</li>
  <li>Cancel orders where pricing errors occur.</li>
  <li>Cancel orders where products become unavailable.</li>
</ul>
<p>Where payment has already been received for an order we cannot fulfil, a full refund will be processed.</p>

<h2>6. Payments</h2>
<p>Payments are securely processed through trusted payment providers including Paystack. We do not store your debit or credit card details. Orders will only be processed after payment has been successfully confirmed unless another payment arrangement has been expressly agreed.</p>

<h2>7. Delivery</h2>
<p>Delivery times are estimates only. Actual delivery may vary depending on:</p>
<ul>
  <li>Customer location</li>
  <li>Courier availability</li>
  <li>Weather conditions</li>
  <li>Public holidays</li>
  <li>Other unforeseen circumstances</li>
</ul>
<p>Delivery charges, where applicable, will be displayed before checkout.</p>

<h2>8. Store Collection</h2>
<p>Customers may choose to collect eligible orders from our retail stores. Collection details will be communicated after order confirmation.</p>

<h2>9. Returns and Refunds</h2>
<p>Returns, exchanges and refunds are governed by our <a href="/pages/returns-policy">Returns &amp; Refund Policy</a>. Please review that policy before placing an order.</p>

<h2>10. Product Availability</h2>
<p>Although we work hard to maintain accurate inventory, products may occasionally become unavailable. Where this occurs, we may:</p>
<ul>
  <li>Offer a suitable alternative;</li>
  <li>Delay delivery pending restocking; or</li>
  <li>Provide a full refund.</li>
</ul>

<h2>11. Customer Responsibilities</h2>
<p>You agree to:</p>
<ul>
  <li>Provide accurate information.</li>
  <li>Keep your account secure.</li>
  <li>Use the website lawfully.</li>
  <li>Respect intellectual property rights.</li>
  <li>Not misuse the website.</li>
</ul>

<h2>12. Acceptable Use</h2>
<p>You must not:</p>
<ul>
  <li>Use the website for unlawful purposes.</li>
  <li>Attempt to hack or interfere with website security.</li>
  <li>Copy website content without written permission.</li>
  <li>Misrepresent products or the company.</li>
</ul>

<h2>13. Intellectual Property</h2>
<p>All website content including logos, images, product photographs, graphics, designs, text, videos, branding and software remain the exclusive property of ZAHRA FASHION HUB LIMITED unless otherwise stated. No content may be copied, reproduced or distributed without prior written permission.</p>

<h2>14. User Content</h2>
<p>Where customers submit reviews, comments, testimonials or photographs, they grant ZAHRA FASHION HUB LIMITED a non-exclusive licence to display and use such content for marketing and promotional purposes.</p>

<h2>15. Promotions</h2>
<p>Special promotions, discounts and promotional codes:</p>
<ul>
  <li>cannot be exchanged for cash;</li>
  <li>may be withdrawn at any time;</li>
  <li>may have additional terms and conditions.</li>
</ul>

<h2>16. Limitation of Liability</h2>
<p>To the maximum extent permitted by law, ZAHRA FASHION HUB LIMITED shall not be liable for:</p>
<ul>
  <li>indirect losses;</li>
  <li>consequential damages;</li>
  <li>business interruption;</li>
  <li>loss of profits;</li>
  <li>delays beyond our reasonable control.</li>
</ul>
<p>Our total liability shall not exceed the value of the products purchased.</p>

<h2>17. Indemnity</h2>
<p>You agree to indemnify and hold harmless ZAHRA FASHION HUB LIMITED, its directors, employees and representatives from any claims arising from misuse of the website, violation of these Terms, or unlawful conduct.</p>

<h2>18. Privacy</h2>
<p>Your use of this website is also governed by our <a href="/pages/privacy-policy">Privacy Policy</a>. Please review our Privacy Policy to understand how we collect and process personal information.</p>

<h2>19. Third-Party Services</h2>
<p>Our website may integrate third-party services including Paystack, WhatsApp, Google Maps and Google Analytics. Your use of those services may also be subject to their respective terms.</p>

<h2>20. Force Majeure</h2>
<p>We shall not be liable for delays or failure to perform caused by circumstances beyond our reasonable control, including natural disasters, strikes, civil unrest, internet failures, government actions and pandemics.</p>

<h2>21. Governing Law</h2>
<p>These Terms shall be governed by and interpreted in accordance with the laws of the Federal Republic of Nigeria.</p>

<h2>22. Dispute Resolution</h2>
<p>Before commencing legal proceedings, both parties agree to make reasonable efforts to resolve disputes amicably. Where disputes cannot be resolved amicably, they shall be submitted to the courts of competent jurisdiction in Nigeria.</p>

<h2>23. Changes to These Terms</h2>
<p>We may update these Terms from time to time. The latest version will always be published on this website together with the updated revision date. Continued use of the website constitutes acceptance of the revised Terms.</p>

<h2>24. Contact Us</h2>
<p>For questions regarding these Terms, please contact us:</p>
<p><strong>ZAHRA FASHION HUB LIMITED</strong></p>
[[SHOPS]]

<h2>Thank You</h2>
<p>Thank you for choosing ZAHRA FASHION HUB LIMITED. We appreciate your trust and remain committed to providing premium products, exceptional customer service and a secure shopping experience.</p>
<p><em>Style Defined.</em></p>
`.trim(),
  },

  'delivery-information': {
    title: 'Delivery Information',
    body: `
<p><strong>Effective Date:</strong> 10 July 2026<br/><strong>Last Updated:</strong> 10 July 2026</p>
<p>At ZAHRA FASHION HUB LIMITED, we are committed to delivering your orders safely, promptly and professionally. Whether you are shopping from Abuja or anywhere else in Nigeria, our goal is to ensure your products arrive in excellent condition and within the estimated delivery timeframe.</p>

<h2>Delivery Coverage</h2>
<p>We currently deliver to customers across Nigeria. Orders may be delivered through our in-house logistics team or trusted third-party courier partners, depending on your location.</p>

<h2>Delivery Timeframes</h2>
<p>Estimated delivery times are as follows:</p>
<ul>
  <li><strong>Abuja Municipal Area:</strong> 1–2 business days</li>
  <li><strong>Other major cities</strong> (Lagos, Kano, Port Harcourt, Ibadan, Kaduna, Enugu, etc.): 2–4 business days</li>
  <li><strong>Other locations within Nigeria:</strong> 3–7 business days</li>
</ul>
<p>Please note that these are estimated delivery periods and may vary due to weather conditions, public holidays, security restrictions, courier operations or other unforeseen circumstances.</p>

<h2>Delivery Charges</h2>
<p>Delivery charges are calculated during checkout based on:</p>
<ul>
  <li>Delivery destination</li>
  <li>Size and weight of the order</li>
  <li>Selected delivery method</li>
</ul>
<p>Any applicable delivery fee will be displayed before payment is completed.</p>

<h2>Free Delivery</h2>
<p>From time to time, ZAHRA FASHION HUB LIMITED may offer free delivery promotions for selected products, order values or locations. Any such promotion will be clearly communicated on our website or social media platforms.</p>

<h2>Order Processing</h2>
<p>Orders are processed after successful payment confirmation. Orders received:</p>
<ul>
  <li>Monday to Friday are generally processed within one business day.</li>
  <li>During weekends or public holidays will be processed on the next business day.</li>
</ul>
<p>Large orders or special requests may require additional processing time.</p>

<h2>Click &amp; Collect</h2>
<p>Customers may choose to collect eligible orders from either of our retail branches (see locations below). You will be notified once your order is ready for collection.</p>

<h2>Payment Methods</h2>
<p>We currently accept:</p>
<ul>
  <li>Paystack secure payments</li>
  <li>Debit cards</li>
  <li>Credit cards</li>
  <li>Bank transfer</li>
  <li>USSD (where supported)</li>
</ul>

<h2>Order Tracking</h2>
<p>Once your order has been dispatched, you may receive:</p>
<ul>
  <li>Order confirmation</li>
  <li>Dispatch notification</li>
  <li>Tracking number (where available)</li>
  <li>Delivery updates</li>
</ul>
<p>Customers may also contact our Customer Service team through WhatsApp for assistance.</p>

<h2>Failed Deliveries</h2>
<p>A delivery may be unsuccessful if:</p>
<ul>
  <li>The delivery address is incorrect.</li>
  <li>The recipient cannot be reached.</li>
  <li>The recipient is unavailable.</li>
  <li>Security restrictions prevent delivery.</li>
</ul>
<p>Where this occurs, our Customer Service team will contact you to arrange a second delivery attempt where possible. Additional delivery charges may apply for repeat delivery attempts.</p>

<h2>Delivery Inspection</h2>
<p>We encourage customers to inspect their orders immediately upon delivery. If you notice damaged packaging, missing items or incorrect products, please notify us within 48 hours of receiving your order.</p>

<h2>Ownership and Risk</h2>
<p>Ownership of products transfers to the customer upon successful delivery or collection. The risk of loss or damage also transfers at that point.</p>

<h2>Force Majeure</h2>
<p>Delivery delays caused by circumstances beyond our reasonable control — including severe weather, civil unrest, transportation disruptions, government actions, strikes or other emergencies — shall not constitute a breach of this Delivery Policy.</p>

<h2>Customer Responsibilities</h2>
<p>Customers are responsible for:</p>
<ul>
  <li>Providing accurate delivery information.</li>
  <li>Providing a valid telephone number.</li>
  <li>Being available to receive deliveries.</li>
  <li>Inspecting products upon receipt.</li>
</ul>
<p>Incorrect delivery information may result in delays or additional delivery charges.</p>

<h2>Contact Us</h2>
<p>If you have any questions regarding deliveries, please contact us:</p>
<p><strong>ZAHRA FASHION HUB LIMITED</strong></p>
[[SHOPS]]

<h2>Thank You</h2>
<p>Thank you for choosing ZAHRA FASHION HUB LIMITED. We appreciate your trust and remain committed to delivering premium products with the same care and attention that define our brand.</p>
<p><em>Style Defined.</em></p>
`.trim(),
  },

  'returns-policy': {
    title: 'Returns & Refund Policy',
    body: `
<p>At ZAHRA FASHION HUB LIMITED, customer satisfaction is important to us. We take great care in selecting and delivering premium fabrics, perfumes, accessories and related products. If you are not completely satisfied with your purchase, this Returns &amp; Refund Policy explains when returns, exchanges and refunds may be available.</p>
<p>By placing an order with us, you agree to this policy.</p>

<h2>Return Eligibility</h2>
<p>Eligible products may be returned within 7 calendar days of delivery or collection, provided that they:</p>
<ul>
  <li>Have not been used, worn, washed or altered.</li>
  <li>Are returned in their original condition.</li>
  <li>Include all original packaging, labels and tags.</li>
  <li>Are accompanied by proof of purchase (receipt or order confirmation).</li>
  <li>Show no signs of damage caused after delivery.</li>
</ul>
<p>All returned items are subject to inspection before approval.</p>

<h2>Items That Cannot Be Returned</h2>
<p>For hygiene, quality control and product-specific reasons, the following items cannot be returned unless they were delivered damaged, defective or incorrectly supplied:</p>
<ul>
  <li>Fabrics that have been cut, altered or customised.</li>
  <li>Special-order or made-to-measure products.</li>
  <li>Opened perfumes, fragrances or cosmetics.</li>
  <li>Gift cards and store credit.</li>
  <li>Clearance or sale items marked Final Sale or Non-Returnable.</li>
  <li>Products damaged through misuse, improper handling or normal wear and tear.</li>
</ul>

<h2>Damaged, Defective or Incorrect Orders</h2>
<p>If you receive the wrong product, a damaged item, a defective product, or an incomplete order, please notify us within 48 hours of delivery by contacting our Customer Service team through WhatsApp or email.</p>
<p>Please include:</p>
<ul>
  <li>Your order number.</li>
  <li>A description of the issue.</li>
  <li>Clear photographs of the product and packaging.</li>
</ul>
<p>We will investigate promptly and, where appropriate, arrange a replacement, exchange or refund.</p>

<h2>Exchanges</h2>
<p>Where stock is available, eligible products may be exchanged for another colour, another design, or another available product of equal value.</p>
<p>If the replacement product has a higher value, the customer will pay the price difference. If it has a lower value, the difference may be refunded or issued as store credit, at our discretion.</p>

<h2>How to Request a Return</h2>
<ol>
  <li>Contact our Customer Service team within 7 calendar days of receiving your order.</li>
  <li>Provide your order number and reason for the return.</li>
  <li>Follow the return instructions provided by our team.</li>
  <li>Securely package the product before returning it.</li>
</ol>
<p>Returns sent without prior approval may not be accepted.</p>

<h2>Return Shipping</h2>
<p>Where a return is approved, customers are responsible for return shipping costs unless the return results from our error, a defective product, or an incorrect item supplied. If the return is due to our error, ZAHRA FASHION HUB LIMITED will bear the reasonable return shipping costs.</p>

<h2>Inspection Process</h2>
<p>Once we receive the returned item, it will be inspected. Inspection typically takes 2–5 business days. After inspection, we will notify you whether the return has been approved, partially approved, or declined.</p>

<h2>Refunds</h2>
<p>Where a refund is approved, it will be processed using the original payment method. Refunds are generally completed within 5–10 business days, depending on your bank or payment provider.</p>
<p>Delivery charges are generally non-refundable, except where the return results from our error, a damaged product, a defective product, or an incorrect item supplied.</p>

<h2>Store Credit</h2>
<p>Where appropriate, we may offer store credit instead of a cash refund. Store credit may be used toward future purchases at ZAHRA FASHION HUB LIMITED.</p>

<h2>Order Cancellations</h2>
<p>Orders may be cancelled before they have been dispatched. Once an order has been shipped, it cannot normally be cancelled and must instead follow this Returns &amp; Refund Policy.</p>

<h2>Fraud Prevention</h2>
<p>To protect both our customers and our business, ZAHRA FASHION HUB LIMITED reserves the right to refuse returns or refunds where fraudulent activity, abuse of this policy or suspicious transactions are identified.</p>

<h2>Limitation of Liability</h2>
<p>Our responsibility is limited to the replacement, exchange or refund of eligible products in accordance with this policy. We shall not be liable for indirect or consequential losses arising from the use of our products.</p>

<h2>Contact Us</h2>
<p>For returns, exchanges or refund enquiries, please contact:</p>
<p><strong>ZAHRA FASHION HUB LIMITED</strong></p>
[[SHOPS]]

<h2>Changes to This Policy</h2>
<p>We may update this Returns &amp; Refund Policy from time to time. Any changes will be published on this page together with the updated revision date.</p>

<h2>Thank You</h2>
<p>Thank you for shopping with ZAHRA FASHION HUB LIMITED. We appreciate your trust and remain committed to providing premium products, exceptional customer service and a shopping experience built on confidence, fairness and quality.</p>
<p><em>Style Defined.</em></p>
`.trim(),
  },

  contact: {
    title: 'Contact us',
    body: `
<p>At ZAHRA FASHION HUB LIMITED, we're always delighted to hear from you. Whether you have a question about our collections, need assistance with an order, want to become a reseller, or simply need style advice, our team is here to help. We are committed to providing prompt, friendly and professional customer service.</p>

<h2>Customer Service</h2>
<p>Our Customer Service team is available to assist you with:</p>
<ul>
  <li>Product enquiries</li>
  <li>Order placement</li>
  <li>Order tracking</li>
  <li>Delivery enquiries</li>
  <li>Returns and exchanges</li>
  <li>Wholesale enquiries</li>
  <li>Reseller opportunities</li>
  <li>General support</li>
</ul>

<h2>Contact Information</h2>
<p><strong>Customer Service / WhatsApp:</strong> <a href="tel:+2347060805195">+234 706 080 5195</a><br/><strong>Email:</strong> <a href="mailto:hello@zahrahfashion.com">hello@zahrahfashion.com</a></p>

<h2>Visit Our Stores</h2>
<p>We welcome you to visit either of our retail locations.</p>
[[SHOPS]]

<h2>Business Hours</h2>
<p>Monday – Saturday, 9:00 AM – 6:00 PM (WAT). Messages received outside business hours will be responded to on the next business day.</p>

<h2>Wholesale &amp; Reseller Enquiries</h2>
<p>Interested in becoming a reseller or placing a bulk order? Our team will be pleased to discuss wholesale purchases, reseller opportunities, fashion designers, wedding and Aso-Ebi groups, corporate orders and event organisers. Please <a href="/partner">become a partner</a> or contact us through WhatsApp or email for more information.</p>

<h2>Online Support</h2>
<p>You can also reach us through WhatsApp, email, Facebook, Instagram and TikTok. Our social media team regularly responds to customer enquiries.</p>

<h2>We Would Love to Hear From You</h2>
<p>Your feedback, suggestions and enquiries help us continue improving our products and services. Whether you're shopping for a special occasion or looking for everyday elegance, we're here to help you find the perfect collection.</p>
<p><em>Style Defined.</em></p>
<p>Thank you for choosing ZAHRA FASHION HUB LIMITED. We look forward to serving you.</p>
`.trim(),
  },

  faq: {
    title: 'Frequently Asked Questions',
    body: `
<p>Welcome to the ZAHRA FASHION HUB LIMITED Frequently Asked Questions (FAQ) page. Here you'll find answers to the questions our customers ask most often. If you need further assistance, our Customer Service team is always happy to help.</p>

<h2>Ordering</h2>
<h3>How do I place an order?</h3>
<p>Shopping with us is simple:</p>
<ol>
  <li>Browse our collections.</li>
  <li>Add your preferred products to your shopping cart.</li>
  <li>Proceed to secure checkout.</li>
  <li>Complete your payment.</li>
  <li>Receive an order confirmation.</li>
</ol>
<p>If you prefer, you can also place your order directly through WhatsApp, and our team will gladly assist you.</p>
<h3>Can I place an order through WhatsApp?</h3>
<p>Yes. Many of our customers enjoy the convenience of ordering through WhatsApp. Simply tap the WhatsApp button on our website, tell us the products you would like to purchase, and our Customer Service team will guide you through the process.</p>
<h3>Can I shop without creating an account?</h3>
<p>Yes. You may complete your purchase as a guest. However, creating an account allows you to:</p>
<ul>
  <li>Track your orders</li>
  <li>Save favourite products</li>
  <li>View previous purchases</li>
  <li>Enjoy a faster checkout experience</li>
</ul>

<h2>Products</h2>
<h3>Are your fabrics authentic?</h3>
<p>Yes. We carefully source premium-quality fabrics and accessories from trusted suppliers to ensure every product meets our quality standards.</p>
<h3>Will the colours match what I see on my screen?</h3>
<p>We make every effort to display product colours accurately. However, colours may vary slightly depending on your device, monitor settings and lighting conditions.</p>
<h3>Do you sell wholesale?</h3>
<p>Yes. We welcome enquiries from fabric retailers, fashion designers, boutique owners, event planners and corporate organisations. Please contact us directly for wholesale pricing and partnership opportunities.</p>

<h2>Payments</h2>
<h3>What payment methods do you accept?</h3>
<p>We currently accept debit cards, credit cards, bank transfer, and USSD (where supported). Payments are securely processed through trusted payment providers, including Paystack.</p>
<h3>Is online payment secure?</h3>
<p>Yes. Payments are securely processed through trusted payment providers, including Paystack. ZAHRA FASHION HUB LIMITED does not store your debit or credit card information on its servers.</p>

<h2>Delivery</h2>
<h3>Do you deliver nationwide?</h3>
<p>Yes. We deliver premium fabrics, perfumes and accessories to customers across Nigeria. Visit our <a href="/pages/delivery-information">Delivery Information</a> page for full details.</p>
<h3>How long does delivery take?</h3>
<p>Estimated delivery times are:</p>
<ul>
  <li>Abuja: 1–2 business days</li>
  <li>Major Nigerian cities: 2–4 business days</li>
  <li>Other locations: 3–7 business days</li>
</ul>
<p>Delivery times are estimates and may vary depending on your location and courier operations.</p>
<h3>Can I collect my order from your store?</h3>
<p>Yes. You may choose to collect eligible orders from either of our retail stores. You will be notified once your order is ready for collection.</p>
<h3>How can I track my order?</h3>
<p>Once your order has been dispatched, we will provide delivery updates. You can also view the latest status anytime from <a href="/account">My Orders</a> in your account, or contact our Customer Service team through WhatsApp for assistance.</p>

<h2>Returns &amp; Refunds</h2>
<h3>What is your return policy?</h3>
<p>Eligible products may be returned within 7 calendar days of delivery, provided they meet the conditions outlined in our <a href="/pages/returns-policy">Returns &amp; Refund Policy</a>.</p>
<h3>Which items cannot be returned?</h3>
<p>The following items are generally non-returnable unless they were supplied incorrectly or are defective:</p>
<ul>
  <li>Cut fabrics</li>
  <li>Custom-made products</li>
  <li>Opened perfumes</li>
  <li>Gift cards</li>
  <li>Clearance items marked Final Sale</li>
  <li>Products damaged after delivery</li>
</ul>
<h3>When will I receive my refund?</h3>
<p>Approved refunds are generally processed within 5–10 business days, depending on your payment provider.</p>

<h2>Stores</h2>
<h3>Where are your stores located?</h3>
<p>We currently operate two retail stores in Abuja.</p>
[[SHOPS]]
<h3>What are your opening hours?</h3>
<p>Our stores are open Monday – Saturday, 9:00 AM – 6:00 PM.</p>

<h2>Customer Support</h2>
<h3>How can I contact Customer Service?</h3>
<p>You may contact us through WhatsApp, email, telephone, or by visiting either of our retail stores. Our team will be happy to assist you.</p>
<h3>How quickly do you respond?</h3>
<p>We aim to respond to customer enquiries as quickly as possible during our normal business hours.</p>

<h2>General</h2>
<h3>Do you have physical stores?</h3>
<p>Yes. Unlike many online retailers, ZAHRA FASHION HUB LIMITED operates physical retail stores where customers can visit, view our collections and purchase products in person.</p>
<h3>Why should I shop with ZAHRA FASHION HUB LIMITED?</h3>
<p>Our customers choose us because we are committed to providing carefully curated premium collections, exceptional customer service, secure online shopping, nationwide delivery, trusted quality, personal shopping assistance and a premium shopping experience.</p>
<h3>Can I become a reseller?</h3>
<p>Yes. We are building a network of trusted resellers across Nigeria. If you are interested in partnering with us, please <a href="/partner">become a partner</a> or contact our team through WhatsApp or email to learn more about our reseller opportunities.</p>
<h3>Do you accept bulk or corporate orders?</h3>
<p>Yes. We supply fabrics and related products for weddings, Aso-Ebi groups, corporate events, religious organisations, schools, fashion designers and retail businesses. Please contact us for customised quotations and bulk pricing.</p>

<h2>Still Need Help?</h2>
<p>If you cannot find the answer you're looking for, our Customer Service team is ready to assist you.</p>
<p><strong>ZAHRA FASHION HUB LIMITED</strong><br/><strong>WhatsApp / Customer Service:</strong> +234 706 080 5195<br/><strong>Email:</strong> <a href="mailto:hello@zahrahfashion.com">hello@zahrahfashion.com</a></p>
<p><em>Style Defined.</em></p>
`.trim(),
  },
};
