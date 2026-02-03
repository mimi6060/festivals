/**
 * Logger utility that suppresses logs in production
 * In production, only errors are logged (could be sent to monitoring service)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerOptions {
  service?: string
}

class Logger {
  private service: string
  private isDevelopment: boolean

  constructor(options: LoggerOptions = {}) {
    this.service = options.service || 'admin'
    this.isDevelopment = process.env.NODE_ENV !== 'production'
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString()
    return `[${timestamp}] [${level.toUpperCase()}] [${this.service}] ${message}`
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message), ...args)
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.isDevelopment) {
      console.info(this.formatMessage('info', message), ...args)
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.isDevelopment) {
      console.warn(this.formatMessage('warn', message), ...args)
    }
  }

  error(message: string, error?: unknown): void {
    // Errors are always logged, even in production
    // In production, this could be sent to an error monitoring service
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(this.formatMessage('error', message), errorMessage)

    // Here you could integrate with Sentry, LogRocket, etc.
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(error)
    // }
  }

  // Create a child logger with a different service name
  child(service: string): Logger {
    return new Logger({ service: `${this.service}:${service}` })
  }
}

// Default logger instance
export const logger = new Logger()

// Factory function to create named loggers
export function createLogger(service: string): Logger {
  return new Logger({ service })
}

export default logger
