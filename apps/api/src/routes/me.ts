import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const meRouter = Router();

meRouter.get('/', requireAuth, (req, res) => {
  res.json({
    id: req.user?.sub,
    email: req.user?.email ?? null,
    claims: req.user
  });
});

export default meRouter;
