import "./load-env";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { closeDb, db } from "../src/server/db/client";
import { ballotChoices, ballots, pollOptions, polls, user } from "../src/server/db/schema";

// Demo data for local development. Only runs against a localhost database.
type Sample = {
  title: string;
  description: string;
  // [label, votes]
  options: [string, number][];
  closesInHours?: number;
};

const SAMPLES: Sample[] = [
  {
    title: "Tabs or spaces?",
    description: "The eternal question. **Be honest.**",
    options: [["Tabs", 3], ["Spaces", 5], ["Whatever the formatter does", 9]],
  },
  {
    title: "Which feature should we build next?",
    description: "See the [roadmap](https://example.com/roadmap) for details.",
    options: [["Dark mode", 6], ["Mobile app", 4], ["CSV export", 2], ["Comment threads", 7]],
  },
  {
    title: "Best time for the team offsite?",
    description: "",
    options: [["Early June", 4], ["Late August", 2], ["October", 1]],
    closesInHours: 48,
  },
];

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgres://invalid").hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    throw new Error(`Refusing to seed non-local database host "${host}".`);
  }

  const tag = randomUUID().slice(0, 6);
  const voterCount = Math.max(...SAMPLES.map((s) => s.options.reduce((sum, [, n]) => sum + n, 0)));
  const voters = Array.from({ length: voterCount }, (_, i) => ({
    id: randomUUID(),
    name: `Demo voter ${i + 1}`,
    email: `voter${i + 1}.${tag}@demo.test`,
    emailVerified: true,
  }));
  const author = { id: randomUUID(), name: "Demo author", email: `author.${tag}@demo.test`, emailVerified: true };
  await db().insert(user).values([author, ...voters]);

  for (const sample of SAMPLES) {
    await db().transaction(async (tx) => {
      const total = sample.options.reduce((sum, [, n]) => sum + n, 0);
      const [poll] = await tx
        .insert(polls)
        .values({
          authorId: author.id,
          title: sample.title,
          descriptionMd: sample.description,
          status: "published",
          publishedAt: new Date(),
          ballotCount: total,
          closesAt: sample.closesInHours ? new Date(Date.now() + sample.closesInHours * 3_600_000) : null,
        })
        .returning({ id: polls.id });

      let voter = 0;
      for (const [position, [label, count]] of sample.options.entries()) {
        const [option] = await tx
          .insert(pollOptions)
          .values({ pollId: poll.id, position, label, voteCount: count })
          .returning({ id: pollOptions.id });
        for (let n = 0; n < count; n++, voter++) {
          const v = voters[voter];
          const [ballot] = await tx
            .insert(ballots)
            .values({ pollId: poll.id, userId: v.id, voterKey: `u:${v.id}` })
            .returning({ id: ballots.id });
          await tx.insert(ballotChoices).values({ ballotId: ballot.id, optionId: option.id, pollId: poll.id });
        }
      }
      const written = await tx.select({ id: ballots.id }).from(ballots).where(eq(ballots.pollId, poll.id));
      if (written.length !== total) throw new Error("Seed counts out of sync");
    });
  }
  console.log(`Seeded ${SAMPLES.length} polls with ${voterCount} demo voters.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(closeDb);
