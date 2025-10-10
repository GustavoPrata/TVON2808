import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Request, Response, NextFunction, CookieOptions } from 'express';
import { db } from './db';
import { login, rememberTokens } from '../shared/schema';
import { eq, and, lt, gte } from 'drizzle-orm';

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
    '/api/auth/verify-token', // Endpoint para verificar token de lembrar-me
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

// Constantes para configuração de tokens
const REMEMBER_TOKEN_LENGTH = 32; // Comprimento do token em bytes
const REMEMBER_TOKEN_TTL_DAYS = 30; // Tempo de vida do token em dias

// Função para gerar token seguro
export function generateRememberToken(): string {
  return crypto.randomBytes(REMEMBER_TOKEN_LENGTH).toString('hex');
}

// Função para criar e salvar token de lembrar-me
export async function createRememberToken(userId: number, userAgent?: string, ipAddress?: string): Promise<string> {
  try {
    // Gerar token único
    const plainToken = generateRememberToken();
    
    // Hash do token para armazenar no banco
    const hashedToken = await bcrypt.hash(plainToken, 10);
    
    // Calcular data de expiração (30 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REMEMBER_TOKEN_TTL_DAYS);
    
    // Limpar tokens antigos do usuário
    await db.delete(rememberTokens).where(
      and(
        eq(rememberTokens.userId, userId),
        lt(rememberTokens.expiresAt, new Date())
      )
    );
    
    // Salvar novo token
    await db.insert(rememberTokens).values({
      userId,
      token: hashedToken,
      expiresAt,
      userAgent,
      ipAddress,
    });
    
    return plainToken;
  } catch (error) {
    console.error('Erro ao criar remember token:', error);
    throw error;
  }
}

// Função para validar token de lembrar-me
export async function validateRememberToken(plainToken: string): Promise<{ userId: number; user: string } | null> {
  try {
    // Buscar todos os tokens válidos (não expirados)
    const validTokens = await db.select()
      .from(rememberTokens)
      .where(gte(rememberTokens.expiresAt, new Date()));
    
    // Verificar cada token com bcrypt.compare
    for (const tokenRecord of validTokens) {
      const isValid = await bcrypt.compare(plainToken, tokenRecord.token);
      if (isValid) {
        // Atualizar último uso
        await db.update(rememberTokens)
          .set({ lastUsed: new Date() })
          .where(eq(rememberTokens.id, tokenRecord.id));
        
        // Buscar dados do usuário
        const [user] = await db.select()
          .from(login)
          .where(eq(login.id, tokenRecord.userId));
        
        if (user) {
          return { userId: user.id, user: user.user };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao validar remember token:', error);
    return null;
  }
}

// Função para invalidar tokens de um usuário
export async function invalidateUserTokens(userId: number): Promise<void> {
  try {
    await db.delete(rememberTokens).where(eq(rememberTokens.userId, userId));
  } catch (error) {
    console.error('Erro ao invalidar tokens do usuário:', error);
  }
}

// Função para limpar tokens expirados (pode ser chamada periodicamente)
export async function cleanupExpiredTokens(): Promise<void> {
  try {
    await db.delete(rememberTokens).where(lt(rememberTokens.expiresAt, new Date()));
  } catch (error) {
    console.error('Erro ao limpar tokens expirados:', error);
  }
}

// Configurações de cookie para remember token
export function getRememberTokenCookieOptions(rememberMe: boolean = false): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: rememberMe ? REMEMBER_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000 : undefined, // 30 dias se rememberMe
    path: '/',
  };
}