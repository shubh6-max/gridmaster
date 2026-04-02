import type {
  GridColumnDef,
  GridColumnFactory,
  GridCreateColumnOptions,
  GridRow,
} from "../core/types";
import { titleize } from "../core/utils";

/* =========================================================
   Internal helper
   ========================================================= */

function buildColumn<T extends GridRow>(
  type: GridColumnDef<T>["type"],
  key: string,
  options?: GridCreateColumnOptions<T> & { title?: string }
): GridColumnDef<T> {
  return {
    key,
    title: options?.title ?? titleize(key),
    type,
    ...options,
  };
}

/* =========================================================
   Column factory
   ========================================================= */

export function createColumnFactory<T extends GridRow = GridRow>(): GridColumnFactory<T> {
  return {
    text: (key, options) => buildColumn<T>("text", key, options),

    number: (key, options) =>
      buildColumn<T>("number", key, {
        align: "right",
        ...options,
      }),

    select: (key, options) =>
      buildColumn<T>("select", key, {
        options: options?.options ?? [],
        ...options,
      }),

    checkbox: (key, options) =>
      buildColumn<T>("checkbox", key, {
        align: "center",
        ...options,
      }),

    link: (key, options) => buildColumn<T>("link", key, options),

    date: (key, options) => buildColumn<T>("date", key, options),

    custom: (key, options) => buildColumn<T>("custom", key, options),
  };
}

/* =========================================================
   Default factory export
   ========================================================= */

export const createColumn = createColumnFactory();