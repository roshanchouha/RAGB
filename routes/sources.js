const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access :wid
const {
  getSources,
  uploadFiles: uploadFilesController,
  addUrl,
  deleteSource,
  getSourceStatus,
} = require('../controllers/sourceController');
const { uploadFiles } = require('../middleware/upload');
const { checkPlanLimits } = require('../middleware/planLimits');

// GET /api/workspaces/:wid/sources
router.get('/', getSources);

// POST /api/workspaces/:wid/sources/upload
router.post(
  '/upload',
  checkPlanLimits('file'),
  (req, res, next) => {
    uploadFiles(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error.',
        });
      }
      next();
    });
  },
  uploadFilesController
);

// POST /api/workspaces/:wid/sources/url
router.post('/url', checkPlanLimits('file'), addUrl);

// DELETE /api/workspaces/:wid/sources/:sid
router.delete('/:sid', deleteSource);

// GET /api/workspaces/:wid/sources/:sid/status
router.get('/:sid/status', getSourceStatus);

module.exports = router;
