const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cookieParser = require("cookie-parser");
const port = process.env.port || 3000;
const jwt = require("jsonwebtoken");
const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
app.use(express.json());
app.use(
  cors({
    credentials: true,
    origin: ["http://localhost:5173", "http://localhost:5174"],
    optionSuccessStatus: 200,
  })
);
app.use(cookieParser());

const uri = process.env.DB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// verify token as middleware
const verifyToken = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(403).send({ message: "Unauthorized access" });
    }
    jwt.verify(token, process.env.TOKEN_SECRET, (error, decoded) => {
      if (error) {
        console.log(error);
        return res.status(401).send({ message: "Failed to authenticate" });
      }
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error(error);
  }
};

async function run() {
  try {
    const usersCollection = client.db("gym-wave").collection("users");
    const classesCollection = client.db("gym-wave").collection("classes");
    const trainersCollection = client.db("gym-wave").collection("trainers");
    const reviewsCollection = client.db("gym-wave").collection("reviews");
    const subscribersCollection = client
      .db("gym-wave")
      .collection("subscribers");
    const articlesCollection = client.db("gym-wave").collection("articles");
    const appliedTrainerCollection = client
      .db("gym-wave")
      .collection("applied-trainers");
    const paymentCollection = client.db("gym-wave").collection("payments");

    // generate token
    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body;
        const token = jwt.sign(user, process.env.TOKEN_SECRET, {
          expiresIn: "365d",
        });
        res
          .cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: "An error occurred pls try again!.",
        });
      }
    });

    // clear token when logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (error) {
        res.status(500).send(error);
      }
    });

    const verifyAdmin = async (req, res, next) => {
      try {
        const user = req.user;
        const query = { email: user?.email };
        const result = await usersCollection.findOne(query);
        if (!result || result?.role !== "admin") {
          return res.status(401).send({ message: "unauthorized access!!!" });
        }
        next();
      } catch (error) {
        console.log(error);
      }
    };

    const verifyTrainer = async (req, res, next) => {
      try {
        const user = req.user;
        const query = { email: user?.email };
        const result = await usersCollection.findOne(query);
        console.log(result?.role);
        if (!result || result?.role !== "trainer") {
          return res.status(401).send({ message: "unauthorized access!!" });
        }
        next();
      } catch (error) {
        console.log(error);
      }
    };

    // save a user and to the database and do other function using same api
    app.put("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        if (user?.status === "Requested") {
          const result = await usersCollection.updateOne(query, {
            $set: { status: user?.status },
          });
          return res.send(result);
        } else {
          return res.send(isExist);
        }
      }

      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...user,
          timeStamp: Date.now(),
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const result = await usersCollection.findOne({ email });
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // get all the classes
    app.get("/classes", async (req, res) => {
      try {
        const classes = await classesCollection.find().toArray();
        res.send(classes);
      } catch (error) {
        console.log(error);
      }
    });

    // get a class by id
    app.get("/classes/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await classesCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // get all the users , usersCollection
    app.get("/users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send(users);
      } catch (error) {
        console.log(error);
      }
    });

    // post subscriber
    app.post("/subscribers", async (req, res) => {
      const { name, email } = req.body;
      try {
        const user = await subscribersCollection.findOne({ email: email });
        if (user) {
          return res
            .status(400)
            .json({ message: "!!! you already subscribed" });
        }
        const result = await subscribersCollection.insertOne({ name, email });
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // get all the subscribers
    app.get("/subscribers", async (req, res) => {
      try {
        const subscribers = await subscribersCollection.find().toArray();
        res.send(subscribers);
      } catch (error) {
        console.log(error);
      }
    });

    app.post("/trainers", async (req, res) => {
      try {
        const data = req.body;
        const result = await trainersCollection.insertOne(data);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // get all the trainers
    app.get("/trainers", async (req, res) => {
      try {
        const result = await trainersCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    app.get("/trainers/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await trainersCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // get reviews
    app.get("/reviews", async (req, res) => {
      try {
        const reviews = await reviewsCollection.find().toArray();
        res.send(reviews);
      } catch (error) {
        console.log(error);
      }
    });

    // post an article or blogs
    app.post("/articles", async (req, res) => {
      try {
        const data = req.body;
        const result = await articlesCollection.insertOne(data);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // get all the blogs and article
    app.get("/articles", async (req, res) => {
      try {
        const articles = await articlesCollection.find().toArray();
        res.send(articles);
      } catch (error) {
        console.log(error);
      }
    });

    app.get("/payments", async (req, res) => {
      try {
        const payments = await paymentCollection.find().toArray();
        res.send(payments);
      } catch (error) {
        console.log(error);
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.log);
app.get("/", (req, res) => {
  res.send("Gym wave server is running");
});
app.listen(port, () => {
  console.log(`Gym wave running on the port ${port}`);
});
