const express = require("express");
const app = express();
const multer = require("multer");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const videoRouter = require("./src/route/videoRouter")


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});
app.use(cors());
app.use(bodyParser.json());
app.use("/api/v1/", videoRouter);


// Set up the view engine as 'html' and use the 'ejs' module's renderFile function
// app.engine("html", require("ejs").renderFile);
// app.set("view engine", "html");

// app.get("/play", (req, res) => {
//   let videoUrl = req.query.videoUrl;
//   if (!videoUrl) {
//     res.status(400).send("Bad Request: videoUrl query parameter is required");
//     return;
//   }
//   // Replace spaces with %20
//   videoUrl = videoUrl.replace(/ /g, "%20");
//   res.render("video", { videoUrl });
// });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server is listening on port 3000");
});
