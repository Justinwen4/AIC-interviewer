export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      {children}
    </div>
  );
}
