const express = require("express");
const cors = require("cors");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

    const database = client.db("techBlogsDB");
    const userCollection = database.collection("users");
    const blogsCollection = database.collection("blogs");

    // user api
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
