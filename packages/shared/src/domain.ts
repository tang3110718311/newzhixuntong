export const sceneModes = ["voice", "text"] as const;
export type SceneMode = (typeof sceneModes)[number];

export const sceneStatuses = ["draft", "published", "disabled"] as const;
export type SceneStatus = (typeof sceneStatuses)[number];

export const taskStatuses = ["draft", "published", "stopped", "completed"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const industryTypes = ["customer_service", "interviewer", "trainer", "custom"] as const;
export type IndustryType = (typeof industryTypes)[number];

export const defaultTenantCode = "zxt-demo";