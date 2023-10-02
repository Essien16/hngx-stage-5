const express = require("express");
const multer = require("multer");
const bodyParser = require("body-parser");
const cors = require("cors");
const AWS = require("aws-sdk");
const dotenv = require("dotenv");
const path = require("path"); // Import the path module
dotenv.config();
const videoUploadRouter = require("./src/route/videoUploadRoute");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use("/api/v1/video", videoUploadRouter);

// Set up the path to your views directory
app.set("views", path.join(__dirname, "views"));

// Set up the view engine as 'html' and use the 'ejs' module's renderFile function
app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");

// Create a new route for rendering the video playback page
app.get("/play", (req, res) => {
  const videoUrl = req.query.videoUrl;
  if (!videoUrl) {
    res.status(400).send("Bad Request: videoUrl query parameter is required");
    return;
  }
  res.render("video", { videoUrl });
});

app.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
