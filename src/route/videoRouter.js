const express = require("express");
const {
  initiateRecording,
  receiveRecordingData,
  concludeRecordingAndStore,
  playbackRecordedVideo,
} = require("../controller/videoController");
const router = express.Router()

router.get("/stop/stream/:sessionId", concludeRecordingAndStore);
router.get("/stream/:sessionId", playbackRecordedVideo);
router.post("/stream/:sessionId", receiveRecordingData);
router.post("/record", initiateRecording);

module.exports = router