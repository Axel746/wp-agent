import "./globals.css";
export const metadata = { title: "WP Agent Studio", description: "Orchestration explicite de Claude et Codex pour WordPress" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fr"><body>{children}</body></html>; }
