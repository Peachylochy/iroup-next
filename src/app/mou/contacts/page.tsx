import { redirect } from "next/navigation";

import { ContactWorkspace } from "@/features/contacts/contact-workspace";
import { getPartnerContacts } from "@/features/contacts/contact-query";
import { getCurrentUserAccess, hasWorkspaceAccess, roleLabel } from "@/lib/auth/access";

export default async function PartnerContactsPage() {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules.mou?.view) redirect("/");
  const contacts = await getPartnerContacts();
  return (
    <ContactWorkspace
      access={access}
      contacts={contacts}
      viewer={{
        displayName: access.profile.display_name,
        email: access.profile.email,
        role: roleLabel(access.roles),
      }}
    />
  );
}
