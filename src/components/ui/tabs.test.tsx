import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

describe("Tabs", () => {
  function renderTabs() {
    return render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">First panel</TabsContent>
        <TabsContent value="two">Second panel</TabsContent>
      </Tabs>
    );
  }

  it("renders all triggers", () => {
    renderTabs();
    expect(screen.getByRole("tab", { name: "One" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Two" })).toBeInTheDocument();
  });

  it("shows the default tab content", () => {
    renderTabs();
    expect(screen.getByText("First panel")).toBeInTheDocument();
  });

  it("switches content when another tab is clicked", async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByText("Second panel")).toBeInTheDocument();
  });
});
