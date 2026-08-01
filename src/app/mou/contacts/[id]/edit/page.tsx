import { notFound, redirect } from "next/navigation";

import { ContactForm } from "@/features/contacts/contact-form";
import { getContactFormOptions, getPartnerContact } from "@/features/contacts/contact-query";
import { getCurrentUserAccess, hasWorkspaceAccess } from "@/lib/auth/access";

export default async function EditPartnerContactPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules.mou?.update) redirect("/mou/contacts");
  const { id } = await params;
  const [contact, options] = await Promise.all([getPartnerContact(id), getContactFormOptions()]);
  if (!contact) notFound();
  return <ContactForm contact={contact} options={options} />;
}
