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
import { cloneCellMetaMap, cloneColumns, cloneRowMetaMap, cloneRows } from "../utils";

export type GridHistoryCloneOptions = {
  historyLimit?: number;
  preserveRowReferences?: boolean;
};

/* =========================================================
   Snapshot cloning
   ========================================================= */

export function cloneSnapshot<T extends GridRow = GridRow>(
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

export function createEmptySnapshot<T extends GridRow = GridRow>(): GridSnapshot<T> {
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

export function createInitialHistoryState<T extends GridRow = GridRow>(
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

export function historyReducer<T extends GridRow = GridRow>(
  state: GridHistoryState<T>,
  action: GridHistoryAction<T>,
  options?: GridHistoryCloneOptions
): GridHistoryState<T> {
  const historyLimit = options?.historyLimit ?? MAX_HISTORY_SIZE;

  switch (action.type) {
    case "RESET": {
      return {
        past: [],
        present: cloneSnapshot(action.payload, options),
        future: [],
      };
    }

    case "PUSH": {
      const past = [...state.past, cloneSnapshot(state.present, options)].slice(-historyLimit);

      return {
        past,
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
        past: [...state.past, cloneSnapshot(state.present, options)].slice(-historyLimit),
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

export function canUndo<T extends GridRow = GridRow>(state: GridHistoryState<T>): boolean {
  return state.past.length > 0;
}

export function canRedo<T extends GridRow = GridRow>(state: GridHistoryState<T>): boolean {
  return state.future.length > 0;
}

export function resetHistory<T extends GridRow = GridRow>(
  snapshot: GridSnapshot<T>
): GridHistoryAction<T> {
  return {
    type: "RESET",
    payload: cloneSnapshot(snapshot),
  };
}

export function pushHistory<T extends GridRow = GridRow>(
  snapshot: GridSnapshot<T>
): GridHistoryAction<T> {
  return {
    type: "PUSH",
    payload: cloneSnapshot(snapshot),
  };
}

export function undoHistory<T extends GridRow = GridRow>(): GridHistoryAction<T> {
  return {
    type: "UNDO",
  };
}

export function redoHistory<T extends GridRow = GridRow>(): GridHistoryAction<T> {
  return {
    type: "REDO",
  };
}
