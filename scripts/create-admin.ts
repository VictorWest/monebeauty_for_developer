import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [method, salt, value] = stored.split(":");
  if (method !== "scrypt" || !salt || !value) return false;

  const expected = Buffer.from(value, "hex");
  const derived = (await scryptAsync(
    password,
    salt,
    expected.length,
  )) as Buffer;
  return (
    expected.length === derived.length && timingSafeEqual(expected, derived)
  );
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Mone Beauty Admin";

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }
  if (!email || !email.includes("@")) {
    throw new Error("ADMIN_EMAIL must be a valid email address.");
  }
  if (!password || password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const passwordHash = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing && existing.role !== "ADMIN") {
      throw new Error(
        `Refusing to elevate existing ${existing.role.toLowerCase()} user ${email}.`,
      );
    }

    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            name,
            passwordHash,
            role: "ADMIN",
            status: "ACTIVE",
            mustChangePassword: false,
            emailVerifiedAt: new Date(),
            passwordChangedAt: new Date(),
          },
        })
      : await tx.user.create({
          data: {
            email,
            name,
            passwordHash,
            role: "ADMIN",
            status: "ACTIVE",
            mustChangePassword: false,
            emailVerifiedAt: new Date(),
            passwordChangedAt: new Date(),
          },
        });

    const sessions = await tx.session.deleteMany({
      where: { userId: user.id },
    });
    await tx.auditLog.create({
      data: {
        actor: "system:db:create-admin",
        action: existing ? "admin.password.rotate" : "admin.create",
        entity: "User",
        entityId: user.id,
      },
    });

    return { user, revokedSessions: sessions.count, created: !existing };
  });

  const stored = await prisma.user.findUnique({
    where: { email },
    select: { email: true, passwordHash: true, role: true },
  });
  if (
    !stored?.passwordHash ||
    stored.role !== "ADMIN" ||
    !(await verifyPassword(password, stored.passwordHash))
  ) {
    throw new Error("Admin credential verification failed after provisioning.");
  }

  console.log(
    `${result.created ? "Created" : "Updated"} admin ${stored.email}; ` +
      `revoked ${result.revokedSessions} session(s); credential verification passed.`,
  );
}

main()
  .catch((error) => {
    console.error(
      `Admin provisioning failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
