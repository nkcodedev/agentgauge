import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { LiveEventsProvider } from "@/components/live-events";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata = {
  title: "AgentGauge",
  description: "Real-time observability and cost intelligence for AI agents",
};

function dashboardEnvironment(): "live" | "test" {
  const key = process.env.AGENTGAUGE_API_KEY ?? "";
  return key.startsWith("ag_test") ? "test" : "live";
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const environment = dashboardEnvironment();
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("ag-theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.dataset.theme="dark";else if(t==="light")document.documentElement.dataset.theme="light";}catch(e){}`,
          }}
        />
      </head>
      <body
        style={{
          ["--font-sans" as string]:
            "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif",
          ["--font-mono" as string]: "var(--font-jetbrains), ui-monospace, monospace",
        }}
      >
        <LiveEventsProvider>
          <div className="flex min-h-screen">
            <Sidebar environment={environment} />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <main className="min-w-0 flex-1 px-4 py-6 md:px-6">{children}</main>
            </div>
          </div>
        </LiveEventsProvider>
      </body>
    </html>
  );
}
