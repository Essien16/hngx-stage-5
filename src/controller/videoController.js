// const AWS = require("aws-sdk");

// // Configure AWS SDK
// AWS.config.update({
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   region: process.env.AWS_REGION,
// });

// const transcribe = new AWS.TranscribeService();
// const s3 = new AWS.S3();

// // Function to start a transcription job
// async function startTranscriptionJob(videoUrl) {
//   const params = {
//     LanguageCode: "en-US",
//     Media: { MediaFileUri: videoUrl },
//     MediaFormat: "mp4",
//     TranscriptionJobName: `TranscriptionJob-${Date.now()}`,
//     OutputBucketName: process.env.AWS_S3_BUCKET_NAME,
//   };

//   try {
//     const data = await transcribe.startTranscriptionJob(params).promise();
//     console.log(
//       "Transcription job started:",
//       data.TranscriptionJob.TranscriptionJobName
//     );
//     return data.TranscriptionJob;
//   } catch (err) {
//     console.error("Error starting transcription job:", err);
//     throw err;
//   }
// }

// // Function to check transcription job status
// async function checkTranscriptionJobStatus(jobName) {
//   const params = {
//     TranscriptionJobName: jobName,
//   };

//   try {
//     const data = await transcribe.getTranscriptionJob(params).promise();
//     return data.TranscriptionJob;
//   } catch (err) {
//     console.error("Error checking transcription job status:", err);
//     throw err;
//   }
// }

// // Function to get transcription from S3
// async function getTranscriptionFromS3(transcriptUri) {
//   const urlParts = transcriptUri.match(
//     /https:\/\/s3\..+\.amazonaws\.com\/([^\/]+)\/(.+)/
//   );
//   if (!urlParts || urlParts.length !== 3) {
//     throw new Error("Failed to parse transcriptUri");
//   }
//   const bucket = urlParts[1];
//   const key = urlParts[2];

//   const params = {
//     Bucket: bucket,
//     Key: key,
//   };

//   try {
//     const data = await s3.getObject(params).promise();
//     const transcriptionText = data.Body.toString("utf-8");
//     return JSON.parse(transcriptionText);
//   } catch (err) {
//     console.error("Error retrieving transcription from S3:", err);
//     throw err;
//   }
// }



// // Upload endpoint handler
// const uploadController = async (req, res) => {
//   const videoFile = req.file;

//   if (!videoFile || !videoFile.buffer) {
//     res.status(400).send("No file uploaded");
//     return;
//   }

//   const params = {
//     Bucket: process.env.AWS_S3_BUCKET_NAME,
//     Key: videoFile.originalname,
//     Body: videoFile.buffer,
//     ContentType: videoFile.mimetype,
//   };

//   try {
//     const data = await s3.upload(params).promise();
//     const s3Uri = `s3://${params.Bucket}/${params.Key}`;
//     const job = await startTranscriptionJob(s3Uri);
//     let jobStatus = await checkTranscriptionJobStatus(job.TranscriptionJobName);

//     // Loop to wait for the transcription to complete
//     while (jobStatus.TranscriptionJobStatus === "IN_PROGRESS") {
//       await new Promise((resolve) => setTimeout(resolve, 60000)); // wait for 60 seconds
//       jobStatus = await checkTranscriptionJobStatus(job.TranscriptionJobName);
//     }

//     if (jobStatus.TranscriptionJobStatus === "COMPLETED") {
//       const transcriptionData = await getTranscriptionFromS3(
//         jobStatus.Transcript.TranscriptFileUri
//       );
//       res.json({
//         success: true,
//         videoUrl: data.Location,
//         transcription: transcriptionData,
//       });
//     } else {
//       throw new Error("Transcription job failed");
//     }
//   } catch (err) {
//     console.error("Error with transcription job:", err);
//     res.status(500).send("Internal Server Error");
//   }
// };

// module.exports = uploadController;

const fileSystem = require("fs");
const filePath = require("path");
const identifier = require("uuid");

const sessionRecords = {};

const createUniqueId = () => {
  return identifier.v4();
};

const createNewSession = (sessionId) => {
  return {
    fragments: [],
    delay: null,
  };
};

