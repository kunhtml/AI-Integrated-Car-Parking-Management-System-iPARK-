import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DataTable } from "../components/ui/data-table";

describe("DataTable", () => {
  it("renders the default and custom empty states", () => {
    const { rerender } = render(
      <DataTable headers={["Biển số", "Trạng thái"]} rows={[]} />,
    );

    expect(screen.getByText("Chưa có dữ liệu.")).toBeInTheDocument();
    expect(screen.getByRole("cell")).toHaveAttribute("colspan", "2");

    rerender(
      <DataTable
        headers={["Biển số"]}
        rows={[]}
        emptyMessage="Không tìm thấy phương tiện"
      />,
    );

    expect(screen.getByText("Không tìm thấy phương tiện")).toBeInTheDocument();
  });

  it("activates a clickable row with Enter and Space", () => {
    const onRowClick = jest.fn();
    render(
      <DataTable
        headers={["Biển số"]}
        rows={[["51A-123.45"], ["30A-678.90"]]}
        onRowClick={onRowClick}
      />,
    );

    const rows = screen.getAllByRole("button");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(rows[0], { key: "Enter" });
    fireEvent.keyDown(rows[1], { key: " " });
    fireEvent.keyDown(rows[0], { key: "Escape" });

    expect(onRowClick).toHaveBeenNthCalledWith(1, 0);
    expect(onRowClick).toHaveBeenNthCalledWith(2, 1);
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });
});