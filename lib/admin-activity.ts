import type { Locale as DbLocale } from "@prisma/client";
import type { Locale } from "@/i18n/routing";
import { adminHref } from "@/lib/admin-routing";
import { prisma } from "@/lib/db";

export type BusinessActivityCategory =
  "appointment" | "order" | "chat" | "treatment";

export type BusinessActivityAction =
  | "appointmentBooked"
  | "appointmentConfirmed"
  | "appointmentRescheduled"
  | "appointmentCompleted"
  | "appointmentCancelled"
  | "orderPlaced"
  | "orderConfirmed"
  | "orderFulfilled"
  | "orderCancelled"
  | "chatHandoffRequested"
  | "chatResolved"
  | "chatReopened"
  | "chatArchived"
  | "treatmentCreated"
  | "treatmentUpdated"
  | "treatmentArchived"
  | "treatmentDeleted";

export type BusinessActivity = {
  id: string;
  category: BusinessActivityCategory;
  action: BusinessActivityAction;
  at: Date;
  subject?: string | null;
  detail?: string | null;
  status?: string | null;
  href?: string | null;
};

export const BUSINESS_AUDIT_ACTIONS = [
  "order_confirmed",
  "order_fulfilled",
  "order_cancelled",
  "chat_handoff_requested",
  "chat_resolve",
  "chat_reopen",
  "chat_archive",
  "service_created",
  "service_updated",
  "service_archived_guarded",
  "service_deleted",
] as const;

const appointmentActions = {
  CREATED: "appointmentBooked",
  DETAILS_UPDATED: "appointmentRescheduled",
  CONFIRMED: "appointmentConfirmed",
  RESCHEDULED: "appointmentRescheduled",
  COMPLETED: "appointmentCompleted",
  CANCELLED: "appointmentCancelled",
  CALENDAR_UPDATED: "appointmentRescheduled",
} as const;

const auditActions: Record<
  (typeof BUSINESS_AUDIT_ACTIONS)[number],
  Pick<BusinessActivity, "category" | "action">
> = {
  order_confirmed: { category: "order", action: "orderConfirmed" },
  order_fulfilled: { category: "order", action: "orderFulfilled" },
  order_cancelled: { category: "order", action: "orderCancelled" },
  chat_handoff_requested: {
    category: "chat",
    action: "chatHandoffRequested",
  },
  chat_resolve: { category: "chat", action: "chatResolved" },
  chat_reopen: { category: "chat", action: "chatReopened" },
  chat_archive: { category: "chat", action: "chatArchived" },
  service_created: { category: "treatment", action: "treatmentCreated" },
  service_updated: { category: "treatment", action: "treatmentUpdated" },
  service_archived_guarded: {
    category: "treatment",
    action: "treatmentArchived",
  },
  service_deleted: { category: "treatment", action: "treatmentDeleted" },
};

export function mergeBusinessActivities(
  groups: BusinessActivity[][],
  limit = 10,
) {
  return groups
    .flat()
    .sort((left, right) => right.at.getTime() - left.at.getTime())
    .slice(0, limit);
}

function serviceTitle(service: {
  slug: string;
  contents: Array<{ h1: string }>;
}) {
  return service.contents[0]?.h1 || service.slug;
}

function orderReference(id: string) {
  return `#${id.slice(-8).toUpperCase()}`;
}

