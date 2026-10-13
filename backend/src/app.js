const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const authRoutes = require('./routes/auth.routes');
const managementRoutes = require('./routes/management.routes');

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'lead-quotation-backend',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', managementRoutes);

app.use((error, req, res, next) => {
  console.error('Unhandled backend error:', error);
  const statusCode = error.statusCode || 500;
  const message = error.message || 'An unexpected error occurred.';

  res.status(statusCode).json({ message });
});

module.exports = app;
