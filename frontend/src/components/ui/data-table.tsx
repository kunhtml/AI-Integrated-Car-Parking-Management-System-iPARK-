"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export function DataTable({
  headers,
  rows,
  onRowClick,
  emptyMessage,
}: {
  headers: React.ReactNode[];
  rows: React.ReactNode[][];
  onRowClick?: (rowIndex: number) => void;
  emptyMessage?: React.ReactNode;
}) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = rows.length > 100;
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? rows.length : 0,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });
  const visibleRows = shouldVirtualize
    ? rowVirtualizer.getVirtualItems()
    : rows.map((_, index) => ({ index, key: index, start: 0, size: 0 }));

  return (
    <div
      className="table-wrap"
      ref={tableContainerRef}
      style={shouldVirtualize ? { maxHeight: "70vh", overflow: "auto" } : undefined}
    >
      <table>
        <thead>
          <tr>
            {headers.map((header, idx) => (
              <th key={idx}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody
          style={shouldVirtualize ? { height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" } : undefined}
        >
          {rows.length === 0 ? (
            <tr>
              <td className="data-table-empty" colSpan={headers.length}>
                {emptyMessage ?? "Chưa có dữ liệu."}
              </td>
            </tr>
          ) : visibleRows.map((virtualRow) => {
            const rowIndex = virtualRow.index;
            const row = rows[rowIndex];
            return (
              <tr
                key={rowIndex}
                ref={shouldVirtualize ? rowVirtualizer.measureElement : undefined}
                className={onRowClick ? "clickable-table-row" : undefined}
                onClick={onRowClick ? () => onRowClick(rowIndex) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(rowIndex);
                        }
                      }
                    : undefined
                }
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                style={shouldVirtualize ? {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                } : undefined}
              >
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
