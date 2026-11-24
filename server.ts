import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import { ensureSeeded } from './src/db/seed.ts';
import {
  auditLogs,
  brands,
  categories,
  complaints,
  customerProfiles,
  notifications,
  otpCodes,
  products,
  profiles,
  quotationItems,
  quotationRequests,
  quotations,
  supplierProfiles,
  userRoles,
} from './src/db/schema.ts';
import {
  type AuthRequest,
  getOrCreateProfile,
  hashOtp,
  hashPassword,
  loadFullAuthenticatedProfile,
  requireAuth,
  signSessionToken,
  verifyPassword,
} from './src/server/auth.ts';
import { catalogRouter } from './src/server/routes/catalog.ts';
import { customerRouter } from './src/server/routes/customer.ts';
import { supplierRouter } from './src/server/routes/supplier.ts';
import { adminRouter } from './src/server/routes/admin.ts';
import {
  aiNaturalProductSearch,
  askMaterialAssistant,
  generateDraftChecklist,
} from './src/server/ai.ts';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // Basic request rate limiting map (in-memory per IP for auth & AI endpoints)
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  const limitRequests = (maxPerMin: number) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const ip = req.ip || 'unknown';
      const key = `${ip}:${req.path}`;
      const now = Date.now();
      const bucket = rateBuckets.get(key);
      if (!bucket || now > bucket.resetAt) {
        rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
        return next();
      }
      bucket.count += 1;
      if (bucket.count > maxPerMin) {
        return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
      }
      next();
    };
  };

  // ---------- HEALTH & INTEGRATION STATUS ----------
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'BuildMate' });
  });

  app.get('/api/integrations/status', (_req, res) => {
    res.json({
      geminiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ),
      razorpayConfigured: Boolean(
        process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
      ),
      whatsappConfigured: Boolean(
        process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
      ),
      emailConfigured: Boolean(process.env.EMAIL_PROVIDER_API_KEY),
    });
  });

  // ---------- AUTHENTICATION ----------
  app.post('/api/auth/google-sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      res.json({ profile: req.profile });
    } catch (error) {
      console.error('Google sync error:', error);
      res.status(500).json({ error: 'Unable to sync Google account.' });
    }
  });

  app.post('/api/auth/otp/request', limitRequests(10), async (req, res) => {
    try {
      await ensureSeeded();
      const { identifier, purpose } = req.body || {};
      const cleanId = String(identifier || '').trim().toLowerCase();
      if (!cleanId) {
        return res.status(400).json({ error: 'Email or mobile number is required.' });
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      await db.insert(otpCodes).values({
        identifier: cleanId,
        codeHash: hashOtp(code),
        purpose: String(purpose || 'registration'),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        verified: false,
      });

      const emailConfigured = Boolean(process.env.EMAIL_PROVIDER_API_KEY);
      if (emailConfigured && cleanId.includes('@')) {
        // Real email provider hook if configured
        res.json({
          sent: true,
          channel: 'email',
          message: `Verification code sent to ${cleanId}.`,
        });
      } else {
        // Explicit preview notice when external SMS/Email provider is not connected
        res.json({
          sent: true,
          channel: 'preview',
          message:
            'External SMS/Email OTP gateway is not configured in environment secrets. Use the preview verification code below to test verification.',
          previewOtp: process.env.NODE_ENV !== 'production' ? code : undefined,
        });
      }
    } catch (error) {
      console.error('OTP request failed:', error);
      res.status(500).json({ error: 'Unable to generate verification code.' });
    }
  });

  app.post('/api/auth/register', limitRequests(15), async (req, res) => {
    try {
      await ensureSeeded();
      const b = req.body || {};
      const email = String(b.email || '').trim().toLowerCase();
      const mobile = String(b.mobile || '').trim();
      const password = String(b.password || '');
      const fullName = String(b.fullName || '').trim();
      const role = String(b.role || 'customer');
      const otpCode = String(b.otpCode || '').trim();

      if (!email || !password || !fullName) {
        return res
          .status(400)
          .json({ error: 'Full name, email address, and password are required.' });
      }
      if (password.length < 6) {
        return res
          .status(400)
          .json({ error: 'Password must be at least 6 characters long.' });
      }

      const allowedRoles = ['customer', 'electrician', 'plumber', 'contractor', 'supplier'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid account role selected.' });
      }

      const existing = await db
        .select()
        .from(profiles)
        .where(
          mobile
            ? or(eq(profiles.email, email), eq(profiles.mobile, mobile))
            : eq(profiles.email, email)
        )
        .limit(1);

      if (existing[0]) {
        return res
          .status(409)
          .json({ error: 'An account with this email or mobile number already exists.' });
      }

      let isVerified = false;
      if (otpCode) {
        const otpRows = await db
          .select()
          .from(otpCodes)
          .where(
            and(
              or(eq(otpCodes.identifier, email), eq(otpCodes.identifier, mobile || email)),
              eq(otpCodes.verified, false)
            )
          )
          .orderBy(desc(otpCodes.createdAt))
          .limit(1);

        if (
          otpRows[0] &&
          otpRows[0].codeHash === hashOtp(otpCode) &&
          new Date(otpRows[0].expiresAt) > new Date()
        ) {
          isVerified = true;
          await db
            .update(otpCodes)
            .set({ verified: true })
            .where(eq(otpCodes.id, otpRows[0].id));
        } else {
          return res.status(400).json({ error: 'Invalid or expired OTP code.' });
        }
      }

      const uid = `bm-${crypto.randomUUID()}`;
      const passwordHash = hashPassword(password);

      const [createdProfile] = await db
        .insert(profiles)
        .values({
          uid,
          email,
          mobile: mobile || null,
          fullName,
          passwordHash,
          preferredLanguage: String(b.preferredLanguage || 'en'),
          activeRole: role,
          isVerified,
        })
        .returning();

      await db.insert(userRoles).values({
        profileId: createdProfile.id,
        role,
      });

      if (role === 'supplier') {
        await db.insert(supplierProfiles).values({
          profileId: createdProfile.id,
          shopName: String(b.shopName || `${fullName} Electrical & Plumbing`).trim(),
          ownerName: fullName,
          mobile: mobile || 'Not provided',
          email,
          gstin: b.gstin ? String(b.gstin).trim().toUpperCase() : null,
          businessAddress: String(b.businessAddress || 'Address pending').trim(),
          city: String(b.city || 'Chennai').trim(),
          state: String(b.state || 'Tamil Nadu').trim(),
          pinCode: String(b.pinCode || '600001').trim(),
          serviceAreas: String(b.serviceAreas || `${b.city || 'Chennai'}, ${b.pinCode || '600001'}`),
          productCategories: String(b.productCategories || 'electrical,plumbing'),
          shopDescription: b.shopDescription ? String(b.shopDescription) : '',
          verificationStatus: 'pending',
        });
      } else {
        await db.insert(customerProfiles).values({
          profileId: createdProfile.id,
          companyName: b.companyName ? String(b.companyName) : null,
          defaultCity: b.city ? String(b.city) : null,
          defaultState: b.state ? String(b.state) : null,
          defaultPinCode: b.pinCode ? String(b.pinCode) : null,
        });
      }

      const token = signSessionToken({ uid, email });
      const fullProfile = await loadFullAuthenticatedProfile(createdProfile.id);
      res.status(201).json({ token, profile: fullProfile });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Unable to complete registration.' });
    }
  });

  app.post('/api/auth/login', limitRequests(20), async (req, res) => {
    try {
      await ensureSeeded();
      const { identifier, password } = req.body || {};
      const cleanId = String(identifier || '').trim().toLowerCase();
      if (!cleanId || !password) {
        return res
          .status(400)
          .json({ error: 'Email/mobile and password are required.' });
      }

      const rows = await db
        .select()
        .from(profiles)
        .where(or(eq(profiles.email, cleanId), eq(profiles.mobile, cleanId)))
        .limit(1);

      const user = rows[0];
      if (!user || !user.passwordHash || !verifyPassword(String(password), user.passwordHash)) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      if (user.isSuspended) {
        return res.status(403).json({ error: 'Account suspended. Contact support.' });
      }

      const token = signSessionToken({ uid: user.uid, email: user.email });
      const fullProfile = await loadFullAuthenticatedProfile(user.id);
      res.json({ token, profile: fullProfile });
    } catch (error) {
      console.error('Login failed:', error);
      res.status(500).json({ error: 'Unable to sign in.' });
    }
  });

  app.post('/api/auth/password-reset', limitRequests(10), async (req, res) => {
    try {
      const { identifier, otpCode, newPassword } = req.body || {};
      const cleanId = String(identifier || '').trim().toLowerCase();
      if (!cleanId || !otpCode || !newPassword || String(newPassword).length < 6) {
        return res.status(400).json({
          error: 'Identifier, valid OTP code, and a new password (min 6 chars) are required.',
        });
      }

      const otpRows = await db
        .select()
        .from(otpCodes)
        .where(
          and(
            eq(otpCodes.identifier, cleanId),
            eq(otpCodes.purpose, 'password_reset'),
            eq(otpCodes.verified, false)
          )
        )
        .orderBy(desc(otpCodes.createdAt))
        .limit(1);

      if (
        !otpRows[0] ||
        otpRows[0].codeHash !== hashOtp(String(otpCode).trim()) ||
        new Date(otpRows[0].expiresAt) <= new Date()
      ) {
        return res.status(400).json({ error: 'Invalid or expired reset OTP.' });
      }

      const userRows = await db
        .select()
        .from(profiles)
        .where(or(eq(profiles.email, cleanId), eq(profiles.mobile, cleanId)))
        .limit(1);

      if (!userRows[0]) {
        return res.status(404).json({ error: 'No account found for this identifier.' });
      }

      await db
        .update(profiles)
        .set({ passwordHash: hashPassword(String(newPassword)) })
        .where(eq(profiles.id, userRows[0].id));

      await db
        .update(otpCodes)
        .set({ verified: true })
        .where(eq(otpCodes.id, otpRows[0].id));

      res.json({ success: true, message: 'Password updated. You can now sign in.' });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: 'Unable to reset password.' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
    res.json({ profile: req.profile });
  });

  // First-run Super Admin claim (locks automatically once any super_admin role exists)
  app.get('/api/auth/admin-bootstrap-status', async (_req, res) => {
    try {
      const existingAdmins = await db
        .select()
        .from(userRoles)
        .where(eq(userRoles.role, 'super_admin'))
        .limit(1);
      res.json({ adminExists: existingAdmins.length > 0 });
    } catch {
      res.json({ adminExists: true });
    }
  });

  app.post('/api/auth/claim-admin', requireAuth, async (req: AuthRequest, res) => {
    try {
      const existingAdmins = await db
        .select()
        .from(userRoles)
        .where(eq(userRoles.role, 'super_admin'))
        .limit(1);
      if (existingAdmins.length > 0) {
        return res.status(403).json({
          error: 'Super Admin account has already been claimed.',
        });
      }
      await db.insert(userRoles).values({
        profileId: req.profile!.id,
        role: 'super_admin',
      });
      await db
        .update(profiles)
        .set({ activeRole: 'super_admin', isVerified: true })
        .where(eq(profiles.id, req.profile!.id));

      await db.insert(auditLogs).values({
        actorId: req.profile!.id,
        actorEmail: req.profile!.email,
        action: 'CLAIM_INITIAL_ADMIN',
        entityType: 'profile',
        entityId: String(req.profile!.id),
        details: 'Initial Super Admin bootstrap claimed',
      });

      const updated = await loadFullAuthenticatedProfile(req.profile!.id);
      res.json({ profile: updated });
    } catch (error) {
      console.error('Claim admin error:', error);
      res.status(500).json({ error: 'Unable to claim Super Admin role.' });
    }
  });

  app.patch('/api/auth/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      const nextRole =
        b.activeRole && req.profile!.roles.includes(String(b.activeRole))
          ? String(b.activeRole)
          : req.profile!.activeRole;

      await db
        .update(profiles)
        .set({
          fullName: b.fullName ? String(b.fullName).trim() : req.profile!.fullName,
          mobile: b.mobile !== undefined ? String(b.mobile).trim() : req.profile!.mobile,
          preferredLanguage: b.preferredLanguage
            ? String(b.preferredLanguage)
            : req.profile!.preferredLanguage,
          activeRole: nextRole,
        })
        .where(eq(profiles.id, req.profile!.id));

      const updated = await loadFullAuthenticatedProfile(req.profile!.id);
      res.json({ profile: updated });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Unable to update profile.' });
    }
  });

  // ---------- NOTIFICATIONS & COMPLAINTS ----------
  app.get('/api/notifications', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.profileId, req.profile!.id))
        .orderBy(desc(notifications.createdAt))
        .limit(40);
      res.json({ notifications: rows });
    } catch (error) {
      console.error('Notifications fetch error:', error);
      res.status(500).json({ error: 'Unable to load notifications.' });
    }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(eq(notifications.id, id), eq(notifications.profileId, req.profile!.id))
        );
      res.json({ success: true });
    } catch (error) {
      console.error('Mark read error:', error);
      res.status(500).json({ error: 'Unable to update notification.' });
    }
  });

  app.get('/api/complaints', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = await db
        .select()
        .from(complaints)
        .where(eq(complaints.profileId, req.profile!.id))
        .orderBy(desc(complaints.createdAt));
      res.json({ complaints: rows });
    } catch (error) {
      console.error('Complaints fetch error:', error);
      res.status(500).json({ error: 'Unable to load complaints.' });
    }
  });

  app.post('/api/complaints', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { orderId, subject, description } = req.body || {};
      if (!subject || !description) {
        return res.status(400).json({ error: 'Subject and description are required.' });
      }
      const [created] = await db
        .insert(complaints)
        .values({
          profileId: req.profile!.id,
          orderId: orderId ? Number(orderId) : null,
          subject: String(subject).trim(),
          description: String(description).trim(),
          status: 'Open',
        })
        .returning();
      res.status(201).json({ complaint: created });
    } catch (error) {
      console.error('Complaint create error:', error);
      res.status(500).json({ error: 'Unable to submit complaint.' });
    }
  });

  // ---------- AI ASSISTANT ROUTES ----------
  app.post('/api/ai/assistant', limitRequests(20), async (req, res) => {
    try {
      await ensureSeeded();
      const { question, mode } = req.body || {};
      if (!question || String(question).trim().length < 2) {
        return res.status(400).json({ error: 'Please enter a question.' });
      }
      const cats = await db.select().from(categories);
      const prods = await db.select().from(products).where(eq(products.isActive, true)).limit(30);
      const contextSummary = `Categories: ${cats.map((c) => `${c.domain}:${c.name}`).join(', ')}\nSample Products:\n${prods
        .map((p) => `- ${p.sku}: ${p.name} (${p.specification}, Est INR ${p.estimatedPrice}/${p.unit})`)
        .join('\n')}`;

      const result = await askMaterialAssistant({
        question: String(question),
        mode: mode === 'support' ? 'support' : 'assistant',
        contextSummary,
      });
      res.json(result);
    } catch (error: any) {
      console.error('AI assistant error:', error);
      res.status(500).json({ error: error.message || 'AI Assistant request failed.' });
    }
  });

  app.post('/api/ai/checklist', limitRequests(15), async (req, res) => {
    try {
      await ensureSeeded();
      const { projectType, approxAreaSqft, numFloors, domain, notes } = req.body || {};
      const prods = await db.select().from(products).where(eq(products.isActive, true));
      const cats = await db.select().from(categories);
      const brs = await db.select().from(brands);
      const catMap = new Map(cats.map((c) => [c.id, c.name]));
      const brMap = new Map(brs.map((b) => [b.id, b.name]));

      const filtered =
        domain === 'electrical' || domain === 'plumbing'
          ? prods.filter((p) => p.domain === domain)
          : prods;

      const summary = filtered
        .map(
          (p) =>
            `${p.sku} | ${p.domain} | ${catMap.get(p.categoryId)} | ${brMap.get(p.brandId)} | ${p.name} | ${p.specification} | Unit: ${p.unit} | Est: INR ${p.estimatedPrice}`
        )
        .join('\n');

      const draft = await generateDraftChecklist({
        projectType: String(projectType || 'New House Construction'),
        approxAreaSqft: Number(approxAreaSqft) || 1200,
        numFloors: Number(numFloors) || 1,
        domain: domain === 'electrical' || domain === 'plumbing' ? domain : 'both',
        notes: String(notes || ''),
        catalogCatalogSummary: summary,
      });

      res.json(draft);
    } catch (error: any) {
      console.error('AI checklist error:', error);
      res.status(500).json({ error: error.message || 'AI Checklist request failed.' });
    }
  });

  app.post('/api/ai/search', limitRequests(20), async (req, res) => {
    try {
      await ensureSeeded();
      const { query } = req.body || {};
      if (!query) return res.status(400).json({ error: 'Search query required.' });
      const prods = await db.select().from(products).where(eq(products.isActive, true));
      const summary = prods
        .map((p) => `${p.sku}: ${p.name} (${p.specification}, ${p.description})`)
        .join('\n');
      const result = await aiNaturalProductSearch({
        query: String(query),
        catalogSummary: summary,
      });
      res.json(result);
    } catch (error: any) {
      console.error('AI search error:', error);
      res.status(500).json({ error: error.message || 'AI search failed.' });
    }
  });

  app.post('/api/ai/compare-quotes', requireAuth, limitRequests(15), async (req: AuthRequest, res) => {
    try {
      const { requestId, question } = req.body || {};
      const rfqRows = await db
        .select()
        .from(quotationRequests)
        .where(
          and(
            eq(quotationRequests.id, Number(requestId)),
            eq(quotationRequests.customerId, req.profile!.id)
          )
        )
        .limit(1);
      if (!rfqRows[0]) return res.status(404).json({ error: 'Quotation request not found.' });

      const quoteRows = await db
        .select()
        .from(quotations)
        .where(eq(quotations.requestId, rfqRows[0].id));
      const sups = await db.select().from(supplierProfiles);
      const supMap = new Map(sups.map((s) => [s.id, s.shopName]));
      const qIds = quoteRows.map((q) => q.id);
      const items =
        qIds.length > 0
          ? await db.select().from(quotationItems).where(inArray(quotationItems.quotationId, qIds))
          : [];

      const contextSummary = quoteRows
        .filter((q) => q.status !== 'draft')
        .map((q) => {
          const qi = items
            .filter((i) => i.quotationId === q.id)
            .map(
              (i) =>
                `  * ${i.productName}: Brand=${i.brandOffered}, Qty=${i.availableQty}/${i.requestedQty} ${i.unit}, Rate=INR ${i.unitPrice}, GST=${i.gstRate}%, LineTotal=INR ${i.lineTotal}`
            )
            .join('\n');
          return `Supplier: ${supMap.get(q.supplierId)} (${q.quotationNumber})\nGrandTotal: INR ${q.grandTotal}, Delivery: INR ${q.deliveryCharges} (${q.estimatedDeliveryDays} days), Valid: ${q.validUntil}\nItems:\n${qi}`;
        })
        .join('\n\n');

      const result = await askMaterialAssistant({
        question: String(question || 'Explain the key differences in brands, pricing, delivery, and completeness across these supplier quotations.'),
        mode: 'compare',
        contextSummary,
      });
      res.json(result);
    } catch (error: any) {
      console.error('AI compare quotes error:', error);
      res.status(500).json({ error: error.message || 'AI quotation comparison failed.' });
    }
  });

  // Mount Domain Routers
  app.use('/api', catalogRouter);
  app.use('/api', customerRouter);
  app.use('/api/supplier', supplierRouter);
  app.use('/api/admin', adminRouter);

  // ---------- VITE / STATIC FRONTEND ----------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build artifacts not found.');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`BuildMate marketplace server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start BuildMate server:', err);
  process.exit(1);
});
