import express from 'express';
import { supabaseConfig } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await supabaseConfig.createUser({
      email,
      password,
      displayName: displayName || email.split('@')[0]
    });

    logger.info('User registered', { uid: user.uid, email: user.email });

    res.json({
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      }
    });
  } catch (error) {
    logger.error('Registration failed', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await supabaseConfig.getUser(req.user.uid);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    logger.error('Get user failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const user = await supabaseConfig.verifyIdToken(token);

    res.json({
      valid: true,
      user: {
        uid: user.uid,
        email: user.email
      }
    });
  } catch (error) {
    logger.error('Token verification failed', { error: error.message });
    res.status(401).json({ 
      valid: false,
      error: 'Invalid token' 
    });
  }
});

export default router;
