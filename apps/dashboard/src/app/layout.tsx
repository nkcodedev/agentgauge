import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { LiveEventsProvider } from "@/components/live-events";
import "./globals.css";

export const metadata = {
  title: "AgentGauge",
  description: "Real-time observability and cost intelligence for AI agents",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LiveEventsProvider>
          <div className="mx-auto flex min-h-screen max-w-[1400px]">
            <Sidebar />
            <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">{children}</main>
          </div>
        </LiveEventsProvider>
      </body>
    </html>
  );
}
