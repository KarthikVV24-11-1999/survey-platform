import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Terms of Use" description="Last updated October 2026" />
      <div className="prose-poll">
        <p>By using Survey Platform you agree to these terms.</p>
        <h3 className="font-semibold">Your content</h3>
        <p>
          You are responsible for the polls you post. Don&apos;t post anything illegal, hateful, harassing, sexually
          explicit, violent or spammy, or anything that infringes on someone else&apos;s rights. Polls are checked
          automatically and by moderators, and may be held for review, rejected or removed.
        </p>
        <h3 className="font-semibold">Voting</h3>
        <p>
          Don&apos;t manipulate results, for example with extra accounts, scripts or coordinated fake votes. Results are
          informal and are not a scientific survey.
        </p>
        <h3 className="font-semibold">Accounts</h3>
        <p>
          We may restrict, suspend or ban accounts that break these terms. You can delete your account at any time from
          your account page.
        </p>
        <h3 className="font-semibold">No warranty</h3>
        <p>The service is provided as is, without warranties of any kind.</p>
      </div>
    </div>
  );
}
