import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

describe("Table", () => {
  it("renders a full table composition", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Acme</TableCell>
            <TableCell>100</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Name" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Amount" })
    ).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Acme" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "100" })).toBeInTheDocument();
  });
});
