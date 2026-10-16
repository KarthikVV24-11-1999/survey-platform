import type { Metadata } from "next";
import { Alert, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy" };

// Template, review before launch.
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Privacy Policy" />
      <Alert tone="warn">This is a template. Review it before launch.</Alert>
      <div className="prose-poll">
        <h3 className="font-semibold">What we store</h3>
        <ul>
          <li>Your name and email address from your sign-in provider (Google, GitHub) or the email you sign in with.</li>
          <li>Session records (including IP address and browser user agent) to keep you signed in and to protect accounts.</li>
          <li>The polls you create and the images you upload. Image metadata such as GPS location is removed on upload.</li>
          <li>Your votes. Votes are never shown publicly per person; only totals are displayed.</li>
        </ul>
        <h3 className="font-semibold">Anonymous voting</h3>
        <p>
          When you vote without signing in, we set a random cookie to recognize your browser and store only a keyed
          hash of it, together with a keyed hash of your IP address to limit repeat voting. We never store your IP
          address in readable form for votes.
        </p>
        <h3 className="font-semibold">Service providers</h3>
        <ul>
          <li>Hosting and database providers store the data above.</li>
          <li>Poll text and images are sent to OpenAI&apos;s moderation service to detect harmful content.</li>
          <li>Cloudflare Turnstile is used to check for bots.</li>
          <li>Embedded YouTube/Vimeo videos load from those services (privacy-enhanced modes are used).</li>
        </ul>
        <h3 className="font-semibold">Your choices</h3>
        <p>
          You can delete your polls and your account at any time. When you delete your account, your profile and
          sign-in methods are erased; your polls remain without your name and your votes remain only as anonymous
          totals. Moderator actions are kept in an audit log.
        </p>
        <p>We do not sell your data or use advertising trackers.</p>
      </div>
    </div>
  );
}
