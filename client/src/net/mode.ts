/**
 * True for the static build (GitHub Pages and similar hosts), where there is
 * no Node server. The game server then runs inside the page itself, so one
 * person plays on this device against bots.
 */
export const LOCAL_MODE: boolean = import.meta.env.VITE_LOCAL_MODE === 'true';
