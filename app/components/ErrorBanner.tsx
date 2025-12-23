"use client";

export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
      {message}
    </div>
  );
}
