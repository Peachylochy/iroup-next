import { notFound, redirect } from "next/navigation";

import { ContentForm } from "@/features/content-records/content-form";
import { ContentWorkspace } from "@/features/content-records/content-workspace";
import type { ContentModule } from "@/features/content-records/config";
import {
  getContentFormOptions,
  getContentRecord,
  getContentRecords,
} from "@/features/content-records/content-query";
import {
  getCurrentUserAccess,
  hasWorkspaceAccess,
  roleLabel,
} from "@/lib/auth/access";

export async function ContentListPage({
  module,
}: {
  module: ContentModule;
}) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules[module]?.view) redirect("/");

  return (
    <ContentWorkspace
      module={module}
      access={access}
      records={await getContentRecords(module)}
      viewer={{
        displayName: access.profile.display_name,
        email: access.profile.email,
        role: roleLabel(access.roles),
      }}
    />
  );
}

export async function NewContentPage({
  module,
}: {
  module: ContentModule;
}) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules[module]?.create) redirect("/");

  return (
    <ContentForm
      module={module}
      record={null}
      options={await getContentFormOptions()}
    />
  );
}

export async function EditContentPage({
  module,
  id,
}: {
  module: ContentModule;
  id: string;
}) {
  const access = await getCurrentUserAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access) || !access.modules[module]?.update) redirect("/");

  const [record, options] = await Promise.all([
    getContentRecord(module, id),
    getContentFormOptions(),
  ]);
  if (!record) notFound();

  return <ContentForm module={module} record={record} options={options} />;
}
