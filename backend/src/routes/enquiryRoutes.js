'use strict';

/**
 * Public enquiry routes, mounted at /api/enquiries
 *
 *   POST /api/enquiries   -> public, used by the website contact form
 *   GET  /api/enquiries   -> admin only (needs the x-api-key header)
 */

const express = require('express');

const controller = require('../controllers/enquiryController');
const validateEnquiry = require('../middleware/validateEnquiry');
const apiKey = require('../middleware/apiKey');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post('/', validateEnquiry, asyncHandler(controller.createEnquiry));
router.get('/', apiKey, asyncHandler(controller.listEnquiries));
router.get('/:id', apiKey, asyncHandler(controller.getEnquiry));

module.exports = router;
