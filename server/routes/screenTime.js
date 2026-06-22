const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getTodayUsage, checkLimit, getWeeklyReport } = require('../middleware/screenTime');

const router = express.Router();

// Get current user's screen time status
router.get('/status', authMiddleware, (req, res) => {
  const status = checkLimit(req.user.id);
  res.json(status);
});

// Get weekly report
router.get('/weekly', authMiddleware, (req, res) => {
  const report = getWeeklyReport(req.user.id);
  res.json({ report });
});

module.exports = router;
