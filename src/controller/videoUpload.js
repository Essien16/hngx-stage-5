const AWS = require("aws-sdk");

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const transcribe = new AWS.TranscribeService();
const s3 = new AWS.S3();

// Function to start a transcription job
async function startTranscriptionJob(videoUrl) {
  const params = {
    LanguageCode: "en-US",
    Media: { MediaFileUri: videoUrl },
    MediaFormat: "mp4",
    TranscriptionJobName: `TranscriptionJob-${Date.now()}`,
    OutputBucketName: process.env.AWS_S3_BUCKET_NAME,
  };

  try {
    const data = await transcribe.startTranscriptionJob(params).promise();
    console.log(
      "Transcription job started:",
      data.TranscriptionJob.TranscriptionJobName
    );
    return data.TranscriptionJob;
  } catch (err) {
    console.error("Error starting transcription job:", err);
    throw err;
  }
}

// Function to check transcription job status
async function checkTranscriptionJobStatus(jobName) {
  const params = {
    TranscriptionJobName: jobName,
  };

  try {
    const data = await transcribe.getTranscriptionJob(params).promise();
    return data.TranscriptionJob;
  } catch (err) {
    console.error("Error checking transcription job status:", err);
    throw err;
  }
}

// Function to get transcription from S3
async function getTranscriptionFromS3(transcriptUri) {
  const urlParts = transcriptUri.match(
    /https:\/\/s3\..+\.amazonaws\.com\/([^\/]+)\/(.+)/
  );
  if (!urlParts || urlParts.length !== 3) {
    throw new Error("Failed to parse transcriptUri");
  }
  const bucket = urlParts[1];
  const key = urlParts[2];

  const params = {
    Bucket: bucket,
    Key: key,
  };

  try {
    const data = await s3.getObject(params).promise();
    const transcriptionText = data.Body.toString("utf-8");
    return JSON.parse(transcriptionText);
  } catch (err) {
    console.error("Error retrieving transcription from S3:", err);
    throw err;
  }
}



// Upload endpoint handler
const uploadController = async (req, res) => {
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

  try {
    const data = await s3.upload(params).promise();
    const s3Uri = `s3://${params.Bucket}/${params.Key}`;
    const job = await startTranscriptionJob(s3Uri);
    let jobStatus = await checkTranscriptionJobStatus(job.TranscriptionJobName);

    // Loop to wait for the transcription to complete
    while (jobStatus.TranscriptionJobStatus === "IN_PROGRESS") {
      await new Promise((resolve) => setTimeout(resolve, 60000)); // wait for 60 seconds
      jobStatus = await checkTranscriptionJobStatus(job.TranscriptionJobName);
    }

    if (jobStatus.TranscriptionJobStatus === "COMPLETED") {
      const transcriptionData = await getTranscriptionFromS3(
        jobStatus.Transcript.TranscriptFileUri
      );
      res.json({
        success: true,
        videoUrl: data.Location,
        transcription: transcriptionData,
      });
    } else {
      throw new Error("Transcription job failed");
    }
  } catch (err) {
    console.error("Error with transcription job:", err);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = uploadController;

