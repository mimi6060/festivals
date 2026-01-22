'use client'

import * as React from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
export type SortDirection = 'asc' | 'desc' | null

export interface Column<T> {
  key: string
  header: string | React.ReactNode
  cell?: (row: T, index: number) => React.ReactNode
  sortable?: boolean
  className?: string
  headerClassName?: string
}

export interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  loadingRows?: number
  emptyState?: React.ReactNode
  emptyMessage?: string
  sortColumn?: string | null
  sortDirection?: SortDirection
  onSort?: (column: string, direction: SortDirection) => void
  className?: string
  containerClassName?: string
}

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems?: number
  pageSize?: number
  onPageChange: (page: number) => void
  className?: string
}

// Table Root
const TableRoot = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-sm', className)}
      {...props}
    />
  </div>
))
TableRoot.displayName = 'TableRoot'

// Table Header
const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
))
TableHeader.displayName = 'TableHeader'

// Table Body
const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
))
TableBody.displayName = 'TableBody'

// Table Footer
const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t bg-gray-50/50 font-medium [&>tr]:last:border-b-0',
      className
    )}
    {...props}
  />
))
TableFooter.displayName = 'TableFooter'

// Table Row
const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-gray-200 transition-colors hover:bg-gray-50/50 data-[state=selected]:bg-gray-50',
      className
    )}
    {...props}
  />
))
TableRow.displayName = 'TableRow'

// Table Head Cell
const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-12 px-4 text-left align-middle font-medium text-gray-500 [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
))
TableHead.displayName = 'TableHead'

// Table Cell
const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'p-4 align-middle [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
))
TableCell.displayName = 'TableCell'

// Table Caption
const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-gray-500', className)}
    {...props}
  />
))
TableCaption.displayName = 'TableCaption'

// Skeleton Row for loading state
const TableSkeleton = ({
  columns,
  rows = 5,
}: {
  columns: number
  rows?: number
}) => (
  <>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <TableRow key={rowIndex}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <TableCell key={colIndex}>
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
)
TableSkeleton.displayName = 'TableSkeleton'

// Empty State
const TableEmpty = ({
  colSpan,
  message = 'No data available',
  children,
}: {
  colSpan: number
  message?: string
  children?: React.ReactNode
}) => (
  <TableRow>
    <TableCell colSpan={colSpan} className="h-32 text-center">
      {children || (
        <div className="flex flex-col items-center justify-center text-gray-500">
          <svg
            className="mb-2 h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-sm">{message}</p>
        </div>
      )}
    </TableCell>
  </TableRow>
)
TableEmpty.displayName = 'TableEmpty'

// Sortable Header
interface SortableHeaderProps {
  column: string
  children: React.ReactNode
  sortColumn?: string | null
  sortDirection?: SortDirection
  onSort?: (column: string, direction: SortDirection) => void
  className?: string
}

const SortableHeader = ({
  column,
  children,
  sortColumn,
  sortDirection,
  onSort,
  className,
}: SortableHeaderProps) => {
  const isActive = sortColumn === column
  const direction = isActive ? sortDirection : null

  const handleClick = () => {
    if (!onSort) return

    let newDirection: SortDirection
    if (!isActive || direction === null) {
      newDirection = 'asc'
    } else if (direction === 'asc') {
      newDirection = 'desc'
    } else {
      newDirection = null
    }

    onSort(column, newDirection)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'flex items-center gap-1 hover:text-gray-700',
        isActive && 'text-gray-900',
        className
      )}
    >
      {children}
      <span className="ml-1">
        {!isActive || direction === null ? (
          <ChevronsUpDown className="h-4 w-4" />
        ) : direction === 'asc' ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </span>
    </button>
  )
}
SortableHeader.displayName = 'SortableHeader'

// Complete Table Component
function Table<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  loadingRows = 5,
  emptyState,
  emptyMessage = 'No data available',
  sortColumn,
  sortDirection,
  onSort,
  className,
  containerClassName,
}: TableProps<T>) {
  return (
    <div className={cn('rounded-md border border-gray-200', containerClassName)}>
      <TableRoot className={className}>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={column.headerClassName}
              >
                {column.sortable && onSort ? (
                  <SortableHeader
                    column={column.key}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={onSort}
                  >
                    {column.header}
                  </SortableHeader>
                ) : (
                  column.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableSkeleton columns={columns.length} rows={loadingRows} />
          ) : data.length === 0 ? (
            <TableEmpty colSpan={columns.length} message={emptyMessage}>
              {emptyState}
            </TableEmpty>
          ) : (
            data.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.cell
                      ? column.cell(row, rowIndex)
                      : (row[column.key] as React.ReactNode)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </TableRoot>
    </div>
  )
}
Table.displayName = 'Table'

// Pagination Component
const Pagination = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className,
}: PaginationProps) => {
  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < totalPages

  const startItem = totalItems ? (currentPage - 1) * (pageSize || 10) + 1 : 0
  const endItem = totalItems
    ? Math.min(currentPage * (pageSize || 10), totalItems)
    : 0

  return (
    <div
      className={cn(
        'flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3',
        className
      )}
    >
      <div className="flex flex-1 items-center justify-between sm:hidden">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrevious}
          className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          {totalItems !== undefined && (
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{startItem}</span> to{' '}
              <span className="font-medium">{endItem}</span> of{' '}
              <span className="font-medium">{totalItems}</span> results
            </p>
          )}
        </div>
        <nav
          className="isolate inline-flex -space-x-px rounded-md shadow-sm"
          aria-label="Pagination"
        >
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!canGoPrevious}
            className="relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="sr-only">Previous</span>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          {generatePageNumbers(currentPage, totalPages).map((page, index) =>
            page === '...' ? (
              <span
                key={`ellipsis-${index}`}
                className="relative inline-flex items-center border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page as number)}
                className={cn(
                  'relative inline-flex items-center border px-4 py-2 text-sm font-medium focus:z-20',
                  currentPage === page
                    ? 'z-10 border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                )}
              >
                {page}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canGoNext}
            className="relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="sr-only">Next</span>
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </div>
  )
}
Pagination.displayName = 'Pagination'

// Helper function to generate page numbers with ellipsis
function generatePageNumbers(
  currentPage: number,
  totalPages: number
): (number | string)[] {
  const delta = 1
  const range: (number | string)[] = []

  for (
    let i = Math.max(2, currentPage - delta);
    i <= Math.min(totalPages - 1, currentPage + delta);
    i++
  ) {
    range.push(i)
  }

  if (currentPage - delta > 2) {
    range.unshift('...')
  }
  if (currentPage + delta < totalPages - 1) {
    range.push('...')
  }

  range.unshift(1)
  if (totalPages > 1) {
    range.push(totalPages)
  }

  return range
}

export {
  Table,
  TableRoot,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  TableSkeleton,
  TableEmpty,
  SortableHeader,
  Pagination,
}
