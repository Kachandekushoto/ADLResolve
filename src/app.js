const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { notFound, errorHandler } = require('./middleware/errorHandler');
const { uploadDir } = require('./middleware/upload');

const authRoutes = require('./routes/auth.routes');
const ticketRoutes = require('./routes/tickets.routes');
const categoryRoutes = require('./routes/categories.routes');
const kbRoutes = require('./routes/kb.routes');
const userRoutes = require('./routes/users.routes');

const app = express();
const configuredOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost,http://localhost:8080')
	.split(',')
	.map(origin => origin.trim())
	.filter(Boolean);
const allowedOrigins = [...new Set([
	...configuredOrigins,
	'https://adlresolve.netlify.app',
	'https://adlresolve.pages.dev'
])];
const allowAnyOrigin = allowedOrigins.includes('*');

app.use(helmet());
app.use(cors({
	origin(origin, callback) {
		if (!origin || allowAnyOrigin || allowedOrigins.includes(origin)) return callback(null, true);
		return callback(new Error('Origin is not allowed by CORS.'));
	}
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic brute-force protection on auth endpoints.
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'itresolve-api' }));

app.use('/uploads', express.static(uploadDir));

app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/users', userRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
