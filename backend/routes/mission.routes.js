import express from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import {
  createMission,
  getMissions,
  getActiveMission,
  uploadRegistrations,
  distributeMissionaries,
  getDistribution,
  exportDistribution,
  deleteMission,
} from '../controllers/mission.controller.js';

const router = express.Router();

// ============================================================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// ============================================================================

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Get file extension
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  // Allowed extensions
  const allowedExtensions = ['.csv', '.xls', '.xlsx'];
  
  // Allowed MIME types (comprehensive list)
  const allowedMimeTypes = [
    'text/csv',
    'application/csv',
    'text/x-csv',
    'application/x-csv',
    'text/comma-separated-values',
    'text/x-comma-separated-values',
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/octet-stream', // Sometimes Excel files report this
  ];

  // Check by extension first (most reliable)
  if (allowedExtensions.includes(fileExtension)) {
    console.log(`✅ File accepted: ${file.originalname} (ext: ${fileExtension})`);
    cb(null, true);
  } 
  // Then check MIME type
  else if (allowedMimeTypes.includes(file.mimetype)) {
    console.log(`✅ File accepted: ${file.originalname} (MIME: ${file.mimetype})`);
    cb(null, true);
  } 
  else {
    console.log(`❌ File rejected: ${file.originalname} (MIME: ${file.mimetype}, ext: ${fileExtension})`);
    cb(new Error('Invalid file type. Only CSV and Excel files (.csv, .xls, .xlsx) are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * @route   GET /api/missions/active
 * @desc    Get currently active mission
 * @access  Public
 */
router.get('/active', getActiveMission);

// ============================================================================
// PROTECTED ROUTES (PASTORATE only)
// ============================================================================

/**
 * @route   GET /api/missions
 * @desc    Get all missions
 * @access  Private (PASTORATE)
 */
router.get('/', authenticate, authorize('PASTORATE'), getMissions);

/**
 * @route   POST /api/missions
 * @desc    Create a new mission
 * @access  Private (PASTORATE only)
 */
router.post('/', authenticate, authorize('PASTORATE'), createMission);

/**
 * @route   POST /api/missions/:id/upload
 * @desc    Upload registrations from CSV/Excel file
 * @access  Private (PASTORATE)
 */
router.post(
  '/:id/upload',
  authenticate,
  authorize('PASTORATE'),
  upload.single('file'),
  uploadRegistrations
);

/**
 * @route   POST /api/missions/:id/distribute
 * @desc    Run distribution algorithm to assign missionaries to sites
 * @access  Private (PASTORATE only)
 */
router.post('/:id/distribute', authenticate, authorize('PASTORATE'), distributeMissionaries);

/**
 * @route   GET /api/missions/:id/distribution
 * @desc    Get distribution results for a mission
 * @access  Private (PASTORATE)
 */
router.get('/:id/distribution', authenticate, authorize('PASTORATE'), getDistribution);

/**
 * @route   GET /api/missions/:id/export
 * @desc    Export distribution to Excel file
 * @access  Private (PASTORATE)
 */
router.get('/:id/export', authenticate, authorize('PASTORATE'), exportDistribution);

/**
 * @route   DELETE /api/missions/:id
 * @desc    Delete a mission
 * @access  Private (PASTORATE only)
 */
router.delete('/:id', authenticate, authorize('PASTORATE'), deleteMission);

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${error.message}`,
    });
  }

  if (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  next();
});

export default router;