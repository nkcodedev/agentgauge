import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiKeysManager } from "./api-keys-manager";

describe("ApiKeysManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a key and shows plaintext once warning", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "k1",
          name: "CI ingest",
          prefix: "ag_test_abcdefgh",
          environment: "test",
          createdAt: "2026-10-01T00:00:00.000Z",
          lastUsedAt: null,
          revokedAt: null,
          apiKey: "ag_test_abcdefghSECRET",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );

    render(<ApiKeysManager initialKeys={[]} />);
    await user.type(screen.getByLabelText(/Name/i), "CI ingest");
    await user.click(screen.getByRole("button", { name: /Create key/i }));

    await waitFor(() => {
      expect(screen.getByText(/Copy this key now/i)).toBeInTheDocument();
    });
    expect(screen.getByText("ag_test_abcdefghSECRET")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/v1/api-keys",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("revokes an active key", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "k1",
          name: "old",
          prefix: "ag_live_prefixxxxx",
          environment: "live",
          createdAt: "2026-10-01T00:00:00.000Z",
          lastUsedAt: null,
          revokedAt: "2026-10-01T01:00:00.000Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(
      <ApiKeysManager
        initialKeys={[
          {
            id: "k1",
            name: "old",
            prefix: "ag_live_prefixxxxx",
            environment: "live",
            createdAt: "2026-10-01T00:00:00.000Z",
            lastUsedAt: null,
            revokedAt: null,
          },
        ]}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: /^Revoke$/i })[0]!);
    await user.click(screen.getByRole("button", { name: /Revoke key/i }));
    await waitFor(() => {
      expect(screen.getByText("Key revoked")).toBeInTheDocument();
      expect(screen.getByText("revoked")).toBeInTheDocument();
    });
  });
});
