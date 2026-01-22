'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

// Radix-based Tabs (Controlled by Radix)
const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500',
      className
    )}
    {...props}
  />
))
TabsList.displayName = 'TabsList'

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = 'TabsTrigger'

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = 'TabsContent'

// Custom Tab Components for more control (Controlled/Uncontrolled modes)
export interface TabItem {
  value: string
  label: string
  disabled?: boolean
  icon?: React.ReactNode
}

export interface CustomTabsProps {
  tabs: TabItem[]
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children?: React.ReactNode
  className?: string
  tabsListClassName?: string
  variant?: 'default' | 'underline' | 'pills'
}

const CustomTabs = React.forwardRef<HTMLDivElement, CustomTabsProps>(
  (
    {
      tabs,
      defaultValue,
      value,
      onValueChange,
      children,
      className,
      tabsListClassName,
      variant = 'default',
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(
      defaultValue || tabs[0]?.value
    )

    const activeValue = value !== undefined ? value : internalValue

    const handleValueChange = (newValue: string) => {
      if (value === undefined) {
        setInternalValue(newValue)
      }
      onValueChange?.(newValue)
    }

    const tabListStyles = {
      default: 'inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500',
      underline: 'inline-flex h-10 items-center border-b border-gray-200',
      pills: 'inline-flex items-center gap-2',
    }

    const tabTriggerStyles = {
      default: cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
        'hover:text-gray-700',
        'disabled:pointer-events-none disabled:opacity-50'
      ),
      underline: cn(
        'inline-flex items-center justify-center whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all',
        '-mb-px hover:border-gray-300 hover:text-gray-700',
        'disabled:pointer-events-none disabled:opacity-50'
      ),
      pills: cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all',
        'hover:bg-gray-100',
        'disabled:pointer-events-none disabled:opacity-50'
      ),
    }

    const activeTabStyles = {
      default: 'bg-white text-gray-900 shadow-sm',
      underline: 'border-blue-500 text-blue-600',
      pills: 'bg-blue-100 text-blue-700',
    }

    return (
      <div ref={ref} className={cn('w-full', className)}>
        <div className={cn(tabListStyles[variant], tabsListClassName)}>
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={activeValue === tab.value}
              aria-controls={`panel-${tab.value}`}
              disabled={tab.disabled}
              onClick={() => handleValueChange(tab.value)}
              className={cn(
                tabTriggerStyles[variant],
                activeValue === tab.value && activeTabStyles[variant]
              )}
            >
              {tab.icon && <span className="mr-2">{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </div>
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child) && child.props.value === activeValue) {
            return child
          }
          return null
        })}
      </div>
    )
  }
)
CustomTabs.displayName = 'CustomTabs'

// Tab Panel for custom tabs
export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const TabPanel = React.forwardRef<HTMLDivElement, TabPanelProps>(
  ({ className, value, children, ...props }, ref) => (
    <div
      ref={ref}
      id={`panel-${value}`}
      role="tabpanel"
      aria-labelledby={`tab-${value}`}
      className={cn('mt-4 focus-visible:outline-none', className)}
      {...props}
    >
      {children}
    </div>
  )
)
TabPanel.displayName = 'TabPanel'

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  CustomTabs,
  TabPanel,
}
