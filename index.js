const express = require("express");
const cors = require("cors");
const app = express();
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
dotenv.config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.febqytm.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("techBlogs");
    const userCollection = database.collection("users");
    const blogsCollection = database.collection("blogs");
    const userDataCollection = database.collection("userData");

    // ********* user api
    // post user
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        if (!user.name || !user.email) {
          res.status(400).send({ message: "Name and email are required" });
        }

        const existingUser = await userCollection.findOne({
          email: user.email,
        });
        if (!existingUser) {
          const result = await userCollection.insertOne(user);
          return res
            .status(200)
            .json({ success: true, message: "User added", result });
        } else {
          return res.status(200).json({
            success: true,
            message: "User already exists",
            existingUser,
          });
        }
      } catch (error) {
        console.error("Error inserting user:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // get api
    app.get("/users", async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // single user get api
    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await userCollection.findOne({ email: email });
        if (!user) {
          res.status(404).send({ message: "User not found" });
        } else {
          res.status(200).send(user);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });
    // delete user
    app.delete("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await userCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          res.status(404).send({ message: "User not found" });
        } else {
          res.status(200).send({ message: "User deleted successfully" });
        }
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // *********** user data api
    // post api
    app.put(
      "/userData/:email",
      upload.fields([
        { name: "coverImage", maxCount: 1 },
        { name: "profilePicture", maxCount: 1 },
      ]),
      async (req, res) => {
        try {
          const email = req.params.email;

          let coverImage = null;
          let profilePicture = null;

          if (req.files && req.files.coverImage) {
            coverImage = req.files.coverImage[0].filename;
          }

          if (req.files && req.files.profilePicture) {
            profilePicture = req.files.profilePicture[0].filename;
          }

          const updatedData = {
            email,
            name: req.body.name,
            profession: req.body.profession,
            institute: req.body.institute,
            bio: req.body.bio,
          };

          if (coverImage) updatedData.coverImage = coverImage;
          if (profilePicture) updatedData.profilePicture = profilePicture;

          const result = await userDataCollection.updateOne(
            { email },
            { $set: updatedData },
            { upsert: true },
          );

          res.send(result);
        } catch (error) {
          console.error("ERROR:", error);
          res.status(500).send({ message: "Something went wrong" });
        }
      },
    );

    // get api
    app.get("/userData/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const result = await userDataCollection.findOne({ email });
        res.status(200).send(result);
      } catch (error) {
        console.error("Error fetching user data:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // *************** blogs api */
    app.get("/blogs", async (req, res) => {
      try {
        const result = await blogsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching blogs:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.post(
      "/blogs",
      upload.fields([
        { name: "imageOne", maxCount: 1 },
        { name: "imageTwo", maxCount: 1 },
      ]),
      async (req, res) => {
        try {
          const blog = {
            author: req.body.author,
            authorImage: req.body.authorImage,
            email: req.body.email,
            publishedDate: req.body.publishedDate,
            title: req.body.title,
            category: req.body.category,
            readTime: req.body.readTime,
            content: req.body.content,
            imageOne: req.files?.imageOne?.[0]?.filename || null,
            imageTwo: req.files?.imageTwo?.[0]?.filename || null,
            comments: [],
            likes: 0,
          };

          const result = await blogsCollection.insertOne(blog);

          res.status(201).json(result);
        } catch (error) {
          console.error("Error inserting blog:", error);
          res.status(500).json({ message: "Internal server error" });
        }
      },
    );

    app.get("/blogs/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await blogsCollection.findOne({ _id: new ObjectId(id) });
        res.status(200).send(result);
      } catch (error) {
        console.error("Error fetching blog:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.post("/blogs/:id/comments", async (req, res) => {
      try {
        const id = req.params.id;
        const comment = { ...req.body };
        const result = await blogsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $push: { comments: comment } },
        );
        res.status(200).send(comment);
      } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.post("/blogs/:id/like", async (req, res) => {
      try {
        const id = req.params.id;
        const { email } = req.body;

        const blog = await blogsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!blog) {
          return res.status(404).json({ message: "Blog not found" });
        }

        // Prevent double like
        if (blog.likedUsers?.includes(email)) {
          return res.status(400).json({
            message: "Already liked",
          });
        }

        // Update blog
        await blogsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $addToSet: { likedUsers: email },
            $inc: { likes: 1 },
          },
        );

        // ✅ Fetch UPDATED blog
        const updatedBlog = await blogsCollection.findOne({
          _id: new ObjectId(id),
        });

        // ✅ Send updated blog back
        res.status(200).json(updatedBlog);
      } catch (error) {
        console.error("Like error:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(`Tech Blogs Server is running on port ${port}`);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
