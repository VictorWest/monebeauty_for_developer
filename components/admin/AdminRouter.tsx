import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import type { Locale as DbLocale, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { groupBy } from "@/lib/collections";
import { auditForUser, currentUser, isBackofficeRole } from "@/lib/auth";
import {
  decryptSensitiveJson,
  decryptSensitiveText,
} from "@/lib/sensitive-data";
import type { Locale } from "@/i18n/routing";
import {
  ADMIN_SIDEBAR_COOKIE,
  isAdminSidebarCollapsed,
} from "@/lib/admin-sidebar";
import {
  ADMIN_SEGMENTS,
  LEGACY_ADMIN_SEGMENTS,
  adminBase,
  adminHref,
  adminRecordId,
  type AdminModule,
} from "@/lib/admin-routing";
import { sharedLoginDestination } from "@/lib/shared-login";
import { staffHref } from "@/lib/account-routing";
import {
  adminLoginAction,
  anonymizeClientAction,
  removeArticleAction,
  removeContentPageAction,
  removePricingAction,
  removeProductAction,
  removeServiceAction,
  removeTechnologyAction,
  saveArticleAction,
  saveClientAction,
  saveContentPageAction,
  savePricingAction,
  saveProductAction,
  saveServiceAction,
  saveSiteMediaAction,
  saveTechnologyAction,
} from "@/lib/admin-actions";
import { SITE_MEDIA_DEFINITIONS } from "@/content/site-media";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminPasswordField } from "@/components/admin/AdminPasswordField";
import { EmployeeConfiguration } from "@/components/staff/EmployeeConfiguration";
import { MediaField } from "@/components/admin/MediaField";
import { AdminForm, PendingSaveButton } from "@/components/admin/AdminForm";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import { SharedCalendar } from "@/components/calendar/SharedCalendar";
import { CalendarSetup } from "@/components/calendar/CalendarSetup";
import { StaffAccounts } from "@/components/admin/StaffAccounts";
import { AuditLogs } from "@/components/admin/AuditLogs";
import { IntegrationLogs } from "@/components/admin/IntegrationLogs";
import { ConsultationFormAdmin } from "@/components/admin/ConsultationFormAdmin";
import { ChangeRequestQueue } from "@/components/admin/ChangeRequestQueue";
import { ConversationWorkspace } from "@/components/chat/ConversationWorkspace";
import {
  AppointmentsAdmin,
  OrdersAdmin,
} from "@/components/admin/AdminOperations";
import {
  getRecentBusinessActivity,
  type BusinessActivityAction,
  type BusinessActivityCategory,
} from "@/lib/admin-activity";

const locales: DbLocale[] = ["fi", "en", "ru"];

function markdownImages(markdown = "") {
  return [...markdown.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)].map((match) => ({
    alt: match[1],
    image: match[2],
  }));
}

