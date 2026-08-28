const express = require("express");
const router = express.Router();

const controller = require("../controllers/trainingDocumentController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const { createUploader } = require("../config/multer");
const { uploadTrainingDocumentSchema } = require("../validations/trainingDocumentValidation");

const uploadTrainingFile = createUploader("training-documents");

router.post(
  "/",
  verifyToken,
  checkPermission("training", "upload"),
  uploadTrainingFile.single("file"),
  validate(uploadTrainingDocumentSchema),
  controller.uploadDocument,
);
router.get("/mine", verifyToken, checkPermission("training", "view_own_uploads"), controller.getMyUploads);
router.get("/assigned-to-me", verifyToken, checkPermission("training", "view_assigned"), controller.getAssignedToMe);
router.get("/", verifyToken, checkPermission("training", "view_all"), controller.listAllDocuments);

// No checkPermission — mixed-scope, authorized inside the controller.
router.get("/:id", verifyToken, controller.getDocumentById);

module.exports = router;
