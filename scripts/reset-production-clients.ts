import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const confirmation = process.argv
  .find((argument) => argument.startsWith("--confirm-database="))
  ?.slice("--confirm-database=".length);

const expected = {
  appointments: 10,
  clients: 8,
  clientUsers: 4,
  clientSessions: 8,
  clientAccountTokens: 4,
  legacyOrders: 1,
} as const;

function databaseName() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required.");
  try {
    return decodeURIComponent(new URL(value).pathname.replace(/^\//, ""));
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL.");
  }
}

async function protectedCounts(
  client: Prisma.TransactionClient | PrismaClient,
) {
  const [
    backofficeUsers,
    practitioners,
    qualifications,
    services,
    products,
    availability,
    calendarBlocks,
    rooms,
    devices,
    auditLogs,
    consultationQuestions,
  ] = await Promise.all([
    client.user.count({ where: { role: { in: ["ADMIN", "STAFF"] } } }),
    client.practitioner.count(),
    client.practitionerServiceOptionQualification.count(),
    client.service.count(),
    client.product.count(),
    client.availability.count(),
    client.calendarBlock.count(),
    client.room.count(),
    client.device.count(),
    client.auditLog.count(),
    client.consultationQuestion.count(),
  ]);
  return {
    backofficeUsers,
    practitioners,
    qualifications,
    services,
    products,
    availability,
    calendarBlocks,
    rooms,
    devices,
    auditLogs,
    consultationQuestions,
  };
}

async function inspect(client: Prisma.TransactionClient | PrismaClient) {
  const clientRows = await client.client.findMany({ select: { id: true } });
  const clientIds = clientRows.map(({ id }) => id);
  const clientUsers = await client.user.findMany({
    where: { role: "CLIENT" },
    select: { id: true },
  });
  const userIds = clientUsers.map(({ id }) => id);
  const appointments = await client.appointment.findMany({
    select: { id: true },
  });
  const appointmentIds = appointments.map(({ id }) => id);
  const chats = await client.chatSession.findMany({
    where: { clientId: { in: clientIds } },
    select: { id: true },
  });
  const chatIds = chats.map(({ id }) => id);
  const orders = await client.order.findMany({
    where: {
      OR: [
        { clientId: { in: clientIds } },
        { source: "LEGACY_REQUEST", status: "PENDING" },
      ],
    },
    select: {
      id: true,
      source: true,
      paymentStatus: true,
      payments: {
        select: {
          id: true,
          stripeCheckoutSessionId: true,
          stripePaymentIntentId: true,
        },
      },
      refunds: { select: { id: true } },
    },
  });
  const unsafeOrders = orders.filter(
    (order) =>
      order.source !== "LEGACY_REQUEST" ||
      order.paymentStatus !== "UNPAID" ||
      order.payments.length > 0 ||
      order.refunds.length > 0,
  );
  const orderIds = orders.map(({ id }) => id);
  const messages = await client.outboundMessage.findMany({
    where: {
      OR: [
        { appointmentId: { in: appointmentIds } },
        { orderId: { in: orderIds } },
        { chatSessionId: { in: chatIds } },
      ],
    },
    select: { id: true },
  });
  const messageIds = messages.map(({ id }) => id);
  const [
    appointmentEvents,
    changeRequests,
    externalApiAttempts,
    deliveryAttempts,
    consents,
    consultationProfiles,
    savedAddresses,
    carts,
    cartItems,
    orderCancellationRequests,
    orderItems,
    paymentAttempts,
    refunds,
    clientSessions,
    clientAccountTokens,
    appointmentAccountTokens,
  ] = await Promise.all([
    client.appointmentEvent.count({
      where: { appointmentId: { in: appointmentIds } },
    }),
    client.appointmentChangeRequest.count({
      where: {
        OR: [
          { appointmentId: { in: appointmentIds } },
          { clientId: { in: clientIds } },
        ],
      },
    }),
    client.externalApiAttempt.count({
      where: {
        OR: [
          { appointmentId: { in: appointmentIds } },
          { orderId: { in: orderIds } },
          { messageId: { in: messageIds } },
        ],
      },
    }),
    client.deliveryAttempt.count({ where: { messageId: { in: messageIds } } }),
    client.consent.count({
      where: {
        OR: [
          { clientId: { in: clientIds } },
          { appointmentId: { in: appointmentIds } },
        ],
      },
    }),
    client.consultationProfile.count({
      where: { clientId: { in: clientIds } },
    }),
    client.savedAddress.count({ where: { clientId: { in: clientIds } } }),
    client.cart.count({ where: { clientId: { in: clientIds } } }),
    client.cartItem.count({
      where: { cart: { clientId: { in: clientIds } } },
    }),
    client.orderCancellationRequest.count({
      where: {
        OR: [{ orderId: { in: orderIds } }, { clientId: { in: clientIds } }],
      },
    }),
    client.orderItem.count({ where: { orderId: { in: orderIds } } }),
    client.paymentAttempt.count({ where: { orderId: { in: orderIds } } }),
    client.refund.count({ where: { orderId: { in: orderIds } } }),
    client.session.count({ where: { userId: { in: userIds } } }),
    client.accountToken.count({
      where: { userId: { in: userIds } },
    }),
    client.accountToken.count({
      where: {
        appointmentId: { in: appointmentIds },
      },
    }),
  ]);
  return {
    ids: { clientIds, userIds, appointmentIds, chatIds, orderIds, messageIds },
    unsafeOrderIds: unsafeOrders.map(({ id }) => id),
    counts: {
      appointments: appointmentIds.length,
      appointmentEvents,
      appointmentChangeRequests: changeRequests,
      outboundMessages: messageIds.length,
      deliveryAttempts,
      externalApiAttempts,
      consents,
      clients: clientIds.length,
      consultationProfiles,
      savedAddresses,
      carts,
      cartItems,
      chats: chatIds.length,
      orderCancellationRequests,
      legacyOrders: orders.length,
      orderItems,
      paymentAttempts,
      refunds,
      clientUsers: userIds.length,
      clientSessions,
      clientAccountTokens,
      appointmentAccountTokens,
    },
  };
}

function assertExpected(counts: Awaited<ReturnType<typeof inspect>>["counts"]) {
  for (const [key, value] of Object.entries(expected)) {
    if (counts[key as keyof typeof expected] !== value)
      throw new Error(
        `Refusing apply: expected ${value} ${key}, found ${counts[key as keyof typeof expected]}.`,
      );
  }
}

async function main() {
  const database = databaseName();
  const beforeProtected = await protectedCounts(prisma);
  const plan = await inspect(prisma);
  const summary = {
    ok: plan.unsafeOrderIds.length === 0,
    mode: apply ? "apply" : "dry-run",
    database,
    expected,
    targeted: plan.counts,
    unsafeOrderCount: plan.unsafeOrderIds.length,
    protected: beforeProtected,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (plan.unsafeOrderIds.length)
    throw new Error(
      "Refusing reset: a targeted order is paid, refunded, or Stripe-backed.",
    );
  if (!apply) return;
  if (!confirmation || confirmation !== database)
    throw new Error(
      `Refusing apply: pass --confirm-database=${database} to confirm the exact database.`,
    );
  assertExpected(plan.counts);

  const deleted = await prisma.$transaction(
    async (tx) => {
      const {
        clientIds,
        userIds,
        appointmentIds,
        chatIds,
        orderIds,
        messageIds,
      } = plan.ids;
      const results: Record<string, number> = {};
      const record = async (
        key: string,
        operation: Promise<{ count: number }>,
      ) => {
        results[key] = (await operation).count;
      };
      await record(
        "deliveryAttempts",
        tx.deliveryAttempt.deleteMany({
          where: { messageId: { in: messageIds } },
        }),
      );
      await record(
        "externalApiAttempts",
        tx.externalApiAttempt.deleteMany({
          where: {
            OR: [
              { appointmentId: { in: appointmentIds } },
              { orderId: { in: orderIds } },
              { messageId: { in: messageIds } },
            ],
          },
        }),
      );
      await record(
        "outboundMessages",
        tx.outboundMessage.deleteMany({ where: { id: { in: messageIds } } }),
      );
      await record(
        "consents",
        tx.consent.deleteMany({
          where: {
            OR: [
              { clientId: { in: clientIds } },
              { appointmentId: { in: appointmentIds } },
            ],
          },
        }),
      );
      await record(
        "accountTokens",
        tx.accountToken.deleteMany({
          where: {
            OR: [
              { userId: { in: userIds } },
              { appointmentId: { in: appointmentIds } },
            ],
          },
        }),
      );
      await record(
        "appointmentChangeRequests",
        tx.appointmentChangeRequest.deleteMany({
          where: {
            OR: [
              { appointmentId: { in: appointmentIds } },
              { clientId: { in: clientIds } },
            ],
          },
        }),
      );
      await record(
        "appointmentEvents",
        tx.appointmentEvent.deleteMany({
          where: { appointmentId: { in: appointmentIds } },
        }),
      );
      await record(
        "appointments",
        tx.appointment.deleteMany({ where: { id: { in: appointmentIds } } }),
      );
      await record(
        "orderCancellationRequests",
        tx.orderCancellationRequest.deleteMany({
          where: {
            OR: [
              { orderId: { in: orderIds } },
              { clientId: { in: clientIds } },
            ],
          },
        }),
      );
      await record(
        "refunds",
        tx.refund.deleteMany({ where: { orderId: { in: orderIds } } }),
      );
      await record(
        "paymentAttempts",
        tx.paymentAttempt.deleteMany({ where: { orderId: { in: orderIds } } }),
      );
      await record(
        "orderItems",
        tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }),
      );
      await record(
        "orders",
        tx.order.deleteMany({ where: { id: { in: orderIds } } }),
      );
      await record(
        "chats",
        tx.chatSession.deleteMany({ where: { id: { in: chatIds } } }),
      );
      await record(
        "consultationProfiles",
        tx.consultationProfile.deleteMany({
          where: { clientId: { in: clientIds } },
        }),
      );
      await record(
        "carts",
        tx.cart.deleteMany({ where: { clientId: { in: clientIds } } }),
      );
      await record(
        "savedAddresses",
        tx.savedAddress.deleteMany({ where: { clientId: { in: clientIds } } }),
      );
      await record(
        "clients",
        tx.client.deleteMany({ where: { id: { in: clientIds } } }),
      );
      await record(
        "sessions",
        tx.session.deleteMany({ where: { userId: { in: userIds } } }),
      );
      await record(
        "clientUsers",
        tx.user.deleteMany({ where: { id: { in: userIds } } }),
      );
      return results;
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  const remaining = await inspect(prisma);
  const afterProtected = await protectedCounts(prisma);
  const remainingTopLevel = {
    appointments: remaining.counts.appointments,
    clients: remaining.counts.clients,
    clientUsers: remaining.counts.clientUsers,
    consultationProfiles: remaining.counts.consultationProfiles,
    clientSessions: remaining.counts.clientSessions,
    clientAccountTokens: remaining.counts.clientAccountTokens,
    appointmentAccountTokens: remaining.counts.appointmentAccountTokens,
    legacyOrders: remaining.counts.legacyOrders,
  };
  if (Object.values(remainingTopLevel).some((count) => count !== 0))
    throw new Error("Reset transaction completed but targeted records remain.");
  if (JSON.stringify(beforeProtected) !== JSON.stringify(afterProtected))
    throw new Error("Protected operational counts changed during the reset.");
  if (afterProtected.consultationQuestions !== 3)
    throw new Error(
      "Expected exactly three configured consultation questions.",
    );
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "applied",
        database,
        deleted,
        remaining: remainingTopLevel,
        protected: afterProtected,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Reset failed.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
