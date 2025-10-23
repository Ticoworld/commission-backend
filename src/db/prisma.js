const { PrismaClient } = require('@prisma/client');

function withConnectionLimit(url, minLimit = 10) {
	try {
		const u = new URL(url);
		// Only apply to postgres
		if (!u.protocol.startsWith('postgres')) return url;
		const sp = u.searchParams;
			const current = sp.get('connection_limit');
			if (!current) {
				sp.set('connection_limit', String(minLimit));
			} else if (Number.parseInt(current, 10) < minLimit) {
				sp.set('connection_limit', String(minLimit));
			}
			u.search = sp.toString();
			return u.toString();
	} catch {
		return url;
	}
}

const dsUrl = withConnectionLimit(process.env.DATABASE_URL || '');
const prisma = new PrismaClient({ datasources: { db: { url: dsUrl } } });

module.exports = prisma;