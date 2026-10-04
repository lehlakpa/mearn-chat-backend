import express from "express";
import { createOrder, getOrders } from "../controllers/order.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();
router.post("/", createOrder);
router.get("/", authMiddleware, getOrders);
export default router;
