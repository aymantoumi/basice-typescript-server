import express from 'express';
import { createUser, deleteUser, getAllUsers, getUserById, updateUser } from '../controllers/usersController.ts'
const userRouter = express.Router();

userRouter.post('/create', createUser)
userRouter.get('/get-users', getAllUsers)
userRouter.get('/delete-users/:user_id', deleteUser)
userRouter.get('/get-user/:user_id', getUserById)
userRouter.get('/update-user/:user_id', updateUser)

export { userRouter };
