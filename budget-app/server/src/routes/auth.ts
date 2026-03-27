import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase';
import { config } from '../config';

export const authRouter = Router();

function signAccessToken(payload: { id: string; email: string }): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function signRefreshToken(payload: { id: string; email: string }): string {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn });
}

// POST /auth/register
authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existing) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { data: user, error } = await supabase
    .from('users')
    .insert({ email, password_hash: passwordHash })
    .select('id, email')
    .single();

  if (error || !user) {
    res.status(500).json({ error: 'Failed to create user' });
    return;
  }

  const accessToken = signAccessToken({ id: user.id, email: user.email });
  const refreshToken = signRefreshToken({ id: user.id, email: user.email });

  await supabase.from('refresh_tokens').insert({ user_id: user.id, token: refreshToken });

  res.status(201).json({ accessToken, refreshToken });
});

// POST /auth/login
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, email, password_hash')
    .eq('email', email)
    .single();

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const accessToken = signAccessToken({ id: user.id, email: user.email });
  const refreshToken = signRefreshToken({ id: user.id, email: user.email });

  await supabase.from('refresh_tokens').insert({ user_id: user.id, token: refreshToken });

  res.json({ accessToken, refreshToken });
});

// POST /auth/refresh
authRouter.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token is required' });
    return;
  }

  let decoded: { id: string; email: string };
  try {
    decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as { id: string; email: string };
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  const { data: stored } = await supabase
    .from('refresh_tokens')
    .select('id')
    .eq('token', refreshToken)
    .single();

  if (!stored) {
    res.status(401).json({ error: 'Refresh token not recognized' });
    return;
  }

  const accessToken = signAccessToken({ id: decoded.id, email: decoded.email });
  res.json({ accessToken });
});
