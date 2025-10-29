import express from 'express';
import { 
  stripeCheckOut, 
  stripeWebhook,
  getSessionStatus 
} from '../controllers/stripController.ts';

const stripeRouter = express.Router();

// Webhook needs raw body
stripeRouter.post('/webhook', express.raw({type: 'application/json'}), stripeWebhook);

// Other routes use JSON
stripeRouter.post('/create-checkout-session', express.json(), stripeCheckOut);
stripeRouter.get('/session-status/:session_id', getSessionStatus);

export { stripeRouter };