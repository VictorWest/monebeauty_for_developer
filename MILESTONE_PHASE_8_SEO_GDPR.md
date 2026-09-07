# Milestone: Phase 8 SEO + GDPR Finalize

Status: implemented, automated verification pending in this session. Phase 6 notifications
remain intentionally skipped/deferred.

## What Was Already Done Before This Milestone

- [x] Sitemap and robots routes already existed.
- [x] Locale alternates and canonical helpers already existed.
- [x] Homepage already emitted `MedicalClinic` JSON-LD.
- [x] Booking, checkout, and chat already captured explicit GDPR consent.
- [x] Phase 5 admin CRM already had audited sensitive-field access.

## Phase 8 Implementation Checklist

- [x] Add localized cookie-consent banner.
- [x] Gate GA4 loading behind accepted analytics consent.
- [x] Keep analytics disabled when `NEXT_PUBLIC_GA_ID` is unset.
- [x] Add richer `MedicalClinic` JSON-LD fields: `@id`, logo image, price range, social links,
      geo, and by-appointment opening-hours specification.
- [x] Harden `robots.txt` to disallow `/admin/` and `/api/`.
- [x] Replace placeholder legal pages with localized privacy, terms, and cookie policy text.
- [x] Add admin-only client data export endpoint.
- [x] Add admin-only client erasure/anonymization endpoint.
- [x] Add CRM profile export and erasure controls.
- [x] Audit client data export and erasure actions.
- [x] Preserve operational appointment/order rows while removing/anonymizing client PII.
- [x] Update roadmap and project agent docs.

## Verification Checklist

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Manual smoke: first visit shows cookie banner.
- [ ] Manual smoke: declining cookies does not inject GA.
- [ ] Manual smoke: accepting cookies injects GA only when `NEXT_PUBLIC_GA_ID` is set.
- [ ] Manual smoke: `/robots.txt` disallows `/admin/` and `/api/`.
- [ ] Manual smoke: `/sitemap.xml` includes localized public pages.
- [ ] Manual smoke: homepage JSON-LD passes Rich Results or Schema validator.
- [ ] Manual smoke: admin client export downloads JSON and creates an audit row.
- [ ] Manual smoke: admin client erasure requires typing `ERASE`, anonymizes PII, and creates
      an audit row.
- [ ] Lighthouse/Core Web Vitals check on deployed public pages.

## Deferred Work

- [ ] Phase 6 email/SMS confirmations, reminders, and staff alerts.
- [ ] Search Console property setup and sitemap submission.
- [ ] Production SSL/domain verification.
- [ ] Formal legal review of privacy, terms, and cookie policy copy.
- [ ] Full automated browser tests for cookie and GDPR admin flows.

## Resume Notes

- Cookie consent lives in `components/privacy/CookieConsent.tsx`.
- GA gating lives in `components/privacy/Analytics.tsx`.
- GDPR export endpoint: `app/api/admin/clients/[id]/export/route.ts`.
- GDPR erase endpoint: `app/api/admin/clients/[id]/erase/route.ts`.
- CRM export/erase controls live in `app/admin/(protected)/clients/[id]/page.tsx`.
- Legal copy is in `messages/{en,fi,ru}.json` under `Legal`.
