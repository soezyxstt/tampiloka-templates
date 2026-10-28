# Benchmark notes

The original Millehub review was recorded on **23 October 2026**. Its screenshots, gallery, and detailed observations remain available in [the historical benchmark folder](https://github.com/soezyxstt/cafe-template/tree/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/public/benchmarks). They are excluded from the reusable application and deployed assets.

## What informed the template

- Keep the venue and table context visible throughout the customer journey.
- Make menu search, categories, product options, quantities, and notes work on a phone.
- Show the cart subtotal, service charge, tax, discount, and final price before submission.
- Preserve explicit empty, pending, failed, and completed states.
- Give staff and customers a clear next step after an order is submitted.

These are interface observations from that recorded session. The template's implementation is verified by its own [test suites and delivery record](verification.md).

## Limits of the recorded review

The review reached a generated QRIS code with a pending-payment status. It did not complete a real payment. A download event occurred, but the captured download was empty, so it did not demonstrate a successful QR file export.

Search, categories, variants, notes, cart editing, and empty-cart states were explored. Real member login/OTP, completed waiter calls, sold-out products, and a successful payment were not verified. Some images show an intermediate loading state or a click without a visible change. The [original observation log](https://github.com/soezyxstt/cafe-template/blob/7fb253d648ebe015fdd82f786de3ea4ae6a793d8/public/benchmarks/README.md) records those limits and the individual screenshot references.

The benchmark's product photographs and branding are research references. They are not client menu assets. Use the supplied source illustrations or the client's approved images in `public/images/`.
