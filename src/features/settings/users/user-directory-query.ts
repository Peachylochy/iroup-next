import { createClient } from "@/lib/supabase/server";

import type { UserDirectory } from "./user-access";

function isUserDirectory(value: unknown): value is UserDirectory {
  if (!value || typeof value !== "object") return false;
  const directory = value as Partial<UserDirectory>;
  return Array.isArray(directory.users);
}

export async function getUserDirectory(): Promise<UserDirectory> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_user_directory");

  if (error) {
    throw new Error(`Unable to read user directory: ${error.message}`);
  }

  if (!isUserDirectory(data)) {
    throw new Error("Unable to read user directory: invalid response.");
  }

  return data;
}

