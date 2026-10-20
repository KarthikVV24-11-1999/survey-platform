import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Privacy Policy" description="Last updated October 2026" />
      <div className="prose-poll">
        <h3 className="font-semibold">What we store</h3>
        <ul>
          <li>Your name and email from Google or GitHub, or the email or phone number you sign in with.</li>
          <li>Session records, including IP address and browser, to keep you signed in and protect your account.</li>
          <li>The polls you create and the images you upload. Location and other metadata are removed from images.</li>
          <li>Your votes. Only totals are shown, never how a person voted.</li>
        </ul>
        <p>Your phone number and email are never shown publicly. Only your display name appears on your polls.</p>
        <h3 className="font-semibold">Anonymous voting</h3>
        <p>
          When you vote without signing in, we set a random cookie to recognize your browser and store only a keyed
          hash of it, along with a keyed hash of your IP address to limit repeat votes. Your IP address is never stored
          in readable form with a vote.
        </p>
        <h3 className="font-semibold">Service providers</h3>
        <ul>
          <li>Our hosting and database providers store the data above.</li>
          <li>Poll text and images are sent to OpenAI&apos;s moderation service to detect harmful content.</li>
          <li>Twilio sends sign-in codes by text message.</li>
          <li>Cloudflare Turnstile checks for bots.</li>
          <li>Embedded YouTube and Vimeo videos load from those services in their privacy-enhanced modes.</li>
        </ul>
        <h3 className="font-semibold">Your choices</h3>
        <p>
          You can delete your polls and your account at any time. Deleting your account erases your profile and sign-in
          details. Your polls stay up without your name, and your votes remain only as part of the totals. Moderator
          actions are kept in an audit log.
        </p>
        <p>We don&apos;t sell your data or use advertising trackers.</p>
      </div>
    </div>
  );
}
