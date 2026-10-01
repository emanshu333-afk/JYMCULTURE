'use strict';

/**
 * Admin routes, mounted at /api/admin - every route requires the API key.
 *
 *   GET    /api/admin/enquiries             list (filter, search, paginate)
 *   GET    /api/admin/enquiries/export.csv  download everything as CSV
 *   GET    /api/admin/enquiries/:id         one enquiry
 *   PATCH  /api/admin/enquiries/:id         change status
 *   DELETE /api/admin/enquiries/:id         delete
 *   GET    /api/admin/stats                 dashboard counts
 */

const express = require('express');

const controller = require('../controllers/enquiryController');
const apiKey = require('../middleware/apiKey');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/* Every admin route is behind the shared secret. */
router.use(apiKey);

router.get('/stats', asyncHandler(controller.getStats));

router.get('/enquiries', asyncHandler(controller.listEnquiries));
router.get('/enquiries/export.csv', asyncHandler(controller.exportCsv));
router.get('/enquiries/:id', asyncHandler(controller.getEnquiry));
router.patch('/enquiries/:id', asyncHandler(controller.updateEnquiry));
router.delete('/enquiries/:id', asyncHandler(controller.deleteEnquiry));

module.exports = router;
