import { redirect } from "next/navigation";

import { ContactForm } from "@/features/contacts/contact-form";
import { getContactFormOptions } from "@/features/contacts/contact-query";
import { getCurrentUserAccess, hasWorkspaceAccess } from "@/lib/auth/access";

export default async function NewPartnerContactPage() {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules.mou?.create) redirect("/mou/contacts");
  return <ContactForm contact={null} options={await getContactFormOptions()} />;
}
