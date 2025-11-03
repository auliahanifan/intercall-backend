import { Logtail } from "@logtail/node";
import type { ILogger } from "../../use-cases/interfaces/ILogger.js";

export class LogtailLogger implements ILogger {
  private logtail: Logtail | null = null;

  constructor() {
    const token = process.env.BETTER_STACK_TOKEN;
    const endpoint =
      process.env.BETTER_STACK_ENDPOINT ||
      "https://s1571968.eu-nbg-2.betterstackdata.com";

    if (token) {
      // Initialize Logtail with Better Stack credentials
      this.logtail = new Logtail(token, {
        endpoint,
        sendInterval: 5000, // Batch logs every 5 seconds
      });
    }
  }

  info(message: string, context?: Record<string, any>): void {
    // Always log locally
    console.log(`[INFO] ${message}`, context);
    // Also send to Better Stack if available
    if (this.logtail) {
      this.logtail.info(message, context).catch(() => {
        // Silent fail - don't log Better Stack errors
      });
    }
  }

  warn(message: string, context?: Record<string, any>): void {
    // Always log locally
    console.warn(`[WARN] ${message}`, context);
    // Also send to Better Stack if available
    if (this.logtail) {
      this.logtail.warn(message, context).catch(() => {
        // Silent fail - don't log Better Stack errors
      });
    }
  }

  error(message: string, context?: Record<string, any> | Error): void {
    // Always log locally
    if (context instanceof Error) {
      console.error(`[ERROR] ${message}`, {
        error: context.message,
        stack: context.stack,
      });
    } else {
      console.error(`[ERROR] ${message}`, context);
    }

    // Also send to Better Stack if available
    if (this.logtail) {
      if (context instanceof Error) {
        this.logtail
          .error(message, {
            error: context.message,
            stack: context.stack,
          })
          .catch(() => {
            // Silent fail - don't log Better Stack errors
          });
      } else {
        this.logtail.error(message, context).catch(() => {
          // Silent fail - don't log Better Stack errors
        });
      }
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    // Always log locally
    console.debug(`[DEBUG] ${message}`, context);
    // Also send to Better Stack if available
    if (this.logtail) {
      this.logtail.debug(message, context).catch(() => {
        // Silent fail - don't log Better Stack errors
      });
    }
  }
}
