declare const __BUILD_ID__: string;

/** The time of the `vite build` that made this bundle. The client and the worker of one deploy share it. */
export const BUILD_ID = __BUILD_ID__;
