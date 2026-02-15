const express = require("express");
const cors = require("cors");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send(`Tech Blogs Server is running on port ${port}`);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
