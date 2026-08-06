import { makeSupabaseMock } from "./harness";

/** Single shared instance so tests and the mocked module reference the same spies. */
export const supabaseMock = makeSupabaseMock();
