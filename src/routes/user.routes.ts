import { Router } from "express";

import {
  emailsignup,
  verifyOtp,
  completeSignup,
  login,
  getProfile,
  logout,
  updateProfile,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} from "../controllers/user.controller";
import signUpAuth from "../middlewares/signUpAuth";
import Auth from "../middlewares/auth";

const router = Router();

router.post("/signup-email", emailsignup);
router.post("/verify-otp", signUpAuth, verifyOtp);
router.post("/complete-signup", signUpAuth, completeSignup);
router.post("/login", login);
router.get("/profile", Auth, getProfile);
router.patch("/profile", Auth, updateProfile);
router.post("/logout", Auth, logout);

// Forgot password flow
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", signUpAuth, verifyResetOtp);
router.post("/reset-password", signUpAuth, resetPassword);

export default router;
