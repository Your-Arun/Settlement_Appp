require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const shiftingRoutes = require('./routes/shiftingRoutes');
const { restartScheduler } = require('./utils/smsBot');

const app = express();

// Middleware
app.use(cors()); // Allow Mobile to connect
app.use(express.json({ limit: '50mb' })); // Increased limit for Base64 Map Images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ DB Connection Error:', err));

// Routes
app.use('/api', shiftingRoutes);

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on Port ${PORT}`);
  // Start SMS Scheduler
  restartScheduler();
});