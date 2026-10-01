import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ModelPricingRow } from "@/lib/api-client";
import { ModelPricingManager } from "./model-pricing-manager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/settings/model-pricing",
}));

const filters = { provider: "", status: "", source: "", q: "" };

function row(
  partial: Partial<ModelPricingRow> & Pick<ModelPricingRow, "id" | "model">,
): ModelPricingRow {
  return {
    provider: "openai",
    inputPricePerMillion: "0.15",
    outputPricePerMillion: "0.6",
    currency: "USD",
    effectiveFrom: "2024-01-01T00:00:00.000Z",
    effectiveTo: null,
    source: "seed",
    kind: "agentgauge_default",
    status: "active",
    ...partial,
  };
}

describe("ModelPricingManager", () => {
  it("shows an empty state", () => {
    render(<ModelPricingManager rows={[]} initialFilters={filters} />);
    expect(screen.getByText("No model pricing configured.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add model pricing" }).length).toBeGreaterThan(0);
  });

  it("filters by model search and shows source badges", async () => {
    const user = userEvent.setup();
    render(
      <ModelPricingManager
        initialFilters={filters}
        rows={[
          row({ id: "a", model: "gpt-4o-mini" }),
          row({
            id: "b",
            provider: "acme",
            model: "widget-x",
            kind: "custom",
            source: "custom",
            inputPricePerMillion: "1.5",
            outputPricePerMillion: "3",
          }),
        ]}
      />,
    );
    const table = screen.getByRole("table");
    expect(within(table).getByText("AgentGauge default")).toBeInTheDocument();
    expect(within(table).getByText("Custom")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search models"), "widget");
    expect(screen.queryByText("gpt-4o-mini")).not.toBeInTheDocument();
    expect(screen.getByText("widget-x")).toBeInTheDocument();
  });

  it("validates the add dialog and shows a save error", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "An active pricing period already overlaps this model." },
        }),
        {
          status: 409,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    render(<ModelPricingManager rows={[]} initialFilters={filters} />);
    await user.click(screen.getAllByRole("button", { name: "Add model pricing" })[0]!);
    const dialog = within(screen.getByRole("dialog", { name: "Add model pricing" }));
    await user.type(dialog.getByLabelText("Provider"), "acme");
    await user.type(dialog.getByLabelText("Model"), "widget");
    await user.type(dialog.getByLabelText("Input price / 1M"), "-1");
    await user.type(dialog.getByLabelText("Output price / 1M"), "1");
    await user.click(dialog.getByRole("button", { name: "Add pricing" }));
    expect(screen.getByText("Price must be a non-negative decimal.")).toBeInTheDocument();

    await user.clear(dialog.getByLabelText("Input price / 1M"));
    await user.type(dialog.getByLabelText("Input price / 1M"), "1.5");
    await user.click(dialog.getByRole("button", { name: "Add pricing" }));
    expect(
      await screen.findByText("An active pricing period already overlaps this model."),
    ).toBeInTheDocument();
  });

  it("opens update pricing and history", async () => {
    const user = userEvent.setup();
    render(
      <ModelPricingManager
        initialFilters={filters}
        rows={[
          row({
            id: "old",
            provider: "acme",
            model: "widget",
            kind: "custom",
            source: "custom",
            status: "historical",
            effectiveTo: "2090-06-01T00:00:00.000Z",
            inputPricePerMillion: "1",
            outputPricePerMillion: "2",
          }),
          row({
            id: "new",
            provider: "acme",
            model: "widget",
            kind: "custom",
            source: "custom",
            status: "active",
            effectiveFrom: "2090-06-01T00:00:00.000Z",
            inputPricePerMillion: "3",
            outputPricePerMillion: "4",
          }),
        ]}
      />,
    );
    expect(screen.getAllByRole("button", { name: "Update pricing" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Update pricing" }));
    expect(screen.getByRole("dialog", { name: "Update pricing" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getAllByRole("button", { name: "History" })[0]!);
    const history = screen.getByRole("dialog", { name: "Pricing history" });
    expect(history).toBeInTheDocument();
    expect(within(history).getByText("acme / widget")).toBeInTheDocument();
    expect(within(history).getByText("Historical")).toBeInTheDocument();
  });
});
