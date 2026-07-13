import { Shell } from "@/components/shell";
import { requirePageSession } from "@/lib/auth";
export default async function StudioLayout({ children }: { children: React.ReactNode }) { const session = await requirePageSession(); return <Shell email={session.email}>{children}</Shell>; }
