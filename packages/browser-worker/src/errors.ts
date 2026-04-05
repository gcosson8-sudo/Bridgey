import type { BridgeyErrorBody, BridgeyErrorCode } from "@bridgey/contracts";

export class BridgeyError extends Error {
  public readonly code: BridgeyErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  public constructor(
    code: BridgeyErrorCode,
    statusCode: number,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = "BridgeyError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  public toResponseBody(): BridgeyErrorBody {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
}

