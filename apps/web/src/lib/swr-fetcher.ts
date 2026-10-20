import { fetchWithAuth } from '@/lib/api-client';

/**
 * Fetcher JSON para SWR: usa el cliente autenticado y convierte a JSON,
 * lanzando error en respuestas no-OK para que SWR lo exponga como `error`.
 * Genérico para que cada `useSWR<T>` infiera el tipo de respuesta.
 */
export const jsonFetcher = async <T = unknown>(url: string): Promise<T> => {
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    throw new Error(`Error ${res.status}`);
  }
  return (await res.json()) as T;
};
