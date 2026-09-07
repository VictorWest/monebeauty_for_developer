import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth";

export async function GET() {
  await destroySession("backoffice");
  redirect("/admin/kirjaudu");
}
