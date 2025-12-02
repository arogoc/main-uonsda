import express from 'express';
import * as memberController from '../controllers/member.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * @route   POST /api/members
 * @desc    Register a new member (Public registration)
 * @access  Public
 */
router.post('/', memberController.createMember);

// ============================================
// PROTECTED ROUTES (Require Authentication)
// ============================================

/**
 * @route   GET /api/members
 * @desc    Get all members with optional filters
 * @access  Private (All authenticated admins)
 */
router.get('/', authenticate, memberController.getAllMembers);

/**
 * @route   GET /api/members/stats/overview
 * @desc    Get member statistics
 * @access  Private (All authenticated admins)
 */
router.get('/stats/overview', authenticate, memberController.getMemberStats);

/**
 * @route   GET /api/members/:id
 * @desc    Get single member by ID
 * @access  Private (All authenticated admins)
 */
router.get('/:id', authenticate, memberController.getMemberById);

/**
 * @route   PUT /api/members/:id
 * @desc    Update member information
 * @access  Private (ELDER: all fields, CLERK: basic info only)
 */
router.put('/:id', authenticate, memberController.updateMember);


/** * @route   GET /api/members/:id
 * @desc    Get single member by ID
 * @access  Private (All authenticated admins)
 */
router.get('/:id', authenticate, memberController.getMemberById);

/**
 * @route   DELETE /api/members/:id
 * @desc    Delete a member
 * @access  Private (ELDER only)
 */
router.delete('/:id', authenticate, authorize('ELDER'), memberController.deleteMember);

export default router;