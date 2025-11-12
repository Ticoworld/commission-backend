const { PrismaClient } = require('@prisma/client');

// Global cache (Node.js keeps module cache between hot reloads, but we add an extra guard)
const globalForPrisma = global;

// Ensure URL includes desired connection_limit (default 5) and sslmode=require, but
// DO NOT force a higher connection limit if one is already set.
function withConnectionLimit(url, defaultLimit = Number(process.env.PRISMA_CONN_LIMIT || 5)) {
	if (!url) return url;
	try {
		const u = new URL(url);
		if (!u.protocol.startsWith('postgres')) return url;
		const sp = u.searchParams;
		// Only set if missing; don't increase an existing lower cap
		if (!sp.get('connection_limit')) {
			sp.set('connection_limit', String(defaultLimit));
		}
		// Ensure SSL when not specified
		if (!sp.get('sslmode')) {
			sp.set('sslmode', 'require');
		}
		u.search = sp.toString();
		return u.toString();
	} catch {
		return url; // silently fall back to original
	}
}

const dsUrl = withConnectionLimit(process.env.DATABASE_URL);

const prisma =
	globalForPrisma.prisma ||
	new PrismaClient({
		datasources: { db: { url: dsUrl } },
	});

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}

module.exports = prisma;