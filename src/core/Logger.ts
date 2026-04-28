const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
export type LogLevel = keyof typeof LEVELS;

let CURRENT_LEVEL: number = LEVELS.info;

export function setLogLevel(level: LogLevel): void {
  CURRENT_LEVEL = LEVELS[level];
}

function fmt(tag: string, args: unknown[]): unknown[] {
  return [`[${tag}]`, ...args];
}

export const Logger = {
  debug(tag: string, ...args: unknown[]): void {
    if (CURRENT_LEVEL <= LEVELS.debug) console.debug(...fmt(tag, args));
  },
  info(tag: string, ...args: unknown[]): void {
    if (CURRENT_LEVEL <= LEVELS.info) console.info(...fmt(tag, args));
  },
  warn(tag: string, ...args: unknown[]): void {
    if (CURRENT_LEVEL <= LEVELS.warn) console.warn(...fmt(tag, args));
  },
  error(tag: string, ...args: unknown[]): void {
    if (CURRENT_LEVEL <= LEVELS.error) console.error(...fmt(tag, args));
  },
};
