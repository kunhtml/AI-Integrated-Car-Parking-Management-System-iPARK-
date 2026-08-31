type LogContext = Record<string, unknown>;

function write(level: "error" | "warn", message: string, context?: LogContext) {
  if (process.env.NODE_ENV === "production") return;

  const payload = context ? [message, context] : [message];
  if (level === "error") {
    console.error(...payload);
  } else {
    console.warn(...payload);
  }
}

export const logger = {
  error(message: string, context?: LogContext) {
    write("error", message, context);
  },
  warn(message: string, context?: LogContext) {
    write("warn", message, context);
  },
};
