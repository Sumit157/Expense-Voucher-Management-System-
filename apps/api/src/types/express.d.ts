import type { AuthUser } from '../modules/auth/auth-service.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Populated by `requireAuth` after a valid session is resolved. */
    auth?: AuthUser;
  }
}
