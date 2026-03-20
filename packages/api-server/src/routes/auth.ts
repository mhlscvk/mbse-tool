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

// Dummy hash for timing-safe comparisons when user not found
const DUMMY_HASH = '$2a$12$R9h7cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUm';

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
  const normalizedRole = role.toLowerCase();
  return jwt.sign({ userId, role: normalizedRole }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    algorithm: 'HS256',
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
// Does NOT return an accessToken — user must verify email first
router.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    body.email = body.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      // Same response shape as success to prevent email enumeration
      // Attacker can't distinguish "already registered" from "new registration"
      await bcrypt.hash(body.password, 12); // burn time to match timing
      res.status(201).json({ data: { user: { email: body.email }, message: 'Verification email sent. Please check your inbox.' } });
      return;
    }
    const passwordHash = await bcrypt.hash(body.password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const isDev = process.env.NODE_ENV !== 'production';

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash,
        verifyToken: isDev ? null : verifyToken,
        verifyTokenExp: isDev ? null : verifyTokenExp,
        emailVerified: isDev ? true : false,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true, emailVerified: true },
    });

    if (isDev) {
      console.log(`[AUTH] Dev mode: auto-verified user ${body.email}`);
    } else {
      // Send verification email (non-blocking)
      sendVerificationEmail(body.email, verifyToken).catch((err) => {
        console.error('[AUTH] Failed to send verification email:', err.message);
      });
    }

    res.status(201).json({ data: { user, message: isDev ? 'Account created (dev: auto-verified).' : 'Verification email sent. Please check your inbox.' } });
  } catch (err) {
    next(err);
  }
});

// ── Verify email ───────────────────────────────────────────────────────
router.get('/verify', async (req, res, next) => {
  try {
    const token = req.query.token as string;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      res.status(400).json({ error: 'BadRequest', message: 'Invalid token' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { verifyToken: token },
    });

    if (!user || !user.verifyTokenExp || user.verifyTokenExp < new Date()) {
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
router.post('/resend-verify', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user || user.emailVerified) {
      res.json({ data: { message: 'If the email exists and is unverified, a verification link has been sent.' } });
      return;
    }

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken, verifyTokenExp },
    });

    sendVerificationEmail(user.email, verifyToken).catch((err) => {
      console.error('[AUTH] Failed to send verification email:', err.message);
    });

    res.json({ data: { message: 'If the email exists and is unverified, a verification link has been sent.' } });
  } catch (err) {
    next(err);
  }
});

// ── Login ──────────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    body.email = body.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: body.email } });

    // Timing-safe: always run bcrypt even if user not found
    const passwordValid = user?.passwordHash
      ? await bcrypt.compare(body.password, user.passwordHash)
      : await bcrypt.compare(body.password, DUMMY_HASH).then(() => false);

    if (!user || !passwordValid) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
      return;
    }

    if (!user.emailVerified) {
      res.status(403).json({ error: 'Forbidden', message: 'Please verify your email before signing in' });
      return;
    }

    const accessToken = signToken(user.id, user.role);
    const { passwordHash: _, verifyToken: _vt, verifyTokenExp: _ve, resetToken: _rt, resetTokenExp: _re, ...safeUser } = user;
    res.json({ data: { accessToken, user: { ...safeUser, role: safeUser.role.toLowerCase() } } });
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

    if (!email_verified) {
      res.status(401).json({ error: 'Unauthorized', message: 'Google email not verified' });
      return;
    }

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
          emailVerified: true,
        },
      });
    }

    const accessToken = signToken(user.id, user.role);
    const { passwordHash: _, verifyToken: _vt, verifyTokenExp: _ve, resetToken: _rt, resetTokenExp: _re, ...safeUser } = user;
    res.json({ data: { accessToken, user: { ...safeUser, role: safeUser.role.toLowerCase() } } });
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
    res.json({ data: { ...user, role: user.role.toLowerCase() } });
  } catch (err) {
    next(err);
  }
});

// ─── Change Password ─────────────────────────────────────────────────────────

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

router.put('/password', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation', message: parsed.error.issues[0].message });
      return;
    }
    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: 'Not Found', message: 'User not found' }); return; }

    if (!user.passwordHash) {
      res.status(400).json({ error: 'Bad Request', message: 'Account uses Google sign-in. No password to change.' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Unauthorized', message: 'Current password is incorrect' });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });

    res.json({ data: { message: 'Password updated successfully' } });
  } catch (err) {
    next(err);
  }
});

// ─── Forgot Password: Request Reset ──────────────────────────────────────────

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const normalized = email.toLowerCase().trim();

    // Always return same response to prevent email enumeration
    const genericMsg = 'If an account with that email exists, a password reset link has been sent.';

    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (!user || !user.emailVerified || !user.passwordHash) {
      await bcrypt.hash('dummy', 12);
      res.json({ data: { message: genericMsg } });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExp },
    });

    // Send reset email
    const isDev = process.env.NODE_ENV !== 'production';
    const baseUrl = process.env.APP_URL ?? (isDev ? 'http://localhost:5173' : 'https://systemodel.com');
    const resetUrl = `${baseUrl}/login?reset=${resetToken}`;

    if (isDev) {
      console.log(`[AUTH] Dev mode — password reset link for ${user.email}:\n  ${resetUrl}`);
    } else {
      const transporter = getMailTransporter();
      transporter.sendMail({
        from: process.env.SMTP_FROM ?? '"Systemodel" <noreply@systemodel.com>',
        to: user.email,
        subject: 'Reset your Systemodel password',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #569cd6;">Password Reset</h2>
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" style="display: inline-block; background: #0e639c; color: #fff; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold;">
              Reset Password
            </a>
            <p style="color: #888; font-size: 13px; margin-top: 24px;">
              Or copy this link: <br/>${resetUrl}
            </p>
            <p style="color: #888; font-size: 12px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
          </div>
        `,
      }).catch((err) => {
        console.error('[AUTH] Failed to send reset email:', err.message);
      });
    }

    res.json({ data: { message: genericMsg } });
  } catch (err) {
    next(err);
  }
});

// ─── Forgot Password: Reset with Token ───────────────────────────────────────

const resetPasswordSchema = z.object({
  token: z.string().length(64),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation', message: parsed.error.issues[0].message });
      return;
    }
    const { token, newPassword } = parsed.data;

    const user = await prisma.user.findFirst({
      where: { resetToken: token },
    });

    if (!user || !user.resetTokenExp || user.resetTokenExp < new Date()) {
      res.status(400).json({ error: 'Bad Request', message: 'Reset link is invalid or has expired.' });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash, resetToken: null, resetTokenExp: null },
    });

    res.json({ data: { message: 'Password has been reset. You can now sign in.' } });
  } catch (err) {
    next(err);
  }
});

export default router;
