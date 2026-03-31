export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-950 antialiased [color-scheme:light]">
      {children}
    </div>
  );
}
