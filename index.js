const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: ["http://localhost:5174", "http://localhost:5173", "https://help-oca.surge.sh", "http://help-oca.surge.sh"],
    credentials: true,
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@skill-connect.amv3c.mongodb.net/?retryWrites=true&w=majority&appName=skill-connect`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send("Access Denied");
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send("Access Denied");
  }

  jwt.verify(token, process.env.JWT_Secret, (err, decoded) => {
    if (err) {
      return res.status(401).send("Access Denied");
    }

    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    const clubCollection = client.db("ClubSync").collection("clubs");
    const messageCollection = client.db("ClubSync").collection("messages");
    app.get("/test", async (req, res) => {
      const result = await clubCollection.find().toArray();
      res.send(result);
    });
    app.get("/get-club-list", async (req, res) => {
      const result = await clubCollection
        .find({}, { projection: { name: 1, email: 1, _id: 1, photo_url: 1 } })
        .toArray();
      res.send(result);
    });

    const eventsCollection = client.db("ClubSync").collection("events");
    app.post("/new-event", async (req, res) => {
      const data = req.body;
      if (data.budget) {
        data.budget = parseInt(data.budget); 
      }
      if(data.guestPassesCount){
        data.guestPassesCount = parseInt(data.guestPassesCount);
      }
      const newEvent = await eventsCollection.insertOne(data);
      console.log(newEvent);
      
      if (newEvent?.acknowledged) {
        res.status(201).send("Event created successfully");
      } else {
        res.status(400).send("Event creation failed");
      }
    });
    
    // getting total budget
    app.get("/get_total_budget", async (req,res)=>{

    })
    

    app.get("/get-all-pending-events", async (req, res) => {
      const requests = await eventsCollection
        .find({ status: "Pending" })
        .sort({ date: -1 })
        .toArray();
      res.json(requests);
    });

    app.get("/get-pending-events/:email", async (req, res) => {
      const email = req.params.email;
      const events = await eventsCollection
        .find({ clubMail: email, status: "Pending" })
        .sort({ date: -1 })
        .toArray();
      res.json(events);
    });

    app.get("/get-responded-events/:email", async (req, res) => {
      const email = req.params.email;
      const events = await eventsCollection
        .find({ clubMail: email, status: "Responded" })
        .sort({ date: -1 })
        .toArray();
      res.json(events);
    });

    app.delete("/event-planner/:eventId", async (req, res) => {
      const id = req.params.eventId;
      const result = await eventsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      if (result.deletedCount === 1) {
        res.status(200).send("Event deleted successfully");
      } else {
        res.status(400).send("Failed to delete event");
      }
    });

    // Dashboard DESIGN for PP CC 
    app.get("/dashboard-info/:email", async (req, res) => {
      const email = req.params.email;
      const query = {email : email};
      const result = await clubCollection.findOne(query)
      res.send(result);
    });

    // Showing Upcoming Events In the Dashboard
    app.get("/dashboard-events", async (req, res) => {
      const query = { response: "Accepted" };
      const result = await eventsCollection.find(query).toArray();
      res.send(result);
    });

    // Get a single event by ID
    app.get("/events/:id", async (req, res) => {
      const id = req.params.id;
      const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
      if (event) {
        res.json(event);
      } else {
        res.status(404).send("Event not found");
      }
    });

    // Update an event
    app.put("/events/:id", async (req, res) => {
      const id = req.params.id;
      const updatedEvent = req.body;
      const result = await eventsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedEvent }
      );
      if (result.modifiedCount === 1) {
        res.status(200).send("Event updated successfully");
      } else {
        res.status(400).send("Failed to update event");
      }
    });

    // get messages from the server
    app.get("/get-messages/:clubMail", async (req, res) => {
      const clubMail = req.params.clubMail;
      const messages = await messageCollection
        .find({
          $or: [
            { receiverEmail: clubMail, senderEmail: "oca@bracu.ac.bd" },
            { senderEmail: clubMail, receiverEmail: "oca@bracu.ac.bd" },
          ],
        })
        .sort({ date: 1, time: 1 }) // Sort messages by date and time, newest first
        .toArray();

      res.json(messages);
    });
    // send message
    app.post("/send-message", async (req, res) => {
      const messageInfo = req.body;

      const result = await messageCollection.insertOne(messageInfo);
      res.send(result);
    });
    // get appected events to show on the central calendar
    app.get("/accepted-events", async (req, res) => {
      const acceptedEvents = await eventsCollection
        .find({ response: "Accepted" })
        .project({ clubMail: 1, date: 1, _id: 0 })
        .toArray();
      // Map through the array and transform the objects
      const transformedEvents = acceptedEvents.map((event) => ({
        title: event.clubMail.split("@")[0].toUpperCase(),
        date: event.date,
      }));

      res.json(transformedEvents);
    });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello BRACU!");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
