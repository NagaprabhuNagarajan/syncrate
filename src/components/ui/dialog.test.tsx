import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/tests/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

describe("Dialog", () => {
  function renderDialog() {
    return render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>Dialog body</DialogDescription>
        </DialogContent>
      </Dialog>
    );
  }

  it("renders the trigger and keeps content closed initially", () => {
    renderDialog();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.queryByText("Dialog Title")).not.toBeInTheDocument();
  });

  it("opens content when the trigger is clicked", () => {
    renderDialog();
    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByText("Dialog Title")).toBeInTheDocument();
    expect(screen.getByText("Dialog body")).toBeInTheDocument();
  });

  it("closes content via the close button", async () => {
    renderDialog();
    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByText("Dialog Title")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByText("Dialog Title")).not.toBeInTheDocument()
    );
  });
});
