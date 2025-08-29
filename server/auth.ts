import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { login } from '../shared/schema';
import { eq } from 'drizzle-orm';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    user?: string;
  }
}

export async function authenticate(user: string, password: string): Promise<boolean> {
  try {
    const [admin] = await db.select().from(login).where(eq(login.user, user));
    
    if (!admin) {
      return false;
    }
    
    const isValid = await bcrypt.compare(password, admin.password);
    return isValid;
  } catch (error) {
    console.error('Authentication error:', error);
    return false;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
}

export function checkAuth(req: Request, res: Response, next: NextFunction) {
  // Permite acesso a algumas rotas sem autenticação
  const publicRoutes = [
    '/api/login', 
    '/api/logout', 
    '/api/auth/status',
    '/api/pix/webhook'  // Webhook do Woovi deve ser público
  ];
  
  if (publicRoutes.includes(req.path)) {
    return next();
  }
  
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  next();
}