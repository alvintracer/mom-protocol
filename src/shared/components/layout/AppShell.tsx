import { Suspense, type ReactNode } from "react";

import { LeftSidebar } from "@/shared/components/layout/LeftSidebar";
import { MobileNav } from "@/shared/components/layout/MobileNav";
import { RightSidebar } from "@/shared/components/layout/RightSidebar";
import { TopBar } from "@/shared/components/layout/TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[88px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px] 2xl:grid-cols-[272px_minmax(0,1fr)_360px]">
        <LeftSidebar />
        <div className="flex min-w-0 flex-col border-x border-border">
          <Suspense fallback={null}>
            <TopBar />
          </Suspense>
          <main className="flex-1 bg-background pb-24 sm:pb-6">
            <div className="mx-auto w-full">{children}</div>
          </main>
        </div>
        <RightSidebar />
      </div>
      <MobileNav />
    </div>
  );
}
