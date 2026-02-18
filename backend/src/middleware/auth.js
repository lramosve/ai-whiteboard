import { supabaseConfig } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Verify the JWT token with Supabase
    const user = await supabaseConfig.verifyIdToken(token);
    
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication failed', { error: error.message });
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = await supabaseConfig.verifyIdToken(token);
      req.user = user;
    }
    
    next();
  } catch (error) {
    logger.warn('Optional auth failed', { error: error.message });
    next();
  }
}

export async function checkBoardAccess(req, res, next) {
  try {
    const { boardId } = req.params;
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const board = await supabaseConfig.getBoard(boardId);
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    if (board.ownerId === userId) {
      req.board = board;
      req.userRole = 'owner';
      return next();
    }

    const collaborators = await supabaseConfig.getCollaborators(boardId);
    const collaboration = collaborators.find(c => c.userId === userId);
    
    if (collaboration) {
      req.board = board;
      req.userRole = collaboration.role;
      return next();
    }

    if (board.isPublic) {
      req.board = board;
      req.userRole = 'viewer';
      return next();
    }

    return res.status(403).json({ error: 'Access denied' });
  } catch (error) {
    logger.error('Board access check failed', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

const roleHierarchy = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4
};

export function requireRole(minRole) {
  return (req, res, next) => {
    const userRoleLevel = roleHierarchy[req.userRole] || 0;
    const requiredLevel = roleHierarchy[minRole] || 0;
    
    if (userRoleLevel >= requiredLevel) {
      return next();
    }
    
    return res.status(403).json({ 
      error: 'Insufficient permissions',
      required: minRole,
      current: req.userRole 
    });
  };
}
