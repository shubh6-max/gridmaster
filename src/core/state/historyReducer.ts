import type {
  GridHistoryAction,
  GridHistoryState,
  GridRow,
  GridSnapshot,
  GridCellMeta,
  GridRowMeta,
} from "../types";
import { MAX_HISTORY_SIZE } from "../constants";
import { cloneRows, cloneCellMetaMap, cloneRowMetaMap } from "../utils";

/* =========================================================
   Snapshot cloning
   ========================================================= */

export function cloneSnapshot<T extends GridRow = GridRow>(
  snapshot: GridSnapshot
): GridSnapshot {
  return {
    rows: cloneRows(snapshot.rows as T[]) as GridRow[],
    cellMeta: cloneCellMetaMap(snapshot.cellMeta),
    rowMeta: cloneRowMetaMap(snapshot.rowMeta),
  };
}

/* =========================================================
   Empty snapshot
   ========================================================= */

export function createEmptySnapshot<T extends GridRow = GridRow>(): GridSnapshot {
  return {
    rows: [] as T[],
    cellMeta: {} as Record<string, GridCellMeta>,
    rowMeta: {} as Record<number, GridRowMeta>,
  };
}

/* =========================================================
   Initial history state
   ========================================================= */

export function createInitialHistoryState<T extends GridRow = GridRow>(
  initialSnapshot?: GridSnapshot
): GridHistoryState {
  const present = initialSnapshot ? cloneSnapshot(initialSnapshot) : createEmptySnapshot<T>();

  return {
    past: [],
    present,
    future: [],
  };
}

/* =========================================================
   History reducer
   ========================================================= */

export function historyReducer(
  state: GridHistoryState,
  action: GridHistoryAction
): GridHistoryState {
  switch (action.type) {
    case "RESET": {
      return {
        past: [],
        present: cloneSnapshot(action.payload),
        future: [],
      };
    }

    case "PUSH": {
      const past = [...state.past, cloneSnapshot(state.present)].slice(-MAX_HISTORY_SIZE);

      return {
        past,
        present: cloneSnapshot(action.payload),
        future: [],
      };
    }

    case "UNDO": {
      if (!state.past.length) return state;

      const previous = state.past[state.past.length - 1];
      const nextPast = state.past.slice(0, -1);

      return {
        past: nextPast,
        present: cloneSnapshot(previous),
        future: [cloneSnapshot(state.present), ...state.future],
      };
    }

    case "REDO": {
      if (!state.future.length) return state;

      const [next, ...restFuture] = state.future;

      return {
        past: [...state.past, cloneSnapshot(state.present)].slice(-MAX_HISTORY_SIZE),
        present: cloneSnapshot(next),
        future: restFuture.map(cloneSnapshot),
      };
    }

    default:
      return state;
  }
}

/* =========================================================
   History helpers
   ========================================================= */

export function canUndo(state: GridHistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: GridHistoryState): boolean {
  return state.future.length > 0;
}

export function resetHistory(snapshot: GridSnapshot): GridHistoryAction {
  return {
    type: "RESET",
    payload: cloneSnapshot(snapshot),
  };
}

export function pushHistory(snapshot: GridSnapshot): GridHistoryAction {
  return {
    type: "PUSH",
    payload: cloneSnapshot(snapshot),
  };
}

export function undoHistory(): GridHistoryAction {
  return {
    type: "UNDO",
  };
}

export function redoHistory(): GridHistoryAction {
  return {
    type: "REDO",
  };
}