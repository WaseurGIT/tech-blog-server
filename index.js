const express = require("express");
const cors = require("cors");
const app = express();
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken");
dotenv.config();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://blogify-swart-omega.vercel.app",
    ],
    credentials: true,
  }),
);
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

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Forbidden" });
    }
    req.user = decoded;
    next();
  });
};

const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.decoded.email;
    const user = await userCollection.findOne({ email });

    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  } catch (error) {
    console.error("Admin verification error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("techBlogs");
    const userCollection = database.collection("users");
    const blogsCollection = database.collection("blogs");
    const userDataCollection = database.collection("userData");
    const savedBlogsCollection = database.collection("savedBlogs");

    app.post("/jwt", async (req, res) => {
      try {
        const { email } = req.body;
        if (!email) {
          return res.status(400).json({ message: "Email is required" });
        }
        const user = await userCollection.findOne({ email });
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        const token = jwt.sign(
          {
            email: user.email,
            role: user.role || "user",
          },
          process.env.SECRET_KEY,
          { expiresIn: "7d" },
        );

        res.status(200).json({ token });
      } catch (error) {
        console.error("JWT Error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

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
          user.role = "user";
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
      verifyToken,
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

    app.delete("/blogs/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await blogsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          res.status(404).json({ message: "Blog not found" });
        } else {
          res.status(200).json({ message: "Blog deleted successfully" });
        }
      } catch (error) {
        console.error("Error deleting blog:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.get("/blogs/user/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const blogs = await blogsCollection.find({ email: email }).toArray();

        res.status(200).json(blogs);
      } catch (error) {
        console.error("Error fetching user blogs:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.post("/savedBlogs", verifyToken, async (req, res) => {
      try {
        const { userEmail, blogId } = req.body;

        if (!userEmail || !blogId) {
          return res.status(400).json({ message: "Missing data" });
        }

        // 🔎 Check if already saved
        const existing = await savedBlogsCollection.findOne({
          userEmail,
          blogId,
        });

        if (existing) {
          return res.status(409).json({ message: "Blog already saved" });
        }

        const result = await savedBlogsCollection.insertOne({
          userEmail,
          blogId,
          savedAt: new Date(),
        });

        res.status(201).json(result);
      } catch (error) {
        console.error("Error saving blog:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // app.get("/savedBlogs/:email", verifyToken, async (req, res) => {
    //   try {
    //     const email = req.params.email;

    //     // Step 1: Find saved blog IDs
    //     const saved = await savedBlogsCollection
    //       .find({ userEmail: email })
    //       .toArray();

    //     const blogIds = saved.map((item) => new ObjectId(item.blogId));

    //     // Step 2: Get full blog details
    //     const blogs = await blogsCollection
    //       .find({ _id: { $in: blogIds } })
    //       .toArray();

    //     res.status(200).json(blogs);
    //   } catch (error) {
    //     console.error("Error fetching saved blogs:", error);
    //     res.status(500).json({ message: "Error fetching saved blogs" });
    //   }
    // });

    app.get("/savedBlogs/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      const saved = await savedBlogsCollection
        .find({ userEmail: email })
        .toArray();

      const blogIds = saved.map((item) => new ObjectId(item.blogId));

      const blogs = await blogsCollection
        .find({ _id: { $in: blogIds } })
        .toArray();

      res.send(blogs);
    });

    app.delete("/savedBlogs/:blogId", verifyToken, async (req, res) => {
      try {
        const blogId = req.params.blogId;
        const userEmail = req.user.email; // from verifyToken

        const result = await savedBlogsCollection.deleteOne({
          userEmail,
          blogId,
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Saved blog not found" });
        }

        res.status(200).json({ message: "Saved blog removed successfully" });
      } catch (error) {
        console.error("Error removing saved blog:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // admin route to get all users
    app.get("/admin/users", verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
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
