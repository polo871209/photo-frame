declare const __BUILD_ID__: string;

/** The time of the `vite build` that made this bundle. The client and the worker of one deploy share it. */
export const BUILD_ID = __BUILD_ID__;

/** Every `/api/events` response carries the worker's `BUILD_ID` in this header. */
export const BUILD_HEADER = "Frame-Build";
