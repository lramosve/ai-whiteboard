import express from 'express';
import { supabaseConfig } from '../config/supabase.js';
import { authenticate, optionalAuth, checkBoardAccess, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/boards
 * Create a new board
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { name, isPublic, settings } = req.body;

  const board = await supabaseConfig.createBoard({
    name: name || 'Untitled Board',
    ownerId: req.user.uid,
    isPublic: isPublic || false,
    settings: settings || {},
  });

  logger.info('Board created', { boardId: board.id, owner: req.user.uid });

  res.status(201).json(board);
}));

/**
 * GET /api/boards
 * Get all boards for current user
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.uid;

  // Get boards owned by user
  const ownedBoards = await supabaseConfig.db
    .collection('boards')
    .where('ownerId', '==', userId)
    .orderBy('updatedAt', 'desc')
    .get();

  // Get boards where user is a collaborator
  const collabSnapshot = await supabaseConfig.db
    .collection('boardCollaborators')
    .where('userId', '==', userId)
    .get();

  const collabBoardIds = collabSnapshot.docs.map(doc => doc.data().boardId);
  
  let sharedBoards = [];
  if (collabBoardIds.length > 0) {
    const sharedSnapshot = await supabaseConfig.db
      .collection('boards')
      .where(supabaseConfig.db.FieldPath.documentId(), 'in', collabBoardIds)
      .get();
    
    sharedBoards = sharedSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      role: 'collaborator',
    }));
  }

  const owned = ownedBoards.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    role: 'owner',
  }));

  res.json({
    owned,
    shared: sharedBoards,
  });
}));

/**
 * GET /api/boards/:boardId
 * Get a specific board
 */
router.get('/:boardId', optionalAuth, checkBoardAccess, asyncHandler(async (req, res) => {
  const board = req.board;
  
  // Get objects
  const objects = await supabaseConfig.getObjects(board.id);
  
  // Get collaborators
  const collaborators = await supabaseConfig.getCollaborators(board.id);

  res.json({
    ...board,
    objects,
    collaborators,
    userRole: req.userRole,
  });
}));

/**
 * PATCH /api/boards/:boardId
 * Update board settings
 */
router.patch(
  '/:boardId',
  authenticate,
  checkBoardAccess,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { name, isPublic, settings } = req.body;
    const boardId = req.params.boardId;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (isPublic !== undefined) updates.isPublic = isPublic;
    if (settings !== undefined) updates.settings = settings;

    await supabaseConfig.updateBoard(boardId, updates);

    logger.info('Board updated', { boardId, userId: req.user.uid });

    const updatedBoard = await supabaseConfig.getBoard(boardId);
    res.json(updatedBoard);
  })
);

/**
 * DELETE /api/boards/:boardId
 * Delete a board
 */
router.delete(
  '/:boardId',
  authenticate,
  checkBoardAccess,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const boardId = req.params.boardId;

    await supabaseConfig.deleteBoard(boardId);

    logger.info('Board deleted', { boardId, userId: req.user.uid });

    res.json({ message: 'Board deleted successfully' });
  })
);

/**
 * POST /api/boards/:boardId/collaborators
 * Add a collaborator to a board
 */
router.post(
  '/:boardId/collaborators',
  authenticate,
  checkBoardAccess,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { userId, role } = req.body;
    const boardId = req.params.boardId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    // Verify user exists
    const user = await supabaseConfig.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const collaborator = await supabaseConfig.addCollaborator(
      boardId,
      userId,
      role || 'editor'
    );

    logger.info('Collaborator added', { boardId, userId, role });

    res.status(201).json(collaborator);
  })
);

/**
 * DELETE /api/boards/:boardId/collaborators/:userId
 * Remove a collaborator from a board
 */
router.delete(
  '/:boardId/collaborators/:userId',
  authenticate,
  checkBoardAccess,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { boardId, userId } = req.params;

    await supabaseConfig.removeCollaborator(boardId, userId);

    logger.info('Collaborator removed', { boardId, userId });

    res.json({ message: 'Collaborator removed successfully' });
  })
);

/**
 * GET /api/boards/:boardId/objects
 * Get all objects on a board
 */
router.get('/:boardId/objects', optionalAuth, checkBoardAccess, asyncHandler(async (req, res) => {
  const objects = await supabaseConfig.getObjects(req.params.boardId);
  res.json(objects);
}));

export default router;
