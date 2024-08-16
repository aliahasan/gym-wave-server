require("dotenv").config();
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import cookieParser from "cookie-parser";
const port = process.env.port || 3000;
import { verify, sign } from "jsonwebtoken";
import express, { json } from "express";
const app = express();
import cors from "cors";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
app.use(json());
app.use(
  cors({
    credentials: true,
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://gym-wave-22b4e.web.app",
      "https://gym-wave-22b4e.firebaseapp.com",
    ],
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
    verify(token, process.env.TOKEN_SECRET, (error, decoded) => {
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
    const reviewsCollection = client.db("gym-wave").collection("reviews");
    const bookingCollection = client.db("gym-wave").collection("bookings");
    const trainersCollection = client.db("gym-wave").collection("trainers");
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
        const token = sign(user, process.env.TOKEN_SECRET, {
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
      try {
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
        const result = await usersCollection.updateOne(
          query,
          updateDoc,
          options
        );
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // get all the users , usersCollection
    app.get("/users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send(users);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const result = await usersCollection.findOne({ email });
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // post a class
    app.post("/class", verifyToken, verifyTrainer, async (req, res) => {
      try {
        const data = req.body;
        const result = await classesCollection.insertOne(data);
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // get all the classes
    app.get("/classes", async (req, res) => {
      try {
        const classes = await classesCollection.find().toArray();
        res.send(classes);
      } catch (error) {
        res.status(500).json({ error: error.message });
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
        res.status(500).json({ error: error.message });
      }
    });

    // get packagePlan from class collection
    app.get("/packages", async (req, res) => {
      try {
        const sliverClasses = await classesCollection
          .find({ type: "sliver" })
          .limit(2)
          .toArray();
        const goldClasses = await classesCollection
          .find({ type: "gold" })
          .toArray();
        const diamondClasses = await classesCollection
          .find({ type: "diamond" })
          .limit(3)
          .toArray();
        res.status(200).send({
          silver: sliverClasses,
          gold: goldClasses,
          diamond: diamondClasses,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
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
            .send({ message: "!!! you already subscribed" });
        }
        const result = await subscribersCollection.insertOne({ name, email });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // get all the subscribers
    app.get("/subscribers", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const subscribers = await subscribersCollection.find().toArray();
        res.send(subscribers);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // get all the trainers
    app.get("/trainers", async (req, res) => {
      try {
        const result = await trainersCollection
          .find({ role: "trainer" })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // get a trainer details
    app.get("/trainers/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await trainersCollection.findOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // application for applied trainer
    app.post(
      "/applied-trainers",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const appliedUser = req.body;
          const result = await appliedTrainerCollection.insertOne(appliedUser);
          res.send(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    // update userRole
    app.post("/update/user/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      try {
        const application = await appliedTrainerCollection.findOne({
          _id: new ObjectId(id),
        });
        console.log(application);
        if (!application) {
          return res.status(404).send({ message: "Application not found" });
        }
        const { userId } = application;
        delete application._id;
        await usersCollection.updateOne(
          { _id: ObjectId.createFromHexString(userId) },
          { $set: { role: "trainer", ...application } }
        );
        const result = await appliedTrainerCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // get all the appliedTrainer
    app.get("/applied-trainers", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await appliedTrainerCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
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
    app.post("/articles", verifyToken, async (req, res) => {
      try {
        const data = req.body;
        const result = await articlesCollection.insertOne(data);
        res.status(201).json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // get all the blogs and article
    app.get("/articles", async (req, res) => {
      try {
        const blogs = await articlesCollection.find().toArray();
        res.status(200).json(blogs);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // create-payment-intent
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      try {
        const { price } = req.body;
        const amount = parseInt(price * 100);
        if (!amount || amount < 1) return;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    app.post("/bookings", verifyToken, async (req, res) => {
      try {
        const bookingData = req.body;
        const result = await bookingCollection.insertOne(bookingData);
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/bookings/buyer", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) return res.send([]);
        const query = { "buyerInfo.buyerEmail": email };
        const result = await bookingCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get(
      "/bookings/trainers",
      verifyToken,
      verifyTrainer,
      async (req, res) => {
        try {
          const email = req.query.email;
          if (!email) return res.send([]);
          const query = { "sellerInfo.trainerEmail": email };
          const options = {
            projection: { classes: 0 },
          };
          const result = await bookingCollection.find(query, options).toArray();
          res.send(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    app.post("/payments", async (req, res) => {
      try {
        const paymentData = req.body;
        const result = await paymentCollection.insertOne(paymentData);
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/payments", async (req, res) => {
      try {
        const payments = await paymentCollection.find().toArray();
        res.send(payments);
      } catch (error) {
        res.status(500).json({ error: error.message });
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
