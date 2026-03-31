import { Suspense } from "react";
import { InterviewClient } from "./InterviewClient";

export default function InterviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20 text-zinc-500">
          Loading…
        </div>
      }
    >
      <InterviewClient />
    </Suspense>
  );
}
