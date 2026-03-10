import express from 'express';
import {
  universalSearch,
  filterMedications,
  filterSymptoms,
  getFilterOptions
} from '../controllers/searchController.js';

import requireUser from '../middleware/requireUser.js';
import requireVerified from '../middleware/requireVerified.js';

const router = express.Router();

router.use(requireUser);
router.use(requireVerified);

// PBI-29: Search and filtering endpoints
router.get('/universal', universalSearch);
router.get('/medications', filterMedications);
router.get('/symptoms', filterSymptoms);
router.get('/filter-options', getFilterOptions);

export default router;