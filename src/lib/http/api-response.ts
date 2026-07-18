/**
 * Creates consistent JSON success and error responses for route handlers.
 * Called by route files under src/app/api and middleware wrappers.
 * A junior engineer often lets each route invent its own response shape, which
 * makes client hooks harder to reason about and error handling inconsistent.
 */
import { NextResponse } from "next/server";

import { AppError } from "./app-error";

export const ok = <T>(data: T, status = 200) => NextResponse.json(data, { status });

export const created = <T>(data: T) => ok(data, 201);

export const apiError = (error: unknown) => {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
        details: error.details ?? null,
      },
      { status: error.statusCode },
    );
  }

  return NextResponse.json(
    {
      error: "INTERNAL_SERVER_ERROR",
      message: "Something unexpected happened while processing the request.",
    },
    { status: 500 },
  );
};
