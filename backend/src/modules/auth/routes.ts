import { Elysia, t } from 'elysia';
import { db } from '../../db/index.js';

export const authRoutes = new Elysia({ prefix: '/api/auth' })
  .post('/verify', async ({ body, set }) => {
    const { password } = body as any;
    if (!password) {
      set.status = 401;
      return { success: false, message: 'Password required' };
    }

    const roles = db.query(`SELECT * FROM auth_roles`).all() as { role: string, password_hash: string }[];
    
    for (const r of roles) {
      const match = await Bun.password.verify(password, r.password_hash);
      if (match) {
        return { success: true, role: r.role };
      }
    }

    set.status = 401;
    return { success: false, message: 'Invalid password' };
  }, {
    body: t.Object({
      password: t.String()
    })
  });
