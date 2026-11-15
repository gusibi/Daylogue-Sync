// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      isAdmin: boolean;
    }
    // interface PageData {}
    // interface PageState {}
    interface Platform {
      env: {
        DB: D1Database;
        BLOBS: R2Bucket;
        ADMIN_KEY?: string;
        SESSION_SECRET?: string;
      };
      context: ExecutionContext;
      caches: CacheStorage;
    }
  }
}

export {};
