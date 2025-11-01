import { Logtail } from "@logtail/node";

let logtail: Logtail | null = null;

// Lazy initialize Logtail only on first use
const getLogtail = () => {
  if (!logtail && process.env.BETTER_STACK_TOKEN) {
    logtail = new Logtail(process.env.BETTER_STACK_TOKEN, {
      endpoint:
        process.env.BETTER_STACK_ENDPOINT ||
        "https://s1571968.eu-nbg-2.betterstackdata.com",
      sendInterval: 5000, // Batch logs every 5 seconds
    });
  }
  return logtail;
};

export const logger = {
  info: (message: string, data?: any) => {
    // Always log locally
    console.log(`[INFO] ${message}`, data);
    // Also send to Logtail if available
    const lt = getLogtail();
    if (lt) {
      lt.info(message, data).catch((err) => {
        // Silent fail - don't log Logtail errors
      });
    }
  },
  error: (message: string, error?: any) => {
    // Always log locally
    console.error(`[ERROR] ${message}`, error);
    // Also send to Logtail if available
    const lt = getLogtail();
    if (lt) {
      lt.error(message, error).catch((err) => {
        // Silent fail - don't log Logtail errors
      });
    }
  },
  warn: (message: string, data?: any) => {
    // Always log locally
    console.warn(`[WARN] ${message}`, data);
    // Also send to Logtail if available
    const lt = getLogtail();
    if (lt) {
      lt.warn(message, data).catch((err) => {
        // Silent fail - don't log Logtail errors
      });
    }
  },
  debug: (message: string, data?: any) => {
    // Always log locally
    console.debug(`[DEBUG] ${message}`, data);
    // Also send to Logtail if available
    const lt = getLogtail();
    if (lt) {
      lt.debug(message, data).catch((err) => {
        // Silent fail - don't log Logtail errors
      });
    }
  },
};

export default getLogtail();
