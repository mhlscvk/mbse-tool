import { Router, type IRouter } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router: IRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const googleSchema = z.object({
  credential: z.string(),
});

function signToken(userId: string, role: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ userId, role }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  } as jwt.SignOptions);
}

// ── Email transporter ──────────────────────────────────────────────────
function getMailTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendVerificationEmail(email: string, token: string) {
  const baseUrl = process.env.APP_URL ?? 'https://systemodel.com';
  const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}`;
  const transporter = getMailTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? '"Systemodel" <noreply@systemodel.com>',
    to: email,
    subject: 'Verify your Systemodel account',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #569cd6;">Welcome to Systemodel</h2>
        <p>Click the button below to verify your email address:</p>
        <a href="${verifyUrl}" style="display: inline-block; background: #0e639c; color: #fff; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold;">
          Verify Email
        </a>
        <p style="color: #888; font-size: 13px; margin-top: 24px;">
          Or copy this link: <br/>${verifyUrl}
        </p>
        <p style="color: #888; font-size: 12px;">This link expires in 24 hours.</p>
      </div>
    `,
  });
}

// ── Google OAuth client ────────────────────────────────────────────────
function getGoogleClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured');
  return new OAuth2Client(clientId);
}

// ── Register ───────────────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      res.status(409).json({ error: 'Conflict', message: 'Email already registered' });
      return;
    }
    const passwordHash = await bcrypt.hash(body.password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash,
        verifyToken,
        verifyTokenExp,
        emailVerified: false,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true, emailVerified: true },
    });

    // Send verification email (non-blocking)
    sendVerificationEmail(body.email, verifyToken).catch((err) => {
      console.error('[AUTH] Failed to send verification email:', err.message);
    });

    const accessToken = signToken(user.id, user.role);
    res.status(201).json({ data: { accessToken, user } });
  } catch (err) {
    next(err);
  }
});

// ── Verify email ───────────────────────────────────────────────────────
router.get('/verify', async (req, res, next) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      res.status(400).json({ error: 'BadRequest', message: 'Missing token' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { verifyToken: token },
    });

    if (!user || !user.verifyTokenExp || user.verifyTokenExp < new Date()) {
      // Redirect to login with error
      const baseUrl = process.env.APP_URL ?? 'https://systemodel.com';
      res.redirect(`${baseUrl}/login?verified=expired`);
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verifyToken: null, verifyTokenExp: null },
    });

    const baseUrl = process.env.APP_URL ?? 'https://systemodel.com';
    res.redirect(`${baseUrl}/login?verified=success`);
  } catch (err) {
    next(err);
  }
});

// ── Resend verification email ──────────────────────────────────────────
router.post('/resend-verify', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: 'Not Found', message: 'User not found' }); return; }
    if (user.emailVerified) { res.json({ data: { message: 'Email already verified' } }); return; }

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken, verifyTokenExp },
    });

    await sendVerificationEmail(user.email, verifyToken);
    res.json({ data: { message: 'Verification email sent' } });
  } catch (err) {
    next(err);
  }
});

// ── Login ──────────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.passwordHash || !(await bcrypt.compare(body.password, user.passwordHash))) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
      return;
    }
    if (!user.emailVerified) {
      res.status(403).json({ error: 'Forbidden', message: 'Please verify your email before logging in' });
      return;
    }
    const accessToken = signToken(user.id, user.role);
    const { passwordHash: _, verifyToken: _vt, verifyTokenExp: _ve, ...safeUser } = user;
    res.json({ data: { accessToken, user: safeUser } });
  } catch (err) {
    next(err);
  }
});

// ── Google OAuth ───────────────────────────────────────────────────────
router.post('/google', async (req, res, next) => {
  try {
    const { credential } = googleSchema.parse(req.body);
    const client = getGoogleClient();
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid Google token' });
      return;
    }

    const { sub: googleId, email, name, email_verified } = payload;

    // Find by googleId or email
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (user) {
      // Link Google account if not linked yet
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, emailVerified: true },
        });
      }
    } else {
      // Create new user — Google-verified, no password
      user = await prisma.user.create({
        data: {
          email: email!,
          name: name ?? email!,
          googleId,
          emailVerified: email_verified ?? true,
        },
      });
    }

    const accessToken = signToken(user.id, user.role);
    const { passwordHash: _, verifyToken: _vt, verifyTokenExp: _ve, ...safeUser } = user;
    res.json({ data: { accessToken, user: safeUser } });
  } catch (err) {
    next(err);
  }
});

// ── Me ─────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, role: true, createdAt: true, emailVerified: true },
    });
    if (!user) { res.status(404).json({ error: 'Not Found', message: 'User not found' }); return; }
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

export default router;
