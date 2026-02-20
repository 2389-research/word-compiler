import { ProjectStore } from "./project.svelte.js";

export const store = new ProjectStore();

export { type ApiActions, createApiActions } from "./api-actions.js";
export { setupCompilerEffect } from "./compiler.svelte.js";
export { createGenerationActions } from "./generation.svelte.js";
export { ProjectStore, type SceneEntry } from "./project.svelte.js";
export { initializeApp, loadProject, type StartupResult } from "./startup.js";
