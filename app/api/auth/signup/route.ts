import { createCustomer } from "@/lib/user-routes";

export async function POST(request: Request): Promise<Response> {
  return createCustomer(request);
}
