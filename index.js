const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const cron = require('node-cron');
const prisma = require('./src/db/prisma');
const env = require('./src/config/env');
const { notFound, errorHandler } = require('./src/middleware/error');
const { rateLimit, commonLimiter } = require('./src/middleware/rateLimit');
const { ensureUploadDir } = require('./src/services/uploads');
const { computeRetirementAlerts, exportAlerts } = require('./src/services/retirement');
const { sendMail } = require('./src/services/mail');
const { logActivity } = require('./src/utils/activity');

// Routers
const authRoutes = require('./src/routes/auth');
const announcementsRoutes = require('./src/routes/announcements');
const employeesRoutes = require('./src/routes/employees');
const employeeEditsRoutes = require('./src/routes/employeeEdits');
const auditQueueRoutes = require('./src/routes/auditQueue');
const newsRoutes = require('./src/routes/news');
const uploadsRoutes = require('./src/routes/uploads');
const lgasRoutes = require('./src/routes/lgas');
const retirementRoutes = require('./src/routes/retirement');
const activityRoutes = require('./src/routes/activity');
const dashboardRoutes = require('./src/routes/dashboard');
const rolesRoutes = require('./src/routes/roles');
const usersRoutes = require('./src/routes/users');

async function main() {
  ensureUploadDir();
  const app = express();

  // Global middleware
  app.use(helmet());
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json());
  app.use(rateLimit(commonLimiter));

  // Static uploads
  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));
  // Static uploads (public static path)
  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

  // Health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // Routes under /api
  app.use('/api/auth', authRoutes);
  app.use('/api/announcements', announcementsRoutes);
  app.use('/api/employees', employeesRoutes);
  app.use('/api/employee-edits', employeeEditsRoutes);
  app.use('/api/audit-queue', auditQueueRoutes);
  app.use('/api/news', newsRoutes);
  app.use('/api/lgas', lgasRoutes);
  app.use('/api/roles', rolesRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api', retirementRoutes); // contains /retirement-alerts endpoints
  app.use('/api', activityRoutes);   // contains /activity-log
  app.use('/api', dashboardRoutes);  // contains /dashboard/notifications

  // 404 and error handler
  app.use(notFound);
  app.use(errorHandler);

  // Cron job: monthly on 1st at 06:00
  cron.schedule('0 6 1 * *', async () => {
    try {
      const alerts = await computeRetirementAlerts();
      const csv = await exportAlerts('csv');
      const supers = await prisma.user.findMany({ where: { role: { in: ['SUPER', 'AUDIT'] } } });
      const to = supers.map((u) => u.email).filter(Boolean);
      if (to.length) {
        await sendMail({
          to,
          subject: 'Monthly Retirement Alerts Report',
          text: 'Attached is the monthly retirement alerts report.',
          attachments: [{ filename: `retirement-alerts-${new Date().toISOString().slice(0,10)}.csv`, content: csv }],
        });
      }
      await logActivity({ action: 'cron_monthly_retirement_report', entityType: 'system', details: { totalAlerts: alerts.length } });
      console.log('[cron] Monthly retirement report sent');
    } catch (e) {
      console.error('[cron] Error generating monthly retirement report', e);
    }
  });

  // Start server
  const server = app.listen(env.PORT, () => {
    console.log(`[server] Listening on port ${env.PORT}`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await prisma.$disconnect();
    server.close(() => process.exit(0));
  });
}

// Connect Prisma before starting
prisma.$connect()
  .then(() => {
    console.log('[prisma] Connected');
    return main();
  })
  .catch((err) => {
    console.error('[prisma] Connection error', err);
    process.exit(1);
  });
