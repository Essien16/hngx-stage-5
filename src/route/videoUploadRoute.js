const express = require("express");
const uploadController = require("../controller/videoUpload")
const multer = require("multer")

const router = express.Router()

const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("video"), uploadController);


module.exports = router