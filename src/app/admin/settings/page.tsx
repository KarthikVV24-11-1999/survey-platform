import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/ui";
import { adminPageGuard } from "@/server/auth/session";
import { getSettings } from "@/server/settings";

export default async function SettingsPage() {
  await adminPageGuard();
  const settings = await getSettings();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Changes apply within a few seconds and are recorded in the audit log." />
      <SettingsForm initial={settings} />
    </div>
  );
}
