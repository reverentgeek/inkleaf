import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error("Error:", err.message);
  console.error(err.stack);

  // Keep driver/Atlas details (hostnames, cluster names, credentials in
  // connection errors) out of the response body — the full error is logged.
  res.status(500).json({
    error: "Internal server error",
  });
}
