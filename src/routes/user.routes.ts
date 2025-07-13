import { Router } from "express";

import { emailsignup, verifyOtp, completeSignup, login, getProfile, logout } from "../controllers/user.controller";
import signUpAuth from "../middlewares/signUpAuth";
import Auth from "../middlewares/auth";

const router = Router();

router.post("/signup-email", emailsignup);
router.post("/verify-otp", signUpAuth, verifyOtp);
router.post("/complete-signup", signUpAuth, completeSignup);
router.post("/login", login);
router.get("/profile", Auth, getProfile);
router.post("/logout", Auth, logout);

export default router;