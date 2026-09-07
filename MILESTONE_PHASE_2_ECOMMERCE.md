# Milestone: Phase 2 E-commerce

Status: implemented, automated verification passed. Manual browser smoke remains optional.

## What Was Already Done Before This Milestone

- [x] Next.js App Router, TypeScript, Tailwind, Prisma, and `next-intl` are scaffolded.
- [x] The site uses **Mone Beauty Clinic** brand constants from `content/site.ts`.
- [x] The scraped product catalog is generated into `content/generated/products.json`.
- [x] All 31 AROSHA/DIXIDOX products render at `/catalog` and `/catalog/[slug]`.
- [x] Prisma already contains `Product`, `ProductContent`, `Cart`, `CartItem`, `Order`, and `OrderItem`.
- [x] `/basket` existed as a placeholder.
- [x] Lean booking is implemented at reduced scope and persists bookings through Prisma.

## Phase 2 Implementation Checklist

- [x] Add client cart state backed by `localStorage`.
- [x] Resolve cart lines server-independently from the generated product registry.
- [x] Wire add-to-cart buttons on catalog cards, homepage product cards, and product detail pages.
- [x] Add a live cart count badge to the desktop and mobile header basket link.
- [x] Replace `/basket` placeholder with real cart line items.
- [x] Add quantity increase/decrease controls.
- [x] Add remove-from-cart behavior.
- [x] Show item count and subtotal in `/basket`.
- [x] Add `/checkout` route.
- [x] Add checkout form with full name, phone, email, optional notes, and GDPR consent.
- [x] Block checkout submission without GDPR consent.
- [x] Add `POST /api/checkout`.
- [x] Validate checkout payload server-side.
- [x] Recalculate totals server-side from `content/products.ts`.
- [x] Self-heal Prisma `Product` rows during checkout when generated products have not been seeded.
- [x] Create/update `Client` during checkout.
- [x] Persist `Order` and nested `OrderItem` rows.
- [x] Persist `Consent` row with type `gdpr_checkout`.
- [x] Add `/order/[id]` noindex confirmation page.
- [x] Clear the browser cart after successful checkout.
- [x] Add EN/FI/RU translations for cart, checkout, and order confirmation.
- [x] Keep payment capture deferred.
- [x] Keep confirmation email deferred.

## Verification Checklist

- [x] `npm run lint`
- [x] `npm run build`
- [ ] Manual smoke: add from `/catalog`, update quantity in `/basket`, submit checkout, confirm order page.
- [ ] Manual smoke at 390px mobile viewport.

## Deferred Work

- [ ] Online payment provider and paid order states.
- [ ] Transactional order confirmation email.
- [ ] Admin order management UI.
- [ ] Client account order history.
- [ ] Inventory/stock tracking.
- [ ] Shipping/pickup policy content from the clinic.

## Resume Notes

- Cart state lives in `components/shop/CartProvider.tsx` and `lib/cart.ts`.
- Add-to-cart UI lives in `components/shop/AddToCartButton.tsx`.
- Basket UI lives in `components/shop/BasketClient.tsx`.
- Checkout UI lives in `components/shop/CheckoutForm.tsx`.
- Checkout persistence lives in `app/api/checkout/route.ts`.
- Confirmation page lives in `app/[locale]/order/[id]/page.tsx`.
- The order flow is an order request, not payment capture. Orders are created as `PENDING`.
