import express from "express";
import requireUser from "../middleware/requireUser.js";
import requireVerified from "../middleware/requireVerified.js";
import requireDoctorProductAccessIfDoctor from "../middleware/requireDoctorProductAccessIfDoctor.js";
import {
    getConversations,
    createConversation,
    getConversationMessages,
    sendMessage,
    deleteConversation,
} from "../controllers/messaging.controller.js";

const router = express.Router();

router.use(requireUser);
router.use(requireVerified);
router.use(requireDoctorProductAccessIfDoctor);

router.get("/", getConversations);
router.post("/", createConversation);
router.delete("/:id", deleteConversation);
router.get("/:id/messages", getConversationMessages);
router.post("/:id/messages", sendMessage);

export default router;
