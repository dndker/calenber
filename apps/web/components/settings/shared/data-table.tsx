"use client"

import { useDebugTranslations } from "@/components/provider/i18n-debug-provider"
import {
    type ColumnDef,
    type ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    type PaginationState,
    type Row,
    type RowSelectionState,
    type Table as TanstackTable,
    useReactTable,
} from "@tanstack/react-table"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@workspace/ui/components/table"
import { type ReactNode, useState } from "react"

export type DataTableColumnMeta = {
    headClassName?: string
    cellClassName?: string
}

type DataTableProps<TData, TValue> = {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    emptyMessage?: string
    filterColumnId?: string
    filterPlaceholder?: string
    pageSize?: number
    toolbarActions?: (table: TanstackTable<TData>) => ReactNode
    toolbarContent?: ReactNode
    bulkActions?: (table: TanstackTable<TData>) => ReactNode
    enableRowSelection?: boolean | ((row: Row<TData>) => boolean)
    getRowId?: (originalRow: TData, index: number) => string
}

function getColumnMeta<TData, TValue>(
    columnDef: ColumnDef<TData, TValue>
): DataTableColumnMeta | undefined {
    return columnDef.meta as DataTableColumnMeta | undefined
}

export function DataTable<TData, TValue>({
    columns,
    data,
    emptyMessage,
    filterColumnId,
    filterPlaceholder,
    pageSize = 5,
    toolbarActions,
    toolbarContent,
    bulkActions,
    enableRowSelection = true,
    getRowId,
}: DataTableProps<TData, TValue>) {
    const t = useDebugTranslations("settings.dataTable")
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize,
    })

    // TanStack Table manages mutable table instance APIs by design.
    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns,
        getRowId,
        enableRowSelection,
        autoResetPageIndex: false,
        onRowSelectionChange: setRowSelection,
        onColumnFiltersChange: setColumnFilters,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        state: {
            rowSelection,
            columnFilters,
            pagination,
        },
    })

    return (
        <div className="space-y-4">
            {(filterColumnId || toolbarActions || bulkActions) && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {filterColumnId ? (
                        <Input
                            value={
                                (table
                                    .getColumn(filterColumnId)
                                    ?.getFilterValue() as string) ?? ""
                            }
                            onChange={(event) =>
                                table
                                    .getColumn(filterColumnId)
                                    ?.setFilterValue(event.target.value)
                            }
                            placeholder={
                                filterPlaceholder ?? t("filterPlaceholder")
                            }
                            className="w-full max-w-sm"
                        />
                    ) : (
                        <div />
                    )}
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {toolbarActions?.(table)}
                        {bulkActions?.(table)}
                    </div>
                </div>
            )}

            {toolbarContent}

            <div className="overflow-hidden rounded-xl border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className={cn(
                                            "px-3.5",
                                            getColumnMeta(
                                                header.column.columnDef
                                            )?.headClassName
                                        )}
                                        data-name={headerGroup.id}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef
                                                      .header,
                                                  header.getContext()
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={
                                        row.getIsSelected() && "selected"
                                    }
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className={cn(
                                                "px-3.5",
                                                getColumnMeta(
                                                    cell.column.columnDef
                                                )?.cellClassName
                                            )}
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    {emptyMessage ?? t("emptyMessage")}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                    {t("selectedCount", {
                        selected: table.getFilteredSelectedRowModel().rows
                            .length,
                        total: table.getFilteredRowModel().rows.length,
                    })}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        {t("previous")}
                    </Button>
                    <div className="text-sm text-muted-foreground">
                        {table.getState().pagination.pageIndex + 1} /{" "}
                        {Math.max(table.getPageCount(), 1)}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        {t("next")}
                    </Button>
                </div>
            </div>
        </div>
    )
}
