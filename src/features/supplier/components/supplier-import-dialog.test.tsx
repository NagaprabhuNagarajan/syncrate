import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { SupplierImportDialog } from "./supplier-import-dialog";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { importActionMock } = vi.hoisted(() => ({
  importActionMock: vi.fn(),
}));

vi.mock("@/features/supplier/actions/supplier.actions", () => ({
  importSuppliersAction: importActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function csvFile(content: string): File {
  return new File([content], "suppliers.csv", { type: "text/csv" });
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("SupplierImportDialog", () => {
  it("renders the dialog with a file input", () => {
    render(<SupplierImportDialog organizationId="org-1" onClose={vi.fn()} />);

    expect(
      screen.getByRole("dialog", { name: /import suppliers/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/csv file/i)).toBeInTheDocument();
  });

  it("validates that a file is chosen before importing", async () => {
    const user = userEvent.setup();
    render(<SupplierImportDialog organizationId="org-1" onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^import$/i }));

    expect(
      await screen.findByText(/please choose a csv file/i)
    ).toBeInTheDocument();
    expect(importActionMock).not.toHaveBeenCalled();
  });

  it("reads the file, calls the action, and renders the summary", async () => {
    const user = userEvent.setup();
    importActionMock.mockResolvedValue({
      success: true,
      data: {
        created: 3,
        skipped: 1,
        errors: [
          { row: 4, message: 'A supplier with code "SUPP-1" already exists' },
        ],
      },
    });
    const onImported = vi.fn();

    render(
      <SupplierImportDialog
        organizationId="org-1"
        onClose={vi.fn()}
        onImported={onImported}
      />
    );

    const input = screen.getByLabelText(/csv file/i);
    await user.upload(input, csvFile("code,name\r\nSUPP-1,Acme"));
    await user.click(screen.getByRole("button", { name: /^import$/i }));

    expect(await screen.findByText(/3 created/i)).toBeInTheDocument();
    expect(screen.getByText(/1 skipped/i)).toBeInTheDocument();
    expect(screen.getByText(/Row 4:/)).toBeInTheDocument();
    expect(importActionMock).toHaveBeenCalledWith(
      "org-1",
      "code,name\r\nSUPP-1,Acme"
    );
    expect(onImported).toHaveBeenCalled();

    // After success the Import button is replaced by a Done button.
    expect(
      screen.queryByRole("button", { name: /^import$/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
  });

  it("shows an error when the import action fails", async () => {
    const user = userEvent.setup();
    importActionMock.mockResolvedValue({
      success: false,
      error: { code: "forbidden", message: "Not allowed" },
    });

    render(<SupplierImportDialog organizationId="org-1" onClose={vi.fn()} />);

    await user.upload(screen.getByLabelText(/csv file/i), csvFile("code,name"));
    await user.click(screen.getByRole("button", { name: /^import$/i }));

    expect(await screen.findByText("Not allowed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^import$/i })
    ).toBeInTheDocument();
  });

  it("calls onClose when the close icon button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SupplierImportDialog organizationId="org-1" onClose={onClose} />);

    await user.click(
      screen.getByRole("button", { name: /close import dialog/i })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose from the cancel button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SupplierImportDialog organizationId="org-1" onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
