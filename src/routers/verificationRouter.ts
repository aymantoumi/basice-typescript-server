import express from 'express';
import { verifyEmail } from "../controllers/emailVerifiication.ts";

const verificationRouter = express.Router();


verificationRouter.get('/:token', verifyEmail)

export { verificationRouter };