const initiateRecording = (request, response) => {
  try {
    const sessionId = createUniqueId();
    const newSession = createNewSession(sessionId);
    sessionRecords[sessionId] = newSession;

    response.status(200).json({ sessionId });
  } catch (err) {
    console.error("Error in initiateRecording:", err.message);
    response.status(500).json({ error: "Recording initialization failed." });
  }
};

const updateSessionRecord = (sessionId, videoDataFragment) => {
  sessionRecords[sessionId].fragments.push(videoDataFragment);

  if (sessionRecords[sessionId].delay) {
    clearTimeout(sessionRecords[sessionId].delay);
  }

  // Set a new timeout to remove the file after 5 minutes
  sessionRecords[sessionId].delay = setTimeout(() => {
    removeFile(sessionId); 
  }, 5 * 60 * 1000);
};

const receiveRecordingData = (request, response) => {
  try {
    const { sessionId } = request.params;

    if (!sessionRecords[sessionId]) {
      return response.status(404).json({ error: "Session unavailable." });
    }

    const videoDataFragment = Buffer.from(
      request.body.videoDataChunk,
      "base64"
    );

    // Update the session record with the new video data fragment
    updateSessionRecord(sessionId, videoDataFragment);

    response
      .status(200)
      .json({ message: "Video fragment received successfully." });
  } catch (err) {
    console.error(err);
    response.status(500).json({ error: "Video data transmission failed." });
  }
};

const createDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const storeVideoFile = (videoFilePath, videoData) => {
  fs.writeFileSync(videoFilePath, videoData);
};

const generatePlaybackURL = (sessionId) => {
  return `/playback/${sessionId}`;
};

const scheduleFileRemoval = (videoFilePath) => {
  setTimeout(() => {
    removeFile(videoFilePath);
  }, 5 * 60 * 1000);
};

const concludeRecordingAndStore = (request, response) => {
  try {
    const { sessionId } = request.params;

    if (!sessionRecords[sessionId]) {
      return response.status(404).json({ error: "Session unavailable." });
    }

    const compiledVideoData = Buffer.concat(
      sessionRecords[sessionId].fragments
    );
    const uniqueFileLabel = `${sessionId}-capture.mp4`;
    const dirPath = path.join(__dirname, "../archives");
    const videoFilePath = path.join(dirPath, uniqueFileLabel);

    createDirectory(dirPath);
    storeVideoFile(videoFilePath, compiledVideoData);

    clearTimeout(sessionRecords[sessionId].delay);
    delete sessionRecords[sessionId];

    const playbackURL = generatePlaybackURL(sessionId);
    scheduleFileRemoval(videoFilePath);

    response.status(200).json({
      playbackURL,
      message: "Video stored successfully",
      videoFilePath,
    });
  } catch (err) {
    console.error(err);
    response
      .status(500)
      .json({ error: "Recording termination and storage failed" });
  }
};

const removeFile = (fileLocation) => {
  fileSystem.unlink(fileLocation, (error) => {
    if (error) {
      console.error(`File deletion error: ${error}`);
    } else {
      console.log(`File deleted: ${fileLocation}`);
    }
  });
};

const playbackRecordedVideo = async (request, response) => {
  try {
    const { sessionId } = request.params;
    const videoFilePath = filePath.join(
      __dirname,
      "../archives",
      `${sessionId}-capture.mp4`
    );

    if (!fileSystem.existsSync(videoFilePath)) {
      return response.status(404).json({ error: "Video unavailable" });
    }

    const fileStats = fileSystem.statSync(videoFilePath);
    const fileSize = fileStats.size;
    const range = request.headers.range;

    let initial = 0,
      final = fileSize - 1;

    if (range) {
      const segments = range.replace(/bytes=/, "").split("-");
      initial = parseInt(segments[0], 10);
      final = segments[1] ? parseInt(segments[1], 10) : fileSize - 1;
    }

    const chunkLength = final - initial + 1;
    const videoStream = fileSystem.createReadStream(videoFilePath, {
      initial,
      final,
    });

    const header = {
      "Content-Range": `bytes ${initial}-${final}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkLength,
      "Content-Type": "video/mp4",
    };

    response.writeHead(range ? 206 : 200, header);
    videoStream.pipe(response);
  } catch (err) {
    console.error(err);
    response.status(500).json({ error: "Video playback failed." });
  }
};

module.exports = {
  initiateRecording,
  receiveRecordingData,
  concludeRecordingAndStore,
  playbackRecordedVideo,
};
