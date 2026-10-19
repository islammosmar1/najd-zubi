/** Supabase keeps non-2xx JSON in error.context, not in data. */
export async function checkoutError(error: unknown, data: unknown): Promise<Error> {
 const message = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object' || !('error' in value)) return;
  return typeof value.error === 'string' && value.error.trim() ? value.error : undefined;
 };
 const direct = message(data);
 if (direct) return new Error(direct);
 if (error && typeof error === 'object' && 'context' in error) {
  const response = error.context;
  if (response instanceof Response) {
   try {
    const detail = message(await response.clone().json());
    if (detail) return new Error(detail);
   } catch { /* Non-JSON gateway responses use the fallback below. */ }
  }
 }
 if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return new Error(error.message);
 return new Error('Checkout failed');
}