export async function getRecentBusinessActivity(locale: Locale, limit = 10) {
  const dbLocale = locale as DbLocale;
  const serviceSelection = {
    slug: true,
    contents: {
      where: { locale: dbLocale },
      select: { h1: true },
      take: 1,
    },
  } as const;
  const [appointments, appointmentEvents, orders, openHandoffs, audits] =
    await Promise.all([
      prisma.appointment.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          client: { select: { fullName: true } },
          service: { select: serviceSelection },
        },
      }),
      prisma.appointmentEvent.findMany({
        orderBy: { at: "desc" },
        take: limit,
        include: {
          appointment: {
            include: {
              client: { select: { fullName: true } },
              service: { select: serviceSelection },
            },
          },
        },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          client: { select: { fullName: true } },
          items: { select: { name: true }, take: 1 },
        },
      }),
      prisma.chatSession.findMany({
        where: {
          handoffRequested: true,
          status: "OPEN",
          archivedAt: null,
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          contactName: true,
          status: true,
          updatedAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: { action: { in: [...BUSINESS_AUDIT_ACTIONS] } },
        orderBy: { at: "desc" },
        take: limit * 3,
      }),
    ]);

  const orderIds = audits
    .filter((entry) => entry.entity === "Order" && entry.entityId)
    .map((entry) => entry.entityId as string);
  const chatIds = audits
    .filter((entry) => entry.entity === "ChatSession" && entry.entityId)
    .map((entry) => entry.entityId as string);
  const serviceIds = audits
    .filter((entry) => entry.entity === "Service" && entry.entityId)
    .map((entry) => entry.entityId as string);
  const [auditOrders, auditChats, auditServices] = await Promise.all([
    prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: { client: { select: { fullName: true } } },
    }),
    prisma.chatSession.findMany({
      where: { id: { in: chatIds } },
      select: { id: true, contactName: true, status: true },
    }),
    prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, ...serviceSelection },
    }),
  ]);
  const ordersById = new Map(auditOrders.map((order) => [order.id, order]));
  const chatsById = new Map(auditChats.map((chat) => [chat.id, chat]));
  const servicesById = new Map(
    auditServices.map((service) => [service.id, service]),
  );
  const auditedChatIds = new Set(chatIds);

  const createdAppointments: BusinessActivity[] = appointments.map(
    (appointment) => ({
      id: `appointment-created-${appointment.id}`,
      category: "appointment",
      action: "appointmentBooked",
      at: appointment.createdAt,
      subject: appointment.procedureTitle ?? serviceTitle(appointment.service),
      detail: appointment.contactName,
      status: appointment.status,
      href: adminHref(locale, "appointments", appointment.id),
    }),
  );
  const changedAppointments: BusinessActivity[] = appointmentEvents.map(
    (event) => ({
      id: `appointment-event-${event.id}`,
      category: "appointment",
      action: appointmentActions[event.kind],
      at: event.at,
      subject:
        event.appointment.procedureTitle ??
        serviceTitle(event.appointment.service),
      detail: event.appointment.contactName,
      status: event.nextStatus ?? event.appointment.status,
      href: adminHref(locale, "appointments", event.appointmentId),
    }),
  );
  const createdOrders: BusinessActivity[] = orders.map((order) => ({
    id: `order-created-${order.id}`,
    category: "order",
    action: "orderPlaced",
    at: order.createdAt,
    subject: order.client?.fullName ?? orderReference(order.id),
    detail: `${orderReference(order.id)} · ${Number(order.total).toFixed(2)} ${order.currency}`,
    status: order.status,
    href: adminHref(locale, "orders", order.id),
  }));
  const handoffs: BusinessActivity[] = openHandoffs
    .filter((chat) => !auditedChatIds.has(chat.id))
    .map((chat) => ({
      id: `chat-handoff-${chat.id}`,
      category: "chat",
      action: "chatHandoffRequested",
      at: chat.updatedAt,
      subject: chat.contactName,
      status: chat.status,
      href: adminHref(locale, "chat", chat.id),
    }));
  const auditedActivities: BusinessActivity[] = audits.map((entry) => {
    const mapped = auditActions[entry.action as keyof typeof auditActions];
    const order = entry.entityId ? ordersById.get(entry.entityId) : undefined;
    const chat = entry.entityId ? chatsById.get(entry.entityId) : undefined;
    const service = entry.entityId
      ? servicesById.get(entry.entityId)
      : undefined;
    const href = entry.entityId
      ? mapped.category === "order" && order
        ? adminHref(locale, "orders", entry.entityId)
        : mapped.category === "chat" && chat
          ? adminHref(locale, "chat", entry.entityId)
          : mapped.category === "treatment" && service
            ? adminHref(locale, "services", entry.entityId)
            : null
      : null;
    return {
      id: `audit-${entry.id}`,
      ...mapped,
      at: entry.at,
      subject:
        mapped.category === "order" && entry.entityId
          ? (order?.client?.fullName ?? orderReference(entry.entityId))
          : mapped.category === "chat"
            ? chat?.contactName
            : service
              ? serviceTitle(service)
              : null,
      detail:
        mapped.category === "order" && entry.entityId
          ? orderReference(entry.entityId)
          : null,
      status: order?.status ?? chat?.status ?? null,
      href,
    };
  });

  return mergeBusinessActivities(
    [
      createdAppointments,
      changedAppointments,
      createdOrders,
      handoffs,
      auditedActivities,
    ],
    limit,
  );
}
