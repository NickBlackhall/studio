import { ReviewQueueClient } from "./review-queue-client";

export default function ReviewQueuePage() {
  return <main className="mx-auto max-w-7xl px-5 py-8">
    <h1 className="text-4xl font-black">Review Queue</h1>
    <p className="mt-2 text-zinc-400">Publish approved candidates into the response deck as inactive cards.</p>
    <ReviewQueueClient />
  </main>;
}
