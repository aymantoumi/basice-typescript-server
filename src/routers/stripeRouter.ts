import express from 'express'
import { stripeCheckOut } from '../controllers/stripController.ts'

const stripeRouter = express.Router()

stripeRouter.post('/', stripeCheckOut);

export { stripeRouter }