function InlineMarkdownMediaEditor({
  byLocale,
  label,
  prefix = "bodyImage",
}: {
  byLocale: Map<DbLocale, { alt: string; image: string }[]>;
  label: string;
  prefix?: string;
}) {
  const count = Math.max(
    0,
    ...locales.map((locale) => byLocale.get(locale)?.length ?? 0),
  );
  if (!count) return null;
  return (
    <EditorSection title={label}>
      <div className="grid gap-6">
        {Array.from({ length: count }, (_, index) => {
          const sharedImage = locales
            .map((locale) => byLocale.get(locale)?.[index]?.image)
            .find(Boolean);
          return (
            <div key={index} className="rounded-md border border-line-hair p-3">
              <MediaField
                name={`${prefix}_${index}`}
                label={`${label} ${index + 1}`}
                defaultValue={sharedImage ?? ""}
                required={false}
              />
              <div className={`${alignedFieldGrid} mt-3 md:grid-cols-3`}>
                {locales.map((locale) => (
                  <Field key={locale} label={`Image alt · ${locale}`}>
                    <input
                      name={`${prefix}Alt_${index}_${locale}`}
                      defaultValue={byLocale.get(locale)?.[index]?.alt ?? ""}
                      required={Boolean(byLocale.get(locale)?.[index]?.image)}
                      className={inputCls}
                    />
                  </Field>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </EditorSection>
  );
}
type SearchParams = Record<string, string | string[] | undefined>;
type Copy = ReturnType<typeof makeCopy>;
type ServiceRow = Prisma.ServiceGetPayload<{
  include: { contents: true; options: { include: { contents: true } } };
}>;
type TechnologyRow = Prisma.TechnologyGetPayload<{
  include: { contents: true };
}>;
type ProductRow = Prisma.ProductGetPayload<{ include: { contents: true } }>;
type PricingRow = Prisma.PricingItemGetPayload<{ include: { contents: true } }>;
type ArticleRow = Prisma.ArticleGetPayload<{ include: { contents: true } }>;

function makeCopy(t: Awaited<ReturnType<typeof getTranslations>>) {
  return {
    appName: t("appName"),
    menu: t("menu"),
    close: t("close"),
    expandSidebar: t("expandSidebar"),
    collapseSidebar: t("collapseSidebar"),
    logout: t("logout"),
    locale: t("locale"),
    login: {
      eyebrow: t("login.eyebrow"),
      title: t("login.title"),
      email: t("login.email"),
      password: t("login.password"),
      showPassword: t("login.showPassword"),
      hidePassword: t("login.hidePassword"),
      submit: t("login.submit"),
      invalid: t("login.invalid"),
    },
    dashboard: {
      title: t("dashboard.title"),
      subtitle: t("dashboard.subtitle"),
      recent: t("dashboard.recent"),
      emptyActivity: t("dashboard.emptyActivity"),
      activityCategory: (category: BusinessActivityCategory) =>
        t(`dashboard.activity.categories.${category}`),
      activityAction: (action: BusinessActivityAction) =>
        t(`dashboard.activity.actions.${action}`),
      activityStatus: (status: string) =>
        t(`dashboard.activity.statuses.${status}`),
      quick: t("dashboard.quick"),
      needsAction: (count: number) => t("dashboard.needsAction", { count }),
    },
    nav: {
      dashboard: t("nav.dashboard"),
      clients: t("nav.clients"),
      staff: t("nav.staff"),
      settings: t("nav.settings"),
      audit: t("nav.audit"),
      integrations: t("nav.integrations"),
      calendar: t("nav.calendar"),
      appointments: t("nav.appointments"),
      orders: t("nav.orders"),
      services: t("nav.services"),
      technologies: t("nav.technologies"),
      content: t("nav.content"),
      products: t("nav.products"),
      pricing: t("nav.pricing"),
      blog: t("nav.blog"),
      chat: t("nav.chat"),
    },
    modules: {
      clients: t("modules.clients"),
      staff: t("modules.staff"),
      settings: t("modules.settings"),
      audit: t("modules.audit"),
      integrations: t("modules.integrations"),
      calendar: t("modules.calendar"),
      appointments: t("modules.appointments"),
      orders: t("modules.orders"),
      services: t("modules.services"),
      technologies: t("modules.technologies"),
      content: t("modules.content"),
      products: t("modules.products"),
      pricing: t("modules.pricing"),
      blog: t("modules.blog"),
      chat: t("modules.chat"),
    },
    common: {
      new: t("common.new"),
      save: t("common.save"),
      saving: t("common.saving"),
      delete: t("common.delete"),
      archive: t("common.archive"),
      restore: t("common.restore"),
      edit: t("common.edit"),
      search: t("common.search"),
      empty: t("common.empty"),
      actions: t("common.actions"),
      status: t("common.status"),
      draft: t("common.draft"),
      published: t("common.published"),
      archived: t("common.archived"),
      global: t("common.global"),
      locales: t("common.locales"),
      slug: t("common.slug"),
      publicPath: t("common.publicPath"),
      order: t("common.order"),
      images: t("common.images"),
      price: t("common.price"),
      category: t("common.category"),
      title: t("common.title"),
      body: t("common.body"),
      summary: t("common.summary"),
      seoTitle: t("common.seoTitle"),
      seoDescription: t("common.seoDescription"),
      seoIndexable: t("common.seoIndexable"),
      imageAlt: t("common.imageAlt"),
      label: t("common.label"),
      unit: t("common.unit"),
      preview: t("common.preview"),
      back: t("common.back"),
      confirmDelete: t("common.confirmDelete"),
      required: t("common.required"),
      updated: t("common.updated"),
      notProvided: t("common.notProvided"),
    },
  };
}

function queryString(params: SearchParams) {
  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    for (const value of Array.isArray(raw) ? raw : raw ? [raw] : [])
      query.append(key, value);
  }
  const string = query.toString();
  return string ? `?${string}` : "";
}

function moduleFromSegment(segment?: string): AdminModule | undefined {
  return (Object.entries(ADMIN_SEGMENTS).find(
    ([, value]) => value === segment,
  )?.[0] ?? (segment === undefined ? "dashboard" : undefined)) as
    AdminModule | undefined;
}

export async function AdminRouter({
  locale,
  segments,
  searchParams,
}: {
  locale: Locale;
  segments: string[];
  searchParams: SearchParams;
}) {
  const t = await getTranslations({ locale, namespace: "Admin" });
  const copy = makeCopy(t);
  const mediaMessages = t.raw("media");
  const [first, ...rest] = segments;
  const legacy = first ? LEGACY_ADMIN_SEGMENTS[first] : undefined;
  if (legacy) {
    const translatedRest = rest.map(
      (segment) => LEGACY_ADMIN_SEGMENTS[segment] ?? segment,
    );
    permanentRedirect(
      `${adminBase(locale)}/${[legacy, ...translatedRest].join("/")}${queryString(searchParams)}`,
    );
  }

  if (first === ADMIN_SEGMENTS.login)
    return <Login locale={locale} copy={copy} searchParams={searchParams} />;
  if (first === "ulos") notFound();

  const user = await currentUser("backoffice");
  if (!user) redirect(adminHref(locale, "login"));
  if (!isBackofficeRole(user.role)) redirect(adminHref(locale, "login"));
  if (user.role === "STAFF" && user.mustChangePassword)
    redirect(staffHref(locale, "password"));

  const adminModule = moduleFromSegment(first);
  if (!adminModule || adminModule === "login") notFound();
  if (
    user.role === "STAFF" &&
    (adminModule === "audit" || adminModule === "integrations")
  )
    notFound();
  if (adminModule === "settings" && user.role !== "STAFF") notFound();
  const content = await renderModule({
    adminModule,
    id: adminRecordId(adminModule, rest),
    locale,
    copy,
    searchParams,
    viewerRole: user.role,
  });

  const feedback = searchParams.error
    ? copy.common.required
    : searchParams.saved
      ? copy.common.updated
      : null;
  const initialSidebarCollapsed = isAdminSidebarCollapsed(
    (await cookies()).get(ADMIN_SIDEBAR_COOKIE)?.value,
  );
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{ Admin: { media: mediaMessages } }}
    >
      <AdminShell
        locale={locale}
        labels={{
          appName: copy.appName,
          menu: copy.menu,
          close: copy.close,
          expandSidebar: copy.expandSidebar,
          collapseSidebar: copy.collapseSidebar,
          logout: copy.logout,
          locale: copy.locale,
          nav: copy.nav,
        }}
        user={user}
        role={user.role as "ADMIN" | "STAFF"}
        initialCollapsed={initialSidebarCollapsed}
        wide={adminModule === "calendar"}
        overlaySidebar={adminModule === "calendar"}
      >
        {feedback ? (
          <p
            role="status"
            className="mb-4.5 rounded-[5px] border border-line-btn bg-btn-fill px-3.5 py-2.75 font-sans text-[14px] text-ink"
          >
            {feedback}
          </p>
        ) : null}
        {content}
      </AdminShell>
    </NextIntlClientProvider>
  );
}

async function Login({
  locale,
  copy,
  searchParams,
}: {
  locale: Locale;
  copy: Copy;
  searchParams: SearchParams;
}) {
  const user = await currentUser("backoffice");
  if (user) {
    const destination = sharedLoginDestination(locale, user);
    if (destination) redirect(destination);
  }
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <form
        action={adminLoginAction}
        className="w-full max-w-105 rounded-(--radius) border border-line-card bg-card p-[clamp(22px,4vw,36px)] shadow-card"
      >
        <input type="hidden" name="locale" value={locale} />
        <div className="font-sans text-meta tracking-[.16em] text-muted uppercase">
          {copy.login.eyebrow}
        </div>
        <h1 className="mt-2.5 font-display text-[clamp(34px,5vw,48px)] leading-[1.05] font-medium">
          {copy.login.title}
        </h1>
        {searchParams.error ? (
          <p
            role="alert"
            className="mt-4.5 rounded-[4px] border border-line-btn bg-btn-fill px-3 py-2.5 font-sans text-[14px]"
          >
            {copy.login.invalid}
          </p>
        ) : null}
        <Field label={copy.login.email}>
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            className={inputCls}
          />
        </Field>
        <Field label={copy.login.password}>
          <AdminPasswordField
            name="password"
            autoComplete="current-password"
            className={inputCls}
            showLabel={copy.login.showPassword}
            hideLabel={copy.login.hidePassword}
          />
        </Field>
        <button className={`${primaryButton} mt-6 w-full`}>
          {copy.login.submit}
        </button>
      </form>
    </main>
  );
}

async function renderModule({
  adminModule,
  id,
  locale,
  copy,
  searchParams,
  viewerRole,
}: {
  adminModule: AdminModule;
  id?: string;
  locale: Locale;
  copy: Copy;
  searchParams: SearchParams;
  viewerRole: "ADMIN" | "STAFF";
}) {
  if (adminModule === "dashboard")
    return <Dashboard locale={locale} copy={copy} />;
  if (adminModule === "clients")
    return (
      <Clients
        locale={locale}
        id={id}
        copy={copy}
        searchParams={searchParams}
      />
    );
  if (adminModule === "staff")
    return (
      <StaffAccounts
        locale={locale}
        id={id}
        canViewAudit={viewerRole === "ADMIN"}
      />
    );
  if (adminModule === "settings") {
    if (id || viewerRole !== "STAFF") notFound();
    return (
      <EmployeeConfiguration
        locale={locale}
        endpoint="/api/staff/configuration"
        loginHref={adminHref(locale, "login")}
      />
    );
  }
  if (adminModule === "audit")
    return <AuditLogs locale={locale} searchParams={searchParams} />;
  if (adminModule === "integrations")
    return <IntegrationLogs locale={locale} searchParams={searchParams} />;
  if (adminModule === "calendar") {
    const calendarHref = adminHref(locale, "calendar");
    if (id === "asetukset")
      return <CalendarSetup locale={locale} calendarHref={calendarHref} />;
    if (id) notFound();
    return (
      <SharedCalendar locale={locale} setupHref={`${calendarHref}/asetukset`} />
    );
  }
  if (adminModule === "appointments")
    return (
      <>
        {!id ? <ChangeRequestQueue locale={locale} /> : null}
        <AppointmentsAdmin
          locale={locale}
          id={id}
          searchParams={searchParams}
        />
      </>
    );
  if (adminModule === "orders")
    return <OrdersAdmin locale={locale} id={id} searchParams={searchParams} />;
  if (adminModule === "services")
    return <Services locale={locale} id={id} copy={copy} />;
  if (adminModule === "technologies")
    return <Technologies locale={locale} id={id} copy={copy} />;
  if (adminModule === "content")
    return <ContentPages locale={locale} id={id} copy={copy} />;
  if (adminModule === "products")
    return <Products locale={locale} id={id} copy={copy} />;
  if (adminModule === "pricing")
    return <Pricing locale={locale} id={id} copy={copy} />;
  if (adminModule === "blog")
    return <Articles locale={locale} id={id} copy={copy} />;
  if (adminModule === "chat") return <Chats locale={locale} id={id} />;
  notFound();
}

async function Dashboard({ locale, copy }: { locale: Locale; copy: Copy }) {
  const [
    clients,
    appointments,
    orders,
    appointmentsNeedingAction,
    ordersNeedingAction,
    services,
    technologies,
    products,
    articles,
    handoffs,
    recentActivity,
  ] = await Promise.all([
    prisma.client.count({ where: { archivedAt: null } }),
    prisma.appointment.count(),
    prisma.order.count(),
    prisma.appointment.count({
      where: { status: { in: ["BOOKED", "RESCHEDULED"] } },
    }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.service.count({ where: { archivedAt: null } }),
    prisma.technology.count({ where: { archivedAt: null } }),
    prisma.product.count({ where: { archivedAt: null } }),
    prisma.article.count({ where: { archivedAt: null } }),
    prisma.chatSession.count({
      where: { handoffRequested: true, status: "OPEN", archivedAt: null },
    }),
    getRecentBusinessActivity(locale),
  ]);
  const counts = {
    clients,
    appointments,
    orders,
    services,
    technologies,
    products,
    articles,
    handoffs,
  };
  const cards: Array<{
    key: keyof typeof counts;
    module: Exclude<AdminModule, "login" | "dashboard"> | "dashboard";
    needsAction?: number;
  }> = [
    { key: "clients", module: "clients" },
    {
      key: "appointments",
      module: "appointments",
      needsAction: appointmentsNeedingAction,
    },
    { key: "orders", module: "orders", needsAction: ordersNeedingAction },
    { key: "services", module: "services" },
    { key: "technologies", module: "technologies" },
    { key: "products", module: "products" },
    { key: "articles", module: "blog" },
    { key: "handoffs", module: "chat" },
  ];
  return (
    <div>
      <PageHeader
        title={copy.dashboard.title}
        description={copy.dashboard.subtitle}
      />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.key}
            href={adminHref(locale, card.module)}
            className={cardCls}
          >
            <span className="font-sans text-meta tracking-widest text-muted uppercase">
              {
                copy.nav[
                  card.module === "dashboard" ? "dashboard" : card.module
                ]
              }
            </span>
            <strong className="mt-2.5 block font-display text-[36px] font-medium">
              {counts[card.key]}
            </strong>
            {card.needsAction ? (
              <span className="mt-1.25 block font-sans text-meta text-muted">
                {copy.dashboard.needsAction(card.needsAction)}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
      <div className="mt-6">
        <section className={panelCls}>
          <h2 className={sectionTitle}>{copy.dashboard.quick}</h2>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {(
              [
                "services",
                "technologies",
                "content",
                "products",
                "pricing",
                "blog",
              ] as AdminModule[]
            ).map((module) => (
              <Link
                key={module}
                href={adminHref(locale, module, "uusi")}
                className={secondaryButton}
              >
                {copy.common.new} {copy.nav[module as keyof typeof copy.nav]}
              </Link>
            ))}
          </div>
        </section>
      </div>
      <section className={`${panelCls} mt-5`}>
        <h2 className={sectionTitle}>{copy.dashboard.recent}</h2>
        {recentActivity.length ? (
          <ul className="divide-line border-line mt-3 divide-y border-y">
            {recentActivity.map((entry) => {
              const content = (
                <div className="grid gap-2 px-2 py-3.5 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                  <span className="font-sans text-meta tracking-[.08em] text-muted uppercase">
                    {copy.dashboard.activityCategory(entry.category)}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-sans text-[14px] font-medium text-body">
                      {copy.dashboard.activityAction(entry.action)}
                      {entry.subject ? ` · ${entry.subject}` : ""}
                    </span>
                    {entry.detail ? (
                      <span className="mt-0.75 block truncate font-sans text-label text-muted">
                        {entry.detail}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2.5 sm:justify-end">
                    {entry.status ? (
                      <span className="rounded-full bg-btn-fill px-2.25 py-1 font-sans text-[11px] tracking-[.06em] text-body uppercase">
                        {copy.dashboard.activityStatus(entry.status)}
                      </span>
                    ) : null}
                    <time className="font-sans text-meta whitespace-nowrap text-muted">
                      {formatDate(entry.at, locale)}
                    </time>
                  </span>
                </div>
              );
              return (
                <li key={entry.id}>
                  {entry.href ? (
                    <Link
                      href={entry.href}
                      className="block transition-colors hover:bg-btn-fill focus-visible:bg-btn-fill focus-visible:outline-none"
                    >
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 font-sans text-[14px] text-muted">
            {copy.dashboard.emptyActivity}
          </p>
        )}
      </section>
    </div>
  );
}

async function Clients({
  locale,
  id,
  copy,
  searchParams,
}: {
  locale: Locale;
  id?: string;
  copy: Copy;
  searchParams: SearchParams;
}) {
  const base = adminHref(locale, "clients");
  if (id) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        appointments: {
          include: { service: true },
          orderBy: { start: "desc" },
        },
        orders: { include: { items: true }, orderBy: { createdAt: "desc" } },
        chatSessions: { orderBy: { updatedAt: "desc" } },
        consultationProfile: true,
      },
    });
    if (!client) notFound();
    const consultation = client.consultationProfile
      ? {
          dateOfBirth: decryptSensitiveText(
            client.consultationProfile.dateOfBirthEncrypted,
          ),
          answers: decryptSensitiveJson<
            Array<{
              key: string;
              prompt: string;
              answer: string | string[] | boolean;
            }>
          >(client.consultationProfile.answersEncrypted),
          completedVersion: client.consultationProfile.completedVersion,
        }
      : null;
    const viewer = await currentUser("backoffice");
    if (consultation && viewer)
      await auditForUser(
        viewer,
        "consultation_profile_viewed",
        "ConsultationProfile",
        client.consultationProfile!.id,
      );
    return (
      <div>
        <Back href={base} label={copy.common.back} />
        <PageHeader
          title={client.fullName}
          description={`${client.email} · ${client.phone}`}
        />
        <section className={`${panelCls} mt-5.5`}>
          <AdminForm action={saveClientAction}>
            <input type="hidden" name="id" value={client.id} />
            <input
              type="hidden"
              name="returnTo"
              value={`${base}/${client.id}`}
            />
            <div className={`${alignedFieldGrid} md:grid-cols-3`}>
              <Field label="Name">
                <input
                  name="fullName"
                  required
                  defaultValue={client.fullName}
                  className={inputCls}
                />
              </Field>
              <Field label="Email">
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={client.email}
                  className={inputCls}
                />
              </Field>
              <Field label="Phone">
                <input
                  name="phone"
                  required
                  defaultValue={client.phone}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className={`${alignedFieldGrid} mt-3.5 lg:grid-cols-2`}>
              <Field label="Notes">
                <textarea
                  name="notes"
                  rows={5}
                  defaultValue={client.notes ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label="Contraindications">
                <textarea
                  name="contraindications"
                  rows={5}
                  defaultValue={client.contraindications ?? ""}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="mt-4.5 flex flex-col gap-3 border-t border-line-hair pt-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Check
                  name="consentMarketing"
                  label="Marketing consent"
                  checked={client.consentMarketing}
                />
                <Check
                  name="archived"
                  label={copy.common.archived}
                  checked={Boolean(client.archivedAt)}
                />
              </div>
              <div className="flex flex-wrap gap-2.5 lg:justify-end">
                <PendingSaveButton
                  saveLabel={copy.common.save}
                  savingLabel={copy.common.saving}
                  className={primaryButton}
                />
                <a
                  href={`/api/admin/clients/${client.id}/export`}
                  className={secondaryButton}
                >
                  GDPR export
                </a>
              </div>
            </div>
          </AdminForm>
          <form
            action={anonymizeClientAction}
            className="mt-4 flex justify-end border-t border-line-hair pt-4"
          >
            <input type="hidden" name="id" value={client.id} />
            <input
              type="hidden"
              name="returnTo"
              value={`${base}/${client.id}`}
            />
            <button className={dangerButton}>GDPR anonymize</button>
          </form>
        </section>
        <section className={`${panelCls} mt-5.5`}>
          <h2 className="font-display text-[24px] font-medium text-ink">
            Consultation information
          </h2>
          {consultation ? (
            <dl className="mt-4 grid gap-3 font-sans text-sm text-body">
              <div>
                <dt className="text-muted">Date of birth</dt>
                <dd className="font-medium text-ink">
                  {consultation.dateOfBirth}
                </dd>
              </div>
              {consultation.answers.map((item) => (
                <div key={item.key}>
                  <dt className="text-muted">{item.prompt || item.key}</dt>
                  <dd className="font-medium text-ink">
                    {Array.isArray(item.answer)
                      ? item.answer.join(", ")
                      : typeof item.answer === "boolean"
                        ? item.answer
                          ? "Yes"
                          : "No"
                        : item.answer}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 font-sans text-sm text-muted">
              No consultation profile.
            </p>
          )}
        </section>
        <History title="Appointments" empty={copy.common.empty}>
          {client.appointments.map((item) => (
            <Link
              href={adminHref(locale, "appointments", item.id)}
              key={item.id}
              className={appointmentHistoryRow}
            >
              <span className="whitespace-nowrap">
                {formatDate(item.start, locale)}
              </span>
              <strong className="min-w-0 truncate">
                {item.procedureTitle ?? item.service.slug}
                {item.procedurePrice ? ` · ${item.procedurePrice}` : ""}
              </strong>
              <span className="whitespace-nowrap sm:justify-self-end">
                {item.status}
              </span>
            </Link>
          ))}
        </History>
        <History title="Orders" empty={copy.common.empty}>
          {client.orders.map((item) => (
            <Link
              href={adminHref(locale, "orders", item.id)}
              key={item.id}
              className={historyRow}
            >
              <span className="whitespace-nowrap">
                {formatDate(item.createdAt, locale)}
              </span>
              <strong className="min-w-0 truncate">
                {item.items.map((line) => line.name).join(", ")}
              </strong>
              <span className="whitespace-nowrap sm:justify-self-end">
                {Number(item.total).toFixed(2)} {item.currency}
              </span>
              <span className="whitespace-nowrap sm:justify-self-end">
                {item.status}
              </span>
            </Link>
          ))}
        </History>
      </div>
    );
  }
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const clients = await prisma.client.findMany({
    where: q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div>
      <PageHeader title={copy.modules.clients} />
      <div className="mt-5">
        <ConsultationFormAdmin locale={locale} />
      </div>
      <form className="mt-4.5 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder={copy.common.search}
          className={`${inputCls} max-w-105`}
        />
        <button className={secondaryButton}>{copy.common.search}</button>
      </form>
      <RecordList empty={copy.common.empty}>
        {clients.map((client) => (
          <Link
            key={client.id}
            href={`${base}/${client.id}`}
            className={recordRow}
          >
            <span className="min-w-0">
              <strong className="block text-compact leading-[1.35]">
                {client.fullName}
              </strong>
              <small className="mt-1.25 flex flex-wrap gap-x-3 gap-y-0.75 text-label leading-[1.45] text-muted">
                <span className="break-all">{client.email}</span>
                <span className="whitespace-nowrap">{client.phone}</span>
              </small>
            </span>
            <Status archived={Boolean(client.archivedAt)} copy={copy} />
          </Link>
        ))}
      </RecordList>
    </div>
  );
}

async function Services({
  locale,
  id,
  copy,
}: {
  locale: Locale;
  id?: string;
  copy: Copy;
}) {
  const base = adminHref(locale, "services");
  if (id) {
    const row =
      id === "uusi"
        ? null
        : await prisma.service.findUnique({
            where: { id },
            include: {
              contents: true,
              options: { include: { contents: true } },
            },
          });
    if (id !== "uusi" && !row) notFound();
    return (
      <EntityForm
        title={row?.slug ?? `${copy.common.new} ${copy.modules.services}`}
        base={base}
        save={saveServiceAction}
        remove={row ? removeServiceAction : undefined}
        id={row?.id}
        copy={copy}
      >
        <ServiceEditor row={row} copy={copy} />
      </EntityForm>
    );
  }
  const rows = await prisma.service.findMany({
    include: { contents: true },
    orderBy: [{ order: "asc" }, { slug: "asc" }],
  });
  return (
    <Collection title={copy.modules.services} base={base} copy={copy}>
      {rows.map((row) => (
        <EntityLink
          key={row.id}
          href={`${base}/${row.id}`}
          title={localizedName(row.contents, locale, "h1") || row.slug}
          subtitle={row.publicPath || row.slug}
          archived={Boolean(row.archivedAt)}
          copy={copy}
        />
      ))}
    </Collection>
  );
}

function ServiceEditor({ row, copy }: { row: ServiceRow | null; copy: Copy }) {
  const byLocale = new Map(row?.contents.map((item) => [item.locale, item]));
  const inlineByLocale = new Map(
    locales.map((locale) => [
      locale,
      markdownImages(byLocale.get(locale)?.whatItIs),
    ]),
  );
  return (
    <>
      <EditorSection title={copy.common.global}>
        <div className={globalGrid}>
          <Field label={copy.common.slug}>
            <input
              name="slug"
              required
              defaultValue={row?.slug ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label={copy.common.publicPath}>
            <input
              name="publicPath"
              required
              defaultValue={row?.publicPath ?? ""}
              placeholder="/palvelut/..."
              className={inputCls}
            />
          </Field>
          <Field label={copy.common.category}>
            <ThemedSelect
              name="category"
              defaultValue={row?.category ?? "FACE"}
              options={[
                "FACE",
                "BODY",
                "HAIR",
                "INJECTABLE",
                "DEVICE",
                "LASER",
                "CONSULTATION",
              ].map((item) => ({ value: item, label: item }))}
            />
          </Field>
          <Field label="Duration (min)">
            <input
              name="durationMin"
              type="number"
              min="5"
              defaultValue={row?.durationMin ?? 60}
              className={inputCls}
            />
          </Field>
          <Field label="Target audience">
            <ThemedSelect
              name="targetGender"
              defaultValue={row?.targetGender ?? "BOTH"}
              options={[
                { value: "BOTH", label: "Women & men" },
                { value: "WOMEN", label: "Women only" },
                { value: "MEN", label: "Men only" },
              ]}
            />
          </Field>
          <div
            className={`${alignedFieldGrid} grid-cols-[minmax(0,1fr)_120px] gap-x-2.5`}
          >
            <Field label="Price">
              <input
                name="priceFrom"
                type="number"
                step="0.01"
                defaultValue={row?.priceFrom ? Number(row.priceFrom) : ""}
                className={inputCls}
              />
            </Field>
            <Field label="Price mode">
              <ThemedSelect
                name="priceMode"
                defaultValue={row?.priceMode ?? "FROM"}
                options={[
                  { value: "FROM", label: "From" },
                  { value: "FIXED", label: "Fixed" },
                ]}
              />
            </Field>
          </div>
          <Field label={copy.common.order}>
            <input
              name="order"
              type="number"
              defaultValue={row?.order ?? 0}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="mt-3.5">
          <MediaField
            name="images"
            label={copy.common.images}
            defaultValue={row?.images[0] ?? ""}
            focalXName="imageFocalX"
            focalYName="imageFocalY"
            defaultFocalX={row?.imageFocalX}
            defaultFocalY={row?.imageFocalY}
          />
        </div>
        <div className="mt-3 flex gap-4.5">
          <Check
            name="bookable"
            label="Bookable"
            checked={row?.bookable ?? true}
          />
          <Check
            name="archived"
            label={copy.common.archived}
            checked={Boolean(row?.archivedAt)}
          />
        </div>
      </EditorSection>
      <InlineMarkdownMediaEditor
        byLocale={inlineByLocale}
        label="Service content image"
      />
      {row?.options.length ? (
        <EditorSection title="Treatment options">
          <div className="grid gap-4">
            {row.options.map((option) => {
              const optionContent = new Map(
                option.contents.map((item) => [item.locale, item]),
              );
              const optionInline = new Map(
                locales.map((locale) => [
                  locale,
                  markdownImages(optionContent.get(locale)?.description),
                ]),
              );
              return (
                <div
                  key={option.id}
                  className="rounded-lg border border-line-card bg-page p-4"
                >
                  <input
                    type="hidden"
                    name="serviceOptionId"
                    value={option.id}
                  />
                  <p className="mb-3 font-mono text-meta text-muted">
                    {option.key}
                  </p>
                  <MediaField
                    name={`optionImage_${option.id}`}
                    label="Treatment image"
                    defaultValue={option.image ?? ""}
                    required={option.published && !option.archivedAt}
                    focalXName={`optionImageFocalX_${option.id}`}
                    focalYName={`optionImageFocalY_${option.id}`}
                    defaultFocalX={option.imageFocalX}
                    defaultFocalY={option.imageFocalY}
                  />
                  <div className={`${alignedFieldGrid} mt-3 md:grid-cols-3`}>
                    <Field label="Type">
                      <ThemedSelect
                        name={`optionType_${option.id}`}
                        defaultValue={option.type}
                        options={[
                          { value: "APPOINTMENT", label: "Appointment" },
                          { value: "COURSE", label: "Course (first visit)" },
                          {
                            value: "INFORMATIONAL_PACKAGE",
                            label: "Informational package",
                          },
                        ]}
                      />
                    </Field>
                    <Field label="Booking duration (min)">
                      <input
                        name={`optionDuration_${option.id}`}
                        type="number"
                        min="5"
                        defaultValue={option.bookingDurationMin ?? ""}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Order">
                      <input
                        name={`optionOrder_${option.id}`}
                        type="number"
                        defaultValue={option.displayOrder}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4">
                    <span className="flex min-h-11 items-center font-sans text-[14px] text-body">
                      Appointment and course types are bookable; legacy
                      informational types are not.
                    </span>
                    <Check
                      name={`optionPublished_${option.id}`}
                      label="Published"
                      checked={option.published}
                    />
                    <Check
                      name={`optionArchived_${option.id}`}
                      label="Archived"
                      checked={Boolean(option.archivedAt)}
                    />
                  </div>
                  <div className="mt-4 grid gap-4 xl:grid-cols-3">
                    {locales.map((locale) => {
                      const content = optionContent.get(locale);
                      return (
                        <div
                          key={locale}
                          className="rounded-md border border-line-hair p-3"
                        >
                          <p className="mb-2 font-medium uppercase">{locale}</p>
                          <Field label="Name">
                            <input
                              name={`optionName_${option.id}_${locale}`}
                              defaultValue={content?.name ?? ""}
                              className={inputCls}
                            />
                          </Field>
                          <Field label="Group">
                            <input
                              name={`optionGroup_${option.id}_${locale}`}
                              defaultValue={content?.group ?? ""}
                              className={inputCls}
                            />
                          </Field>
                          <Field label="Published duration">
                            <input
                              name={`optionDurationLabel_${option.id}_${locale}`}
                              defaultValue={content?.durationLabel ?? ""}
                              className={inputCls}
                            />
                          </Field>
                          <Field label="Published price">
                            <input
                              name={`optionPrice_${option.id}_${locale}`}
                              defaultValue={content?.priceLabel ?? ""}
                              className={inputCls}
                            />
                          </Field>
                          <Field label="Card summary">
                            <textarea
                              name={`optionSummary_${option.id}_${locale}`}
                              rows={4}
                              defaultValue={content?.summary ?? ""}
                              className={inputCls}
                            />
                          </Field>
                          <Field label="Full treatment description (Markdown)">
                            <textarea
                              name={`optionDescription_${option.id}_${locale}`}
                              rows={12}
                              defaultValue={content?.description ?? ""}
                              className={inputCls}
                            />
                          </Field>
                          <Field label={copy.common.imageAlt}>
                            <input
                              name={`optionImageAlt_${option.id}_${locale}`}
                              defaultValue={
                                content?.imageAlt ?? content?.name ?? ""
                              }
                              className={inputCls}
                            />
                          </Field>
                          <Field label="Source URL or approved document">
                            <input
                              name={`optionSourceUrl_${option.id}_${locale}`}
                              defaultValue={content?.sourceUrl ?? ""}
                              className={inputCls}
                            />
                          </Field>
                          <Field label="Source date">
                            <input
                              name={`optionSourceDate_${option.id}_${locale}`}
                              type="text"
                              inputMode="numeric"
                              pattern="\d{4}-\d{2}-\d{2}"
                              placeholder="YYYY-MM-DD"
                              defaultValue={
                                content?.sourceScrapedAt
                                  ?.toISOString()
                                  .slice(0, 10) ?? ""
                              }
                              className={inputCls}
                            />
                          </Field>
                        </div>
                      );
                    })}
                  </div>
                  <InlineMarkdownMediaEditor
                    byLocale={optionInline}
                    label="Treatment description image"
                    prefix={`optionBodyImage_${option.id}`}
                  />
                </div>
              );
            })}
          </div>
        </EditorSection>
      ) : null}
      <LocaleEditors title={copy.common.locales}>
        {locales.map((locale) => {
          const item = byLocale.get(locale);
          return (
            <LocaleCard
              key={locale}
              locale={locale}
              status={item?.status}
              copy={copy}
            >
              <Field label={copy.common.title}>
                <input
                  name={`h1_${locale}`}
                  defaultValue={item?.h1 ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label={copy.common.summary}>
                <textarea
                  name={`shortDesc_${locale}`}
                  rows={3}
                  defaultValue={item?.shortDesc ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label={copy.common.body}>
                <textarea
                  name={`body_${locale}`}
                  rows={8}
                  defaultValue={item?.whatItIs ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label="Suitable for (one per line)">
                <textarea
                  name={`suitableFor_${locale}`}
                  rows={4}
                  defaultValue={item?.suitableFor.join("\n") ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label="Benefits (one per line)">
                <textarea
                  name={`benefits_${locale}`}
                  rows={4}
                  defaultValue={item?.benefits.join("\n") ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label="Process steps (one per line)">
                <textarea
                  name={`processSteps_${locale}`}
                  rows={4}
                  defaultValue={item?.processSteps.join("\n") ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label="Expected results">
                <textarea
                  name={`results_${locale}`}
                  rows={4}
                  defaultValue={item?.results ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label="Recommended sessions">
                <textarea
                  name={`sessions_${locale}`}
                  rows={3}
                  defaultValue={item?.sessions ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label="Safety">
                <textarea
                  name={`safety_${locale}`}
                  rows={4}
                  defaultValue={item?.safety ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label="Contraindications (one per line)">
                <textarea
                  name={`contraindications_${locale}`}
                  rows={4}
                  defaultValue={item?.contraindications.join("\n") ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label="Preparation">
                <textarea
                  name={`preCare_${locale}`}
                  rows={3}
                  defaultValue={item?.preCare ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label="Aftercare">
                <textarea
                  name={`postCare_${locale}`}
                  rows={3}
                  defaultValue={item?.postCare ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label="FAQ JSON">
                <textarea
                  name={`faq_${locale}`}
                  rows={5}
                  defaultValue={JSON.stringify(item?.faq ?? [], null, 2)}
                  className={inputCls}
                />
              </Field>
              <SeoFields locale={locale} data={item} copy={copy} />
            </LocaleCard>
          );
        })}
      </LocaleEditors>
    </>
  );
}

async function Technologies({
  locale,
  id,
  copy,
}: {
  locale: Locale;
  id?: string;
  copy: Copy;
}) {
  const base = adminHref(locale, "technologies");
  if (id) {
    const [row, services] = await Promise.all([
      id === "uusi"
        ? null
        : prisma.technology.findUnique({
            where: { id },
            include: { contents: true },
          }),
      prisma.service.findMany({
        where: { archivedAt: null },
        orderBy: { slug: "asc" },
        select: { id: true, slug: true },
      }),
    ]);
    if (id !== "uusi" && !row) notFound();
    return (
      <EntityForm
        title={row?.slug ?? `${copy.common.new} ${copy.modules.technologies}`}
        base={base}
        save={saveTechnologyAction}
        remove={row ? removeTechnologyAction : undefined}
        id={row?.id}
        copy={copy}
      >
        <TechnologyEditor row={row} services={services} copy={copy} />
      </EntityForm>
    );
  }
  const rows = await prisma.technology.findMany({
    include: { contents: true },
    orderBy: [{ order: "asc" }, { slug: "asc" }],
  });
  return (
    <Collection title={copy.modules.technologies} base={base} copy={copy}>
      {rows.map((row) => (
        <EntityLink
          key={row.id}
          href={`${base}/${row.id}`}
          title={localizedName(row.contents, locale, "name") || row.slug}
          subtitle={row.publicPath}
          archived={Boolean(row.archivedAt)}
          copy={copy}
        />
      ))}
    </Collection>
  );
}

function TechnologyEditor({
  row,
  services,
  copy,
}: {
  row: TechnologyRow | null;
  services: { id: string; slug: string }[];
  copy: Copy;
}) {
  const byLocale = new Map(row?.contents.map((item) => [item.locale, item]));
  const inlineByLocale = new Map(
    locales.map((locale) => [
      locale,
      markdownImages(byLocale.get(locale)?.body),
    ]),
  );
  return (
    <>
      <EditorSection title={copy.common.global}>
        <div className={globalGrid}>
          <Field label={copy.common.slug}>
            <input
              name="slug"
              required
              defaultValue={row?.slug ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label={copy.common.publicPath}>
            <input
              name="publicPath"
              required
              defaultValue={row?.publicPath ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Booking service">
            <ThemedSelect
              name="relatedServiceId"
              defaultValue={row?.relatedServiceId ?? ""}
              options={[
                { value: "", label: "—" },
                ...services.map((service) => ({
                  value: service.id,
                  label: service.slug,
                })),
              ]}
            />
          </Field>
          <Field label={copy.common.order}>
            <input
              name="order"
              type="number"
              defaultValue={row?.order ?? 0}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="mt-3.5">
          <MediaField
            name="images"
            label={copy.common.images}
            defaultValue={row?.images[0] ?? ""}
            focalXName="imageFocalX"
            focalYName="imageFocalY"
            defaultFocalX={row?.imageFocalX}
            defaultFocalY={row?.imageFocalY}
          />
        </div>
        <div className="mt-3">
          <Check
            name="archived"
            label={copy.common.archived}
            checked={Boolean(row?.archivedAt)}
          />
        </div>
      </EditorSection>
      <InlineMarkdownMediaEditor
        byLocale={inlineByLocale}
        label="Technology content image"
      />
      <LocaleEditors title={copy.common.locales}>
        {locales.map((locale) => {
          const item = byLocale.get(locale);
          return (
            <LocaleCard
              key={locale}
              locale={locale}
              status={item?.status}
              copy={copy}
            >
              <Field label={copy.common.title}>
                <input
                  name={`name_${locale}`}
                  defaultValue={item?.name ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label="Specification">
                <input
                  name={`specification_${locale}`}
                  defaultValue={item?.specification ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label={copy.common.summary}>
                <textarea
                  name={`summary_${locale}`}
                  rows={3}
                  defaultValue={item?.summary ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label={copy.common.body}>
                <textarea
                  name={`body_${locale}`}
                  rows={8}
                  defaultValue={item?.body ?? ""}
                  className={inputCls}
                />
              </Field>
              <SeoFields locale={locale} data={item} copy={copy} />
            </LocaleCard>
          );
        })}
      </LocaleEditors>
    </>
  );
}

async function ContentPages({
  locale,
  id,
  copy,
}: {
  locale: Locale;
  id?: string;
  copy: Copy;
}) {
  const base = adminHref(locale, "content");
  if (id === "media") {
    const slots = await prisma.siteMediaSlot.findMany({
      include: { contents: true },
    });
    const byKey = new Map(slots.map((slot) => [slot.key, slot]));
    return (
      <EntityForm
        title="Public page media"
        base={base}
        save={saveSiteMediaAction}
        copy={copy}
      >
        {SITE_MEDIA_DEFINITIONS.map((definition) => {
          const slot = byKey.get(definition.key);
          const altByLocale = new Map(
            slot?.contents.map((content) => [content.locale, content.alt]),
          );
          return (
            <EditorSection
              key={definition.key}
              title={definition.label[locale]}
            >
              <MediaField
                name={`siteImage_${definition.key}`}
                label={`${definition.label[locale]} · ${definition.aspect}`}
                defaultValue={slot?.image ?? definition.fallback ?? ""}
                required={definition.required}
                focalXName={`siteImageFocalX_${definition.key}`}
                focalYName={`siteImageFocalY_${definition.key}`}
                defaultFocalX={slot?.focalX}
                defaultFocalY={slot?.focalY}
              />
              {!definition.decorative ? (
                <div className={`${alignedFieldGrid} mt-4 md:grid-cols-3`}>
                  {locales.map((itemLocale) => (
                    <Field
                      key={itemLocale}
                      label={`${copy.common.imageAlt} · ${itemLocale}`}
                    >
                      <input
                        name={`siteImageAlt_${definition.key}_${itemLocale}`}
                        defaultValue={
                          altByLocale.get(itemLocale) ??
                          definition.alt[itemLocale]
                        }
                        className={inputCls}
                      />
                    </Field>
                  ))}
                </div>
              ) : (
                <p className="mt-3 font-sans text-label text-muted">
                  Decorative image · empty alternative text
                </p>
              )}
            </EditorSection>
          );
        })}
      </EntityForm>
    );
  }
  if (id) {
    const slug = id === "uusi" ? "" : id;
    const rows = slug
      ? await prisma.contentPage.findMany({ where: { slug } })
      : [];
    if (slug && !rows.length) notFound();
    const byLocale = new Map(rows.map((row) => [row.locale, row]));
    const shared =
      rows.find((row) => row.locale === "fi") ??
      rows.find((row) => row.locale === "en") ??
      rows[0];
    const inlineByLocale = new Map(
      locales.map((itemLocale) => [
        itemLocale,
        markdownImages(byLocale.get(itemLocale)?.body),
      ]),
    );
    const inlineCount = Math.max(
      0,
      ...locales.map(
        (itemLocale) => inlineByLocale.get(itemLocale)?.length ?? 0,
      ),
    );
    return (
      <EntityForm
        title={slug || `${copy.common.new} ${copy.modules.content}`}
        base={base}
        save={saveContentPageAction}
        remove={slug ? removeContentPageAction : undefined}
        id={slug || undefined}
        removeIdName="slug"
        removeIdValue={slug}
        copy={copy}
      >
        <input type="hidden" name="originalSlug" value={slug} />
        <EditorSection title={copy.common.global}>
          <Field label={copy.common.slug}>
            <input
              name="slug"
              required
              defaultValue={slug}
              className={inputCls}
            />
          </Field>
          <div className="mt-3.5">
            <MediaField
              name="hero"
              label="Shared hero image"
              defaultValue={shared?.hero ?? ""}
              required={false}
              focalXName="heroFocalX"
              focalYName="heroFocalY"
              defaultFocalX={shared?.heroFocalX}
              defaultFocalY={shared?.heroFocalY}
            />
          </div>
        </EditorSection>
        {inlineCount ? (
          <EditorSection title="Inline content images">
            <div className="grid gap-6">
              {Array.from({ length: inlineCount }, (_, index) => {
                const sharedImage = locales
                  .map(
                    (itemLocale) =>
                      inlineByLocale.get(itemLocale)?.[index]?.image,
                  )
                  .find(Boolean);
                return (
                  <div
                    key={index}
                    className="rounded-md border border-line-hair p-3"
                  >
                    <MediaField
                      name={`bodyImage_${index}`}
                      label={`Body image ${index + 1}`}
                      defaultValue={sharedImage ?? ""}
                      required={false}
                    />
                    <div className={`${alignedFieldGrid} mt-3 md:grid-cols-3`}>
                      {locales.map((itemLocale) => (
                        <Field
                          key={itemLocale}
                          label={`${copy.common.imageAlt} · ${itemLocale}`}
                        >
                          <input
                            name={`bodyImageAlt_${index}_${itemLocale}`}
                            defaultValue={
                              inlineByLocale.get(itemLocale)?.[index]?.alt ?? ""
                            }
                            required={Boolean(
                              inlineByLocale.get(itemLocale)?.[index]?.image,
                            )}
                            className={inputCls}
                          />
                        </Field>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </EditorSection>
        ) : null}
        <LocaleEditors title={copy.common.locales}>
          {locales.map((itemLocale) => {
            const row = byLocale.get(itemLocale);
            return (
              <LocaleCard
                key={itemLocale}
                locale={itemLocale}
                status={row?.status}
                copy={copy}
              >
                <Field label={copy.common.title}>
                  <input
                    name={`title_${itemLocale}`}
                    defaultValue={row?.title ?? ""}
                    className={inputCls}
                  />
                </Field>
                <Field label={copy.common.imageAlt}>
                  <input
                    name={`imageAlt_${itemLocale}`}
                    defaultValue={row?.imageAlt ?? row?.title ?? ""}
                    className={inputCls}
                  />
                </Field>
                <Field label={copy.common.body}>
                  <textarea
                    name={`body_${itemLocale}`}
                    rows={12}
                    defaultValue={row?.body ?? ""}
                    className={inputCls}
                  />
                </Field>
                <SeoFields locale={itemLocale} data={row} copy={copy} noAlt />
              </LocaleCard>
            );
          })}
        </LocaleEditors>
      </EntityForm>
    );
  }
  const rows = await prisma.contentPage.findMany({
    orderBy: [{ slug: "asc" }, { locale: "asc" }],
  });
  const groups = groupBy(rows, (row) => row.slug);
  return (
    <Collection title={copy.modules.content} base={base} copy={copy}>
      <EntityLink
        href={adminHref(locale, "content", "media")}
        title="Public page media"
        subtitle="Homepage · Booking · Endospheres · Social"
        copy={copy}
      />
      {[...groups].map(([slug, localized]) => (
        <EntityLink
          key={slug}
          href={adminHref(locale, "content", slug)}
          title={localized.find((row) => row.locale === locale)?.title || slug}
          subtitle={`${slug} · ${publishedLocales(localized)}`}
          copy={copy}
        />
      ))}
    </Collection>
  );
}

async function Products({
  locale,
  id,
  copy,
}: {
  locale: Locale;
  id?: string;
  copy: Copy;
}) {
  const base = adminHref(locale, "products");
  if (id) {
    const services = await prisma.service.findMany({
      where: { archivedAt: null },
      select: { id: true, slug: true },
      orderBy: { slug: "asc" },
    });
    const row =
      id === "uusi"
        ? null
        : await prisma.product.findUnique({
            where: { id },
            include: { contents: true },
          });
    if (id !== "uusi" && !row) notFound();
    return (
      <EntityForm
        title={row?.slug ?? `${copy.common.new} ${copy.modules.products}`}
        base={base}
        save={saveProductAction}
        remove={row ? removeProductAction : undefined}
        id={row?.id}
        copy={copy}
      >
        <ProductEditor row={row} services={services} copy={copy} />
      </EntityForm>
    );
  }
  const rows = await prisma.product.findMany({
    include: { contents: true },
    orderBy: [{ order: "asc" }, { slug: "asc" }],
  });
  return (
    <Collection title={copy.modules.products} base={base} copy={copy}>
      {rows.map((row) => (
        <EntityLink
          key={row.id}
          href={`${base}/${row.id}`}
          title={localizedName(row.contents, locale, "name") || row.slug}
          subtitle={`${Number(row.price).toFixed(2)} ${row.currency}`}
          archived={Boolean(row.archivedAt)}
          copy={copy}
        />
      ))}
    </Collection>
  );
}

function ProductEditor({
  row,
  services,
  copy,
}: {
  row: ProductRow | null;
  services: Array<{ id: string; slug: string }>;
  copy: Copy;
}) {
  const byLocale = new Map(row?.contents.map((item) => [item.locale, item]));
  const inlineByLocale = new Map(
    locales.map((locale) => [
      locale,
      markdownImages(byLocale.get(locale)?.description),
    ]),
  );
  return (
    <>
      <EditorSection title={copy.common.global}>
        <div className={globalGrid}>
          <Field label={copy.common.slug}>
            <input
              name="slug"
              required
              defaultValue={row?.slug ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label={copy.common.category}>
            <ThemedSelect
              name="category"
              defaultValue={row?.category ?? "AROSHA_BODY"}
              options={[
                { value: "AROSHA_BODY", label: "AROSHA_BODY" },
                { value: "DIXIDOX_TRICHO", label: "DIXIDOX_TRICHO" },
                { value: "GIFT_CARD", label: "GIFT_CARD" },
                { value: "TREATMENT", label: "TREATMENT" },
                { value: "OTHER", label: "OTHER" },
              ]}
            />
          </Field>
          <Field label="Product kind">
            <ThemedSelect
              name="kind"
              defaultValue={row?.kind ?? "PHYSICAL"}
              options={[
                { value: "PHYSICAL", label: "PHYSICAL" },
                { value: "GIFT_CARD", label: "GIFT_CARD" },
                { value: "TREATMENT_VOUCHER", label: "TREATMENT_VOUCHER" },
              ]}
            />
          </Field>
          <Field label="Linked treatment">
            <ThemedSelect
              name="serviceId"
              defaultValue={row?.serviceId ?? ""}
              options={[
                { value: "", label: "—" },
                ...services.map((service) => ({
                  value: service.id,
                  label: service.slug,
                })),
              ]}
            />
          </Field>
          <Field label="Voucher validity (days)">
            <input
              name="voucherValidityDays"
              type="number"
              min="1"
              max="3650"
              defaultValue={row?.voucherValidityDays ?? 365}
              className={inputCls}
            />
          </Field>
          <Field label={copy.common.price}>
            <input
              name="price"
              required
              type="number"
              min="0"
              step="0.01"
              defaultValue={row ? Number(row.price) : 0}
              className={inputCls}
            />
          </Field>
          <Field label="Currency">
            <input
              name="currency"
              defaultValue={row?.currency ?? "EUR"}
              className={inputCls}
            />
          </Field>
          <Field label="Size">
            <input
              name="size"
              defaultValue={row?.size ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label={copy.common.order}>
            <input
              name="order"
              type="number"
              defaultValue={row?.order ?? 0}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="mt-3.5">
          <MediaField
            name="images"
            label={copy.common.images}
            defaultValue={row?.images[0] ?? ""}
            focalXName="imageFocalX"
            focalYName="imageFocalY"
            defaultFocalX={row?.imageFocalX}
            defaultFocalY={row?.imageFocalY}
          />
        </div>
        <div className="mt-3">
          <Check
            name="archived"
            label={copy.common.archived}
            checked={Boolean(row?.archivedAt)}
          />
        </div>
      </EditorSection>
      <InlineMarkdownMediaEditor
        byLocale={inlineByLocale}
        label="Product description image"
      />
      <LocaleEditors title={copy.common.locales}>
        {locales.map((locale) => {
          const item = byLocale.get(locale);
          return (
            <LocaleCard
              key={locale}
              locale={locale}
              status={item?.status}
              copy={copy}
            >
              <Field label={copy.common.title}>
                <input
                  name={`name_${locale}`}
                  defaultValue={item?.name ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label={copy.common.summary}>
                <textarea
                  name={`shortDescription_${locale}`}
                  rows={3}
                  defaultValue={item?.shortDescription ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label={copy.common.body}>
                <textarea
                  name={`description_${locale}`}
                  rows={8}
                  defaultValue={item?.description ?? ""}
                  className={inputCls}
                />
              </Field>
              <SeoFields locale={locale} data={item} copy={copy} />
            </LocaleCard>
          );
        })}
      </LocaleEditors>
    </>
  );
}

async function Pricing({
  locale,
  id,
  copy,
}: {
  locale: Locale;
  id?: string;
  copy: Copy;
}) {
  const base = adminHref(locale, "pricing");
  if (id) {
    const [row, services] = await Promise.all([
      id === "uusi"
        ? null
        : prisma.pricingItem.findUnique({
            where: { id },
            include: { contents: true },
          }),
      prisma.service.findMany({
        where: { archivedAt: null },
        orderBy: { slug: "asc" },
        select: { id: true, slug: true },
      }),
    ]);
    if (id !== "uusi" && !row) notFound();
    return (
      <EntityForm
        title={
          row
            ? `${copy.common.price} ${Number(row.price).toFixed(2)}`
            : `${copy.common.new} ${copy.modules.pricing}`
        }
        base={base}
        save={savePricingAction}
        remove={row ? removePricingAction : undefined}
        id={row?.id}
        copy={copy}
      >
        <PricingEditor row={row} services={services} copy={copy} />
      </EntityForm>
    );
  }
  const rows = await prisma.pricingItem.findMany({
    include: { contents: true },
    orderBy: [{ order: "asc" }, { price: "asc" }],
  });
  return (
    <Collection title={copy.modules.pricing} base={base} copy={copy}>
      {rows.map((row) => (
        <EntityLink
          key={row.id}
          href={`${base}/${row.id}`}
          title={localizedName(row.contents, locale, "label") || row.label}
          subtitle={`${Number(row.price).toFixed(2)} EUR`}
          archived={Boolean(row.archivedAt)}
          copy={copy}
        />
      ))}
    </Collection>
  );
}

function PricingEditor({
  row,
  services,
  copy,
}: {
  row: PricingRow | null;
  services: { id: string; slug: string }[];
  copy: Copy;
}) {
  const byLocale = new Map(row?.contents.map((item) => [item.locale, item]));
  return (
    <>
      <EditorSection title={copy.common.global}>
        <div className={globalGrid}>
          <Field label="Service">
            <ThemedSelect
              name="serviceId"
              defaultValue={row?.serviceId ?? ""}
              options={[
                { value: "", label: "—" },
                ...services.map((service) => ({
                  value: service.id,
                  label: service.slug,
                })),
              ]}
            />
          </Field>
          <Field label={copy.common.category}>
            <ThemedSelect
              name="category"
              defaultValue={row?.category ?? ""}
              options={[
                "",
                "FACE",
                "BODY",
                "HAIR",
                "INJECTABLE",
                "DEVICE",
                "LASER",
                "CONSULTATION",
              ].map((item) => ({ value: item, label: item || "—" }))}
            />
          </Field>
          <Field label={copy.common.price}>
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={row ? Number(row.price) : 0}
              className={inputCls}
            />
          </Field>
          <Field label={copy.common.order}>
            <input
              name="order"
              type="number"
              defaultValue={row?.order ?? 0}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Check
            name="archived"
            label={copy.common.archived}
            checked={Boolean(row?.archivedAt)}
          />
        </div>
      </EditorSection>
      <LocaleEditors title={copy.common.locales}>
        {locales.map((locale) => {
          const item = byLocale.get(locale);
          return (
            <LocaleCard
              key={locale}
              locale={locale}
              status={item?.status}
              copy={copy}
            >
              <Field label={copy.common.label}>
                <input
                  name={`label_${locale}`}
                  defaultValue={item?.label ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label={copy.common.unit}>
                <input
                  name={`unit_${locale}`}
                  defaultValue={item?.unit ?? ""}
                  className={inputCls}
                />
              </Field>
            </LocaleCard>
          );
        })}
      </LocaleEditors>
    </>
  );
}

async function Articles({
  locale,
  id,
  copy,
}: {
  locale: Locale;
  id?: string;
  copy: Copy;
}) {
  const base = adminHref(locale, "blog");
  if (id) {
    const row =
      id === "uusi"
        ? null
        : await prisma.article.findUnique({
            where: { id },
            include: { contents: true },
          });
    if (id !== "uusi" && !row) notFound();
    return (
      <EntityForm
        title={row?.slug ?? `${copy.common.new} ${copy.modules.blog}`}
        base={base}
        save={saveArticleAction}
        remove={row ? removeArticleAction : undefined}
        id={row?.id}
        copy={copy}
      >
        <ArticleEditor row={row} copy={copy} />
      </EntityForm>
    );
  }
  const rows = await prisma.article.findMany({
    include: { contents: true },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
  return (
    <Collection title={copy.modules.blog} base={base} copy={copy}>
      {rows.map((row) => (
        <EntityLink
          key={row.id}
          href={`${base}/${row.id}`}
          title={localizedName(row.contents, locale, "title") || row.slug}
          subtitle={publishedLocales(row.contents)}
          archived={Boolean(row.archivedAt)}
          copy={copy}
        />
      ))}
    </Collection>
  );
}

function ArticleEditor({ row, copy }: { row: ArticleRow | null; copy: Copy }) {
  const byLocale = new Map(row?.contents.map((item) => [item.locale, item]));
  const inlineByLocale = new Map(
    locales.map((itemLocale) => [
      itemLocale,
      markdownImages(byLocale.get(itemLocale)?.body),
    ]),
  );
  const inlineCount = Math.max(
    0,
    ...locales.map((itemLocale) => inlineByLocale.get(itemLocale)?.length ?? 0),
  );
  return (
    <>
      <EditorSection title={copy.common.global}>
        <div className={globalGrid}>
          <Field label={copy.common.slug}>
            <input
              name="slug"
              required
              defaultValue={row?.slug ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label={copy.common.imageAlt}>
            <input
              name="coverAlt"
              defaultValue={row?.coverAlt ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label={copy.common.order}>
            <input
              name="order"
              type="number"
              defaultValue={row?.order ?? 0}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="mt-3.5">
          <MediaField
            name="coverImage"
            label={copy.common.images}
            defaultValue={row?.coverImage ?? ""}
            required={false}
            focalXName="coverFocalX"
            focalYName="coverFocalY"
            defaultFocalX={row?.coverFocalX}
            defaultFocalY={row?.coverFocalY}
          />
        </div>
        <div className="mt-3">
          <Check
            name="archived"
            label={copy.common.archived}
            checked={Boolean(row?.archivedAt)}
          />
        </div>
      </EditorSection>
      {inlineCount ? (
        <EditorSection title="Inline article images">
          <div className="grid gap-6">
            {Array.from({ length: inlineCount }, (_, index) => {
              const sharedImage = locales
                .map(
                  (itemLocale) =>
                    inlineByLocale.get(itemLocale)?.[index]?.image,
                )
                .find(Boolean);
              return (
                <div
                  key={index}
                  className="rounded-md border border-line-hair p-3"
                >
                  <MediaField
                    name={`bodyImage_${index}`}
                    label={`Article image ${index + 1}`}
                    defaultValue={sharedImage ?? ""}
                    required={false}
                  />
                  <div className={`${alignedFieldGrid} mt-3 md:grid-cols-3`}>
                    {locales.map((itemLocale) => (
                      <Field
                        key={itemLocale}
                        label={`${copy.common.imageAlt} · ${itemLocale}`}
                      >
                        <input
                          name={`bodyImageAlt_${index}_${itemLocale}`}
                          defaultValue={
                            inlineByLocale.get(itemLocale)?.[index]?.alt ?? ""
                          }
                          required={Boolean(
                            inlineByLocale.get(itemLocale)?.[index]?.image,
                          )}
                          className={inputCls}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </EditorSection>
      ) : null}
      <LocaleEditors title={copy.common.locales}>
        {locales.map((locale) => {
          const item = byLocale.get(locale);
          return (
            <LocaleCard
              key={locale}
              locale={locale}
              status={item?.status}
              copy={copy}
            >
              <Field label={copy.common.title}>
                <input
                  name={`title_${locale}`}
                  defaultValue={item?.title ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label={copy.common.summary}>
                <textarea
                  name={`excerpt_${locale}`}
                  rows={3}
                  defaultValue={item?.excerpt ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label={copy.common.imageAlt}>
                <input
                  name={`imageAlt_${locale}`}
                  defaultValue={
                    item?.imageAlt ?? row?.coverAlt ?? item?.title ?? ""
                  }
                  className={inputCls}
                />
              </Field>
              <Field label={copy.common.body}>
                <textarea
                  name={`body_${locale}`}
                  rows={10}
                  defaultValue={item?.body ?? ""}
                  className={inputCls}
                />
              </Field>
              <SeoFields locale={locale} data={item} copy={copy} noAlt />
            </LocaleCard>
          );
        })}
      </LocaleEditors>
    </>
  );
}

async function Chats({ locale, id }: { locale: Locale; id?: string }) {
  return <ConversationWorkspace locale={locale} initialSessionId={id} />;
}

function EntityForm({
  title,
  base,
  save,
  remove,
  id,
  removeIdName = "id",
  removeIdValue,
  copy,
  children,
}: {
  title: string;
  base: string;
  save: (data: FormData) => Promise<void>;
  remove?: (data: FormData) => Promise<void>;
  id?: string;
  removeIdName?: string;
  removeIdValue?: string;
  copy: Copy;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Back href={base} label={copy.common.back} />
      <PageHeader title={title} />
      <AdminForm action={save} className="mt-5">
        <input type="hidden" name="id" value={id ?? ""} />
        <input
          type="hidden"
          name="returnTo"
          value={id ? `${base}/${id}` : `${base}/uusi`}
        />
        {children}
        <div className="sticky bottom-3 z-20 mt-4.5 flex justify-end rounded-md border border-line-card bg-card/95 p-3 shadow-card backdrop-blur">
          <PendingSaveButton
            saveLabel={copy.common.save}
            savingLabel={copy.common.saving}
            className={primaryButton}
          />
        </div>
      </AdminForm>
      {remove ? (
        <form
          action={remove}
          className="mt-3.5 rounded-md border border-line-card bg-card p-3.5"
        >
          <input
            type="hidden"
            name={removeIdName}
            value={removeIdValue ?? id ?? ""}
          />
          <input type="hidden" name="returnTo" value={base} />
          <p className="mb-2.5 font-sans text-[14px] text-muted">
            {copy.common.confirmDelete}
          </p>
          <button className={dangerButton}>{copy.common.delete}</button>
        </form>
      ) : null}
    </div>
  );
}

function Collection({
  title,
  base,
  copy,
  children,
}: {
  title: string;
  base: string;
  copy: Copy;
  children: React.ReactNode;
}) {
  return (
    <div>
      <PageHeader
        title={title}
        action={
          <Link href={`${base}/uusi`} className={primaryButton}>
            {copy.common.new}
          </Link>
        }
      />
      <RecordList empty={copy.common.empty}>{children}</RecordList>
    </div>
  );
}

function RecordList({
  children,
  empty,
}: {
  children: React.ReactNode;
  empty: string;
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);
  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-line-card bg-card">
      {hasChildren ? (
        children
      ) : (
        <p className="p-4.5 font-sans text-[14px] text-muted">{empty}</p>
      )}
    </div>
  );
}

function EntityLink({
  href,
  title,
  subtitle,
  archived,
  copy,
}: {
  href: string;
  title: string;
  subtitle: string;
  archived?: boolean;
  copy: Copy;
}) {
  return (
    <Link href={href} className={recordRow}>
      <span className="min-w-0">
        <strong className="block truncate">{title}</strong>
        <small className="block truncate">{subtitle}</small>
      </span>
      {archived ? (
        <Status archived copy={copy} />
      ) : (
        <ArrowRight size={18} weight="regular" aria-hidden="true" />
      )}
    </Link>
  );
}

function LocaleEditors({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <EditorSection title={title}>
      <div className="grid gap-4 xl:grid-cols-3">{children}</div>
    </EditorSection>
  );
}
function LocaleCard({
  locale,
  status,
  copy,
  children,
}: {
  locale: DbLocale;
  status?: string;
  copy: Copy;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="min-w-0 rounded-[7px] border border-line-card bg-card p-3.5">
      <legend className="px-1.5 font-sans text-label font-medium tracking-[.12em] uppercase">
        {locale}
      </legend>
      <Field label={copy.common.status}>
        <ThemedSelect
          name={`status_${locale}`}
          defaultValue={status ?? "DRAFT"}
          options={[
            { value: "DRAFT", label: copy.common.draft },
            { value: "PUBLISHED", label: copy.common.published },
          ]}
        />
      </Field>
      {children}
    </fieldset>
  );
}
function SeoFields({
  locale,
  data,
  copy,
  noAlt = false,
}: {
  locale: DbLocale;
  data?: {
    seoTitle?: string | null;
    seoDescription?: string | null;
    seoIndexable?: boolean;
    imageAlt?: string | null;
  };
  copy: Copy;
  noAlt?: boolean;
}) {
  return (
    <>
      {!noAlt ? (
        <Field label={copy.common.imageAlt}>
          <input
            name={`imageAlt_${locale}`}
            defaultValue={data?.imageAlt ?? ""}
            className={inputCls}
          />
        </Field>
      ) : null}
      <Field label={copy.common.seoTitle}>
        <input
          name={`seoTitle_${locale}`}
          defaultValue={data?.seoTitle ?? ""}
          className={inputCls}
        />
      </Field>
      <Field label={copy.common.seoDescription}>
        <textarea
          name={`seoDescription_${locale}`}
          rows={2}
          defaultValue={data?.seoDescription ?? ""}
          className={inputCls}
        />
      </Field>
      <label className="mt-3 flex min-h-11 items-center gap-3 font-sans text-label text-body">
        <input
          type="checkbox"
          name={`seoIndexable_${locale}`}
          defaultChecked={data?.seoIndexable ?? true}
          className="size-4 accent-accent"
        />
        {copy.common.seoIndexable}
      </label>
    </>
  );
}
function EditorSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${panelCls} mb-4`}>
      <h2 className={sectionTitle}>{title}</h2>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}
function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3.5">
      <div>
        <h1 className="font-display text-[clamp(34px,5vw,54px)] leading-[1.02] font-medium">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-180 font-sans text-[14px] text-body">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
function Back({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-3.5 inline-flex min-h-11 items-center font-sans text-meta tracking-[.08em] text-body uppercase"
    >
      ← {label}
    </Link>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-3 block first:mt-0">
      <span className="mb-1.5 block font-sans text-label tracking-[.08em] text-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
function Check({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2.25 font-sans text-[14px] text-body">
      <input
        name={name}
        type="checkbox"
        defaultChecked={checked}
        className="size-4.5 accent-accent"
      />
      {label}
    </label>
  );
}
function Status({ archived, copy }: { archived: boolean; copy: Copy }) {
  return (
    <span className="shrink-0 self-center rounded-full bg-btn-fill px-2.5 py-1.25 text-meta text-muted">
      {archived ? copy.common.archived : copy.common.published}
    </span>
  );
}
function History({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const has = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className={`${panelCls} mt-4.5`}>
      <h2 className={sectionTitle}>{title}</h2>
      <div className="mt-3 grid gap-1.75">
        {has ? (
          children
        ) : (
          <p className="font-sans text-[14px] text-muted">{empty}</p>
        )}
      </div>
    </section>
  );
}

function localizedName<T extends { locale: DbLocale }>(
  contents: T[],
  locale: Locale,
  key: keyof T,
) {
  const row = contents.find((item) => item.locale === locale);
  const result = row?.[key];
  return typeof result === "string" ? result : "";
}
function publishedLocales(
  contents: Array<{ locale: DbLocale; status: string }>,
) {
  return (
    contents
      .filter((item) => item.status === "PUBLISHED")
      .map((item) => item.locale.toUpperCase())
      .join(" · ") || "DRAFT"
  );
}
function formatDate(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Helsinki",
  }).format(date);
}

const inputCls =
  "min-h-11 w-full rounded-[4px] border border-line-btn bg-page px-2.75 py-2.5 font-sans text-compact text-ink outline-none focus:border-accent";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-[4px] bg-accent px-4 font-sans text-meta font-medium tracking-widest text-page uppercase hover:brightness-95";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-[4px] border border-line-btn bg-card px-3.5 font-sans text-meta tracking-[.08em] text-ink uppercase hover:bg-btn-fill";
const dangerButton =
  "inline-flex min-h-11 items-center justify-center rounded-[4px] border border-[#9b6b5f] px-3.5 font-sans text-meta tracking-[.08em] text-[#7c4438] uppercase hover:bg-btn-fill";
const panelCls =
  "rounded-lg border border-line-card bg-card p-[clamp(16px,2.5vw,24px)]";
const cardCls =
  "rounded-lg border border-line-card bg-card p-4 transition hover:-translate-y-[2px] hover:shadow-card motion-reduce:transform-none";
const sectionTitle = "font-display text-[26px] font-medium";
const recordRow =
  "flex min-h-[72px] items-start justify-between gap-4 border-b border-line-hair px-4 py-3.5 font-sans text-[14px] text-ink last:border-b-0 hover:bg-page sm:items-center [&_small]:text-label [&_small]:text-muted [&_strong]:block";
const alignedFieldGrid =
  "grid items-start gap-x-[14px] gap-y-[12px] [&>label]:mt-0";
const globalGrid = `${alignedFieldGrid} sm:grid-cols-2 xl:grid-cols-3`;
const historyRow =
  "grid gap-x-4.5 gap-y-1.5 rounded-[5px] border border-line-hair bg-page px-3.5 py-[12px] font-sans text-[14px] sm:grid-cols-[minmax(155px,190px)_minmax(0,1fr)_auto_auto] sm:items-center";
const appointmentHistoryRow =
  "grid gap-x-4.5 gap-y-1.5 rounded-[5px] border border-line-hair bg-page px-3.5 py-[12px] font-sans text-[14px] sm:grid-cols-[minmax(155px,190px)_minmax(0,1fr)_auto] sm:items-center";
