'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PricingRule,
  DiscountType,
  CreatePricingRuleRequest,
  UpdatePricingRuleRequest,
  DAY_NAMES,
} from '@/lib/api/pricing'
import { TimeRangePicker, TimePresets } from './TimeRangePicker'

interface PricingRuleFormProps {
  rule?: PricingRule | null
  products?: { id: string; name: string }[]
  onSubmit: (data: CreatePricingRuleRequest | UpdatePricingRuleRequest) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function PricingRuleForm({
  rule,
  products,
  onSubmit,
  onCancel,
  isLoading = false,
}: PricingRuleFormProps) {
  const isEditing = !!rule

  // Form state
  const [name, setName] = useState(rule?.name || '')
  const [description, setDescription] = useState(rule?.description || '')
  const [discountType, setDiscountType] = useState<DiscountType>(
    rule?.discountType || 'PERCENTAGE'
  )
  const [discountValue, setDiscountValue] = useState(
    rule?.discountValue?.toString() || ''
  )
  const [startTime, setStartTime] = useState(rule?.startTime || '17:00')
  const [endTime, setEndTime] = useState(rule?.endTime || '19:00')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    rule?.daysOfWeek || [1, 2, 3, 4, 5] // Default to weekdays
  )
  const [productId, setProductId] = useState<string | undefined>(rule?.productId)
  const [priority, setPriority] = useState(rule?.priority?.toString() || '0')

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!discountValue || parseInt(discountValue) < 1) {
      newErrors.discountValue = 'Discount value must be at least 1'
    }

    if (discountType === 'PERCENTAGE') {
      const value = parseInt(discountValue)
      if (value < 1 || value > 100) {
        newErrors.discountValue = 'Percentage must be between 1 and 100'
      }
    }

    if (!startTime) {
      newErrors.time = 'Start time is required'
    }

    if (!endTime) {
      newErrors.time = 'End time is required'
    }

    if (daysOfWeek.length === 0) {
      newErrors.daysOfWeek = 'Select at least one day'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    const data: CreatePricingRuleRequest = {
      name: name.trim(),
      description: description.trim(),
      discountType,
      discountValue: parseInt(discountValue),
      startTime,
      endTime,
      daysOfWeek,
      priority: parseInt(priority) || 0,
      ...(productId && { productId }),
    }

    await onSubmit(data)
  }

  const toggleDay = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter((d) => d !== day))
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort())
    }
  }

  const selectAllDays = () => {
    setDaysOfWeek([0, 1, 2, 3, 4, 5, 6])
  }

  const selectWeekdays = () => {
    setDaysOfWeek([1, 2, 3, 4, 5])
  }

  const selectWeekends = () => {
    setDaysOfWeek([0, 6])
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700"
        >
          Rule Name *
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Happy Hour, Weekend Special"
          className={cn(
            'mt-1 w-full rounded-lg border py-2 px-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
            errors.name && 'border-red-300'
          )}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700"
        >
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description for this pricing rule"
          rows={2}
          className="mt-1 w-full rounded-lg border py-2 px-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Discount Type & Value */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Discount Type *
          </label>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setDiscountType('PERCENTAGE')}
              className={cn(
                'flex-1 rounded-lg border py-2 px-3 text-sm font-medium transition-colors',
                discountType === 'PERCENTAGE'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 hover:bg-gray-50'
              )}
            >
              Percentage (%)
            </button>
            <button
              type="button"
              onClick={() => setDiscountType('FIXED_AMOUNT')}
              className={cn(
                'flex-1 rounded-lg border py-2 px-3 text-sm font-medium transition-colors',
                discountType === 'FIXED_AMOUNT'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 hover:bg-gray-50'
              )}
            >
              Fixed Amount
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="discountValue"
            className="block text-sm font-medium text-gray-700"
          >
            Discount Value *
          </label>
          <div className="relative mt-1">
            <input
              type="number"
              id="discountValue"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              min={1}
              max={discountType === 'PERCENTAGE' ? 100 : undefined}
              placeholder={discountType === 'PERCENTAGE' ? '20' : '500'}
              className={cn(
                'w-full rounded-lg border py-2 pl-3 pr-12 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                errors.discountValue && 'border-red-300'
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {discountType === 'PERCENTAGE' ? '%' : 'cents'}
            </span>
          </div>
          {errors.discountValue && (
            <p className="mt-1 text-sm text-red-600">{errors.discountValue}</p>
          )}
          {discountType === 'FIXED_AMOUNT' && (
            <p className="mt-1 text-xs text-gray-500">
              Enter amount in cents (e.g., 500 = $5.00)
            </p>
          )}
        </div>
      </div>

      {/* Time Range */}
      <div>
        <TimeRangePicker
          startTime={startTime}
          endTime={endTime}
          onStartTimeChange={setStartTime}
          onEndTimeChange={setEndTime}
          error={errors.time}
        />
        <div className="mt-2">
          <span className="text-xs text-gray-500">Quick presets: </span>
          <TimePresets
            onSelect={(start, end) => {
              setStartTime(start)
              setEndTime(end)
            }}
          />
        </div>
      </div>

      {/* Days of Week */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Days of Week *
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAY_NAMES.map((day, index) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(index)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                daysOfWeek.includes(index)
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-200 hover:bg-gray-50'
              )}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={selectAllDays}
            className="text-xs text-primary hover:underline"
          >
            All days
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={selectWeekdays}
            className="text-xs text-primary hover:underline"
          >
            Weekdays
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={selectWeekends}
            className="text-xs text-primary hover:underline"
          >
            Weekends
          </button>
        </div>
        {errors.daysOfWeek && (
          <p className="mt-1 text-sm text-red-600">{errors.daysOfWeek}</p>
        )}
      </div>

      {/* Product Selection (Optional) */}
      {products && products.length > 0 && (
        <div>
          <label
            htmlFor="productId"
            className="block text-sm font-medium text-gray-700"
          >
            Apply to Product
          </label>
          <select
            id="productId"
            value={productId || ''}
            onChange={(e) => setProductId(e.target.value || undefined)}
            className="mt-1 w-full rounded-lg border py-2 px-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All products</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Leave empty to apply to all products in this stand
          </p>
        </div>
      )}

      {/* Priority */}
      <div>
        <label
          htmlFor="priority"
          className="block text-sm font-medium text-gray-700"
        >
          Priority
        </label>
        <input
          type="number"
          id="priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          min={0}
          className="mt-1 w-full rounded-lg border py-2 px-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-32"
        />
        <p className="mt-1 text-xs text-gray-500">
          Higher priority rules are applied first when multiple rules overlap
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? 'Update Rule' : 'Create Rule'}
        </button>
      </div>
    </form>
  )
}
