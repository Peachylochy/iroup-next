import { notFound, redirect } from "next/navigation";

import { getCurrentUserAccess, hasWorkspaceAccess, roleLabel } from "@/lib/auth/access";
import {
  getLinkedAgreementsForPartner,
  getPartnerContacts,
  getPartnerInteractions,
  getPartnerOrganization,
} from "@/features/partners/partner-query";
import { PartnerDetailView } from "@/features/partners/partner-detail-view";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PartnerDetailPage({ params }: Props) {
  const access = await getCurrentUserAccess();

  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access)) redirect("/pending-access");
  if (!access.modules.mou?.view) redirect("/");

  const { id } = await params;
  const partner = await getPartnerOrganization(id);

  if (!partner) {
    notFound();
  }

  const [agreements, contacts, interactions] = await Promise.all([
    getLinkedAgreementsForPartner(id),
    getPartnerContacts(id),
    getPartnerInteractions(id),
  ]);

  const viewer = {
    displayName: access.profile.display_name,
    email: access.profile.email,
    role: roleLabel(access.roles),
  };

  return (
    <PartnerDetailView
      access={access}
      partner={partner}
      agreements={agreements}
      contacts={contacts}
      interactions={interactions}
      viewer={viewer}
    />
  );
}
