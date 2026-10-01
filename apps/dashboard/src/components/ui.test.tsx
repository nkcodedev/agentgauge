import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState, KpiCard, StatusPill } from "@/components/ui";
import { formatCost } from "@/lib/format";

describe("dashboard UI", () => {
  it("renders KPI values", () => {
    render(<KpiCard label="Requests" value="12" />);
    expect(screen.getByText("Requests")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(
      <EmptyState title="No telemetry yet">
        <p>Install AgentGauge</p>
      </EmptyState>,
    );
    expect(screen.getByText("No telemetry yet")).toBeInTheDocument();
    expect(screen.getByText("Install AgentGauge")).toBeInTheDocument();
  });

  it("renders status pills", () => {
    render(<StatusPill status="error" />);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("does not render unknown cost as $0", () => {
    expect(formatCost(null)).toBe("Cost unavailable");
  });
});
