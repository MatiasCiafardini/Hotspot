type QueryError = { message: string; code?: string };
type Page<T> = { data: T[] | null; error: QueryError | null; count?: number | null };
type PagedQuery<T> = {
  range: (from: number, to: number) => PromiseLike<Page<T>>;
};

/** Read every page, including when the API caps pages below the requested size.
 * Callers must supply a fresh query with count: "exact" and a unique ordering.
 * Never return a partial dataset on failure: totals must use complete results.
 */
export async function fetchAllRows<T = any>(query: () => PagedQuery<T>): Promise<Page<T>> {
  const rows: T[] = [];
  const pageSize = 500;
  try {
    for (;;) {
      const { data, error, count } = await query().range(rows.length, rows.length + pageSize - 1);
      if (error) return { data: null, error };
      if (count == null) {
        return {
          data: null,
          error: { message: "La consulta paginada no devolvio el total de registros." },
        };
      }
      if (!data?.length && rows.length < count) {
        return { data: null, error: { message: "No se pudieron cargar todos los registros." } };
      }
      rows.push(...(data ?? []));
      if (rows.length >= count) return { data: rows, error: null, count };
    }
  } catch (error) {
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : "No se pudieron cargar los registros.",
      },
    };
  }
}
