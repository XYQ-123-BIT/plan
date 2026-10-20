// Shared API types — single source of truth for frontend ↔ backend contracts.
// Define ALL API request/response interfaces here and import them in both
// backend routes and frontend services.

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
