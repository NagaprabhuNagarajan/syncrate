import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import { SettingsHubView } from "./settings-hub-view";

describe("SettingsHubView", () => {
  it("shows only sections the user has permission for", () => {
    render(
      <SettingsHubView permissions={["role.view", "api_key.view"]} />
    );
    expect(screen.getByText("Roles & Permissions")).toBeInTheDocument();
    expect(screen.getByText("API Keys")).toBeInTheDocument();
    expect(screen.queryByText("Audit Center")).not.toBeInTheDocument();
    expect(screen.queryByText("Team")).not.toBeInTheDocument();
  });

  it("renders all sections for a fully-privileged user", () => {
    render(
      <SettingsHubView
        permissions={[
          "settings.users",
          "settings.branches",
          "role.view",
          "api_key.view",
          "approval.view",
          "webhook.view",
          "workflow.view",
          "audit.view",
        ]}
      />
    );
    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("Branches")).toBeInTheDocument();
    expect(screen.getByText("Roles & Permissions")).toBeInTheDocument();
    expect(screen.getByText("API Keys")).toBeInTheDocument();
    expect(screen.getByText("Approvals")).toBeInTheDocument();
    expect(screen.getByText("Webhooks")).toBeInTheDocument();
    expect(screen.getByText("Workflows")).toBeInTheDocument();
    expect(screen.getByText("Audit Center")).toBeInTheDocument();
  });

  it("renders no section cards when the user lacks every settings permission", () => {
    render(<SettingsHubView permissions={[]} />);
    expect(screen.queryByText("Team")).not.toBeInTheDocument();
    expect(screen.queryByText("Roles & Permissions")).not.toBeInTheDocument();
  });
});
