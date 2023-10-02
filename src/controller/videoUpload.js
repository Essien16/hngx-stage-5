const AWS = require("aws-sdk");

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Create new instances of AWS.TranscribeService and AWS.S3
const transcribe = new AWS.TranscribeService();
const s3 = new AWS.S3();

// Function to start a transcription job
function startTranscriptionJob(videoUrl) {
  const params = {
    LanguageCode: "en-US",
    Media: { MediaFileUri: videoUrl },
    MediaFormat: "mp4",
    TranscriptionJobName: `TranscriptionJob-${Date.now()}`,
    OutputBucketName: process.env.AWS_S3_BUCKET_NAME,
  };

  return transcribe
    .startTranscriptionJob(params)
    .promise()
    .then((data) => {
      console.log(
        "Transcription job started:",
        data.TranscriptionJob.TranscriptionJobName
      );
    })
    .catch((err) => {
      console.error("Error starting transcription job:", err);
      throw err; // Rethrow the error so it can be handled by the caller
    });
}

// Upload endpoint handler
const uploadController = (req, res) => {
  const videoFile = req.file;

  if (!videoFile || !videoFile.buffer) {
    res.status(400).send("No file uploaded");
    return;
  }

  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: videoFile.originalname,
    Body: videoFile.buffer,
    ContentType: videoFile.mimetype,
  };

  s3.upload(params, (err, data) => {
    if (err) {
      console.error("Error uploading file:", err);
      res.status(500).send("Internal Server Error");
      return;
    }

    const s3Uri = `s3://${params.Bucket}/${params.Key}`;

    startTranscriptionJob(s3Uri)
      .then(() => {
        res.json({ success: true, videoUrl: data.Location });
      })
      .catch((err) => {
        console.error("Error with transcription job:", err);
        res.status(500).send("Internal Server Error");
      });
  });
};

module.exports = uploadController;
