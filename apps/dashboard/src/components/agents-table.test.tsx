import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AgentsTable } from "./agents-table";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("AgentsTable", () => {
  it("renders agent metrics and sort control", () => {
    render(
      <AgentsTable
        sort="requests"
        agents={[
          {
            agentId: "support-agent",
            firstSeen: "2026-10-01T00:00:00.000Z",
            lastSeen: "2026-10-01T12:00:00.000Z",
            requestCount: 12,
            totalTokens: 3400,
            estimatedCost: 0.002341,
            errorCount: 1,
            averageLatencyMs: 120,
          },
        ]}
      />,
    );

    expect(screen.getByText("support-agent")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort agents")).toBeInTheDocument();
    expect(screen.getByText(/\$0\.002341/)).toBeInTheDocument();
  });
});
