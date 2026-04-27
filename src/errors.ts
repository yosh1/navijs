export type NavijsErrorCode =
  | "INVALID_STEP"
  | "NO_STEPS"
  | "TARGET_NOT_FOUND"
  | "INVALID_OPTION";

export class NavijsError extends Error {
  readonly code: NavijsErrorCode;

  constructor(code: NavijsErrorCode, message: string) {
    super(`[navijs] ${message}`);
    this.name = "NavijsError";
    this.code = code;
  }
}
