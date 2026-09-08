import { Router } from 'express';
import {
  getDashboardStats,
  getAllUsers,
  getAllProducts,
  getAllTransactions,
  deleteUser,
  toggleUserVerification,
  deleteProduct,
  createAdmin,
} from '../controllers/admin.controller';
import Auth from '../middlewares/auth';

const router = Router();

router.get('/dashboard', Auth, getDashboardStats);
router.get('/users', Auth, getAllUsers);
router.get('/products', Auth, getAllProducts);
router.get('/transactions', Auth, getAllTransactions);
router.post('/user', Auth, createAdmin);
router.patch('/users/:id/verify', Auth, toggleUserVerification);
router.delete('/users/:id', Auth, deleteUser);
router.delete('/products/:id', Auth, deleteProduct);

export default router;