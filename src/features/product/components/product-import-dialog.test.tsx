import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { ProductImportDialog } from "./product-import-dialog";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { importActionMock } = vi.hoisted(() => ({
  importActionMock: vi.fn(),
}));

vi.mock("@/features/product/actions/product.actions", () => ({
  importProductsAction: importActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function csvFile(content: string): File {
  return new File([content], "products.csv", { type: "text/csv" });
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("ProductImportDialog", () => {
  it("renders the dialog with a file input", () => {
    render(<ProductImportDialog organizationId="org-1" onClose={vi.fn()} />);

    expect(
      screen.getByRole("dialog", { name: /import products/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/csv file/i)).toBeInTheDocument();
  });

  it("downloads a sample CSV template", async () => {
    const user = userEvent.setup();
    const createUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:sample");
    const revokeUrl = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<ProductImportDialog organizationId="org-1" onClose={vi.fn()} />);
    await user.click(
      screen.getByRole("button", { name: /download sample csv/i })
    );

    expect(createUrl).toHaveBeenCalledOnce();
    expect(createUrl.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(clickSpy).toHaveBeenCalled();

    createUrl.mockRestore();
    revokeUrl.mockRestore();
    clickSpy.mockRestore();
  });

  it("validates that a file is chosen before importing", async () => {
    const user = userEvent.setup();
    render(<ProductImportDialog organizationId="org-1" onClose={vi.fn()} />);

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
        errors: [{ row: 4, message: 'A product with code "P1" already exists' }],
      },
    });
    const onImported = vi.fn();

    render(
      <ProductImportDialog
        organizationId="org-1"
        onClose={vi.fn()}
        onImported={onImported}
      />
    );

    const input = screen.getByLabelText(/csv file/i);
    await user.upload(input, csvFile("code,name\r\nP1,Widget"));
    await user.click(screen.getByRole("button", { name: /^import$/i }));

    expect(await screen.findByText(/3 created/i)).toBeInTheDocument();
    expect(screen.getByText(/1 skipped/i)).toBeInTheDocument();
    expect(screen.getByText(/Row 4:/)).toBeInTheDocument();
    expect(importActionMock).toHaveBeenCalledWith(
      "org-1",
      "code,name\r\nP1,Widget"
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

    render(<ProductImportDialog organizationId="org-1" onClose={vi.fn()} />);

    await user.upload(screen.getByLabelText(/csv file/i), csvFile("code,name"));
    await user.click(screen.getByRole("button", { name: /^import$/i }));

    expect(await screen.findByText("Not allowed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^import$/i })
    ).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ProductImportDialog organizationId="org-1" onClose={onClose} />);

    await user.click(
      screen.getByRole("button", { name: /close import dialog/i })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose from the cancel button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ProductImportDialog organizationId="org-1" onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
