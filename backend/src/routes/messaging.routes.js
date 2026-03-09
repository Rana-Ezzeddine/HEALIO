import express from "express";
import requireUser from "../middleware/requireUser.js";
import {
    getConversations,
    createConversation,
    getConversationMessages,
    sendMessage,
} from "../controllers/messaging.controller.js";

const router = express.Router();

router.use(requireUser);

router.get("/", getConversations);
router.post("/", createConversation);
router.get("/:id/messages", getConversationMessages);
router.post("/:id/messages", sendMessage);

export default router;