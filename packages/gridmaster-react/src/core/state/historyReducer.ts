import type {
  GridHistoryAction,
  GridHistoryState,
  GridColumnDef,
  GridRow,
  GridSnapshot,
  GridCellMeta,
  GridRowMeta,
} from "../types";
import { MAX_HISTORY_SIZE } from "../constants";
import { deepEqual } from "../equality";
import { cloneCellMetaMap, cloneColumns, cloneRowMetaMap, cloneRows } from "../utils";

export type GridHistoryCloneOptions = {
  /**
   * Max undo snapshots kept (newest win). Default 50. `0` or a negative value keeps no undo history;
   * NaN / non-numbers fall back to the default; fractions are floored.
   */
  historyLimit?: number;
  preserveRowReferences?: boolean;
};

/* =========================================================
   Snapshot cloning
   ========================================================= */

export function cloneSnapshot<T extends object = GridRow>(
  snapshot: GridSnapshot<T>,
  options?: GridHistoryCloneOptions
): GridSnapshot<T> {
  return {
    rows: options?.preserveRowReferences
      ? [...(snapshot.rows as T[])]
      : cloneRows(snapshot.rows as T[]),
    columns: cloneColumns(snapshot.columns as GridColumnDef<T>[]),
    cellMeta: cloneCellMetaMap(snapshot.cellMeta),
    rowMeta: cloneRowMetaMap(snapshot.rowMeta),
  };
}

/* =========================================================
   Empty snapshot
   ========================================================= */

export function createEmptySnapshot<T extends object = GridRow>(): GridSnapshot<T> {
  return {
    rows: [],
    columns: [],
    cellMeta: {} as Record<string, GridCellMeta>,
    rowMeta: {} as Record<number, GridRowMeta>,
  };
}

/* =========================================================
   Initial history state
   ========================================================= */

export function createInitialHistoryState<T extends object = GridRow>(
  initialSnapshot?: GridSnapshot<T>,
  options?: GridHistoryCloneOptions
): GridHistoryState<T> {
  const present = initialSnapshot
    ? cloneSnapshot(initialSnapshot, options)
    : createEmptySnapshot<T>();

  return {
    past: [],
    present,
    future: [],
  };
}

/* =========================================================
   History reducer
   ========================================================= */

function resolveHistoryLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || Number.isNaN(limit)) return MAX_HISTORY_SIZE;
  return Math.max(0, Math.floor(limit));
}

/** Newest `limit` entries; `slice(-0)` would return everything, so 0 is handled explicitly. */
function keepNewest<S>(past: S[], limit: number): S[] {
  return limit === 0 ? [] : past.slice(-limit);
}

/** Past stack after archiving `present`; skips the (costly) snapshot clone when nothing is kept. */
function archivePresent<T extends object>(
  state: GridHistoryState<T>,
  limit: number,
  options?: GridHistoryCloneOptions
): GridSnapshot<T>[] {
  return limit === 0 ? [] : keepNewest([...state.past, cloneSnapshot(state.present, options)], limit);
}

export function historyReducer<T extends object = GridRow>(
  state: GridHistoryState<T>,
  action: GridHistoryAction<T>,
  options?: GridHistoryCloneOptions
): GridHistoryState<T> {
  const historyLimit = resolveHistoryLimit(options?.historyLimit);

  switch (action.type) {
    case "RESET": {
      return {
        past: [],
        present: cloneSnapshot(action.payload, options),
        future: [],
      };
    }

    case "PUSH": {
      // Re-applying identical formatting must not burn an undo slot or clear redo (A-104). Rows and
      // columns are compared by reference only (formatting passes the present ones through), so
      // this stays O(meta) instead of O(rows).
      const present = state.present;
      const incoming = action.payload;
      if (
        incoming.rows === present.rows &&
        incoming.columns === present.columns &&
        deepEqual(incoming.cellMeta, present.cellMeta) &&
        deepEqual(incoming.rowMeta, present.rowMeta)
      ) {
        return state;
      }

      return {
        past: archivePresent(state, historyLimit, options),
        present: cloneSnapshot(action.payload, options),
        future: [],
      };
    }

    case "UNDO": {
      if (!state.past.length) return state;

      const previous = state.past[state.past.length - 1];
      const nextPast = state.past.slice(0, -1);

      return {
        past: nextPast,
        present: cloneSnapshot(previous, options),
        future: [cloneSnapshot(state.present, options), ...state.future],
      };
    }

    case "REDO": {
      if (!state.future.length) return state;

      const [next, ...restFuture] = state.future;

      return {
        past: archivePresent(state, historyLimit, options),
        present: cloneSnapshot(next, options),
        future: restFuture.map((snapshot) => cloneSnapshot(snapshot, options)),
      };
    }

    default:
      return state;
  }
}

/* =========================================================
   History helpers
   ========================================================= */

export function canUndo<T extends object = GridRow>(state: GridHistoryState<T>): boolean {
  return state.past.length > 0;
}

export function canRedo<T extends object = GridRow>(state: GridHistoryState<T>): boolean {
  return state.future.length > 0;
}

export function resetHistory<T extends object = GridRow>(
  snapshot: GridSnapshot<T>
): GridHistoryAction<T> {
  return {
    type: "RESET",
    payload: cloneSnapshot(snapshot),
  };
}

export function pushHistory<T extends object = GridRow>(
  snapshot: GridSnapshot<T>
): GridHistoryAction<T> {
  return {
    type: "PUSH",
    payload: cloneSnapshot(snapshot),
  };
}

export function undoHistory<T extends object = GridRow>(): GridHistoryAction<T> {
  return {
    type: "UNDO",
  };
}

export function redoHistory<T extends object = GridRow>(): GridHistoryAction<T> {
  return {
    type: "REDO",
  };
}
