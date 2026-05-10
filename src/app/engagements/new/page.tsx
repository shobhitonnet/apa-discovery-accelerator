import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { NewEngagementForm } from "./NewEngagementForm";

export default async function NewEngagementPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return <NewEngagementForm />;
}
