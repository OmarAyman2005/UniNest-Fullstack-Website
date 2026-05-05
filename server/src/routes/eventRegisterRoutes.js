import express from "express";
import {
    createRegistration,
    getUserRegistrations,
    getRegistrationsByEvent,
    deleteRegistration,
} from "../controllers/eventRegisterController.js";

const router = express.Router();

router.get("/", getUserRegistrations);

router.get("/event/:id", getRegistrationsByEvent);

router.post("/", createRegistration);

export default router;