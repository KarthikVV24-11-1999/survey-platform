import { auth } from "@/server/auth/auth";

// Better Auth does its own origin checks and rate limiting.
export const GET = (request: Request) => auth().handler(request);
export const POST = (request: Request) => auth().handler(request);
