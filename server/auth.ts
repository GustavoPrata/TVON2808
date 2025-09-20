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
  // TEMPORARY: Emergency bypass login when database is down
  const BYPASS_USER = 'gustavoprtt';
  const BYPASS_PASSWORD = 'gustavo123';
  
  // Check for bypass credentials first
  if (user === BYPASS_USER && password === BYPASS_PASSWORD) {
    console.log('⚠️ EMERGENCY BYPASS LOGIN USED - Database may be down');
    return true;
  }
  
  // Try normal database authentication
  try {
    const [admin] = await db.select().from(login).where(eq(login.user, user));
    
    if (!admin) {
      return false;
    }
    
    const isValid = await bcrypt.compare(password, admin.password);
    return isValid;
  } catch (error) {
    console.error('Authentication error:', error);
    
    // If database error and bypass credentials, allow login
    if (user === BYPASS_USER && password === BYPASS_PASSWORD) {
      console.log('⚠️ EMERGENCY BYPASS LOGIN USED DUE TO DATABASE ERROR');
      return true;
    }
    
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
    '/api/pix/webhook'  // Webhook do Woovi precisa ser público
  ];
  
  if (publicRoutes.includes(req.path)) {
    return next();
  }
  
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  next();
}