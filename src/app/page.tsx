import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-indigo-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16 sm:py-24">
        <p className="text-sm font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          AIC prototype
        </p>
        <h1 className="mt-2 font-sans text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Member Insights Interviewer
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          A short, conversational interview about your event experience and how you use AI — with
          adaptive follow-ups instead of a static form.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/interview"
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            Start interview
          </Link>
          <Link
            href="/interview?event=general"
            className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            With event context (general)
          </Link>
        </div>
        <p className="mt-8 text-sm text-zinc-500">
          Team:{" "}
          <Link href="/admin/login" className="text-indigo-600 hover:underline dark:text-indigo-400">
            Admin sign-in
          </Link>
        </p>
      </main>
    </div>
  );
}
