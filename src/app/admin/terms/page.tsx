import { TermsManager } from "@/components/admin/terms-manager";
import { PageHeader } from "@/components/ui";
import { listModerationTerms } from "@/server/admin/queries";
import { adminPageGuard } from "@/server/auth/session";

export default async function TermsPage() {
  await adminPageGuard();
  const terms = await listModerationTerms();
  return (
    <div>
      <PageHeader
        title="Word & domain lists"
        description="Words match whole words, ignoring case, accents and common swaps like 0 for o. Domains also match their subdomains."
      />
      <TermsManager terms={terms.map((t) => ({ id: t.id, kind: t.kind, value: t.value, action: t.action }))} />
    </div>
  );
}
