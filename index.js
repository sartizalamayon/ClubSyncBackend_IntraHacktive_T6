const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: ['http://localhost:5174','http://localhost:5173'],
    credentials: true
  }));
  app.use(express.json());

  const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@skill-connect.amv3c.mongodb.net/?retryWrites=true&w=majority&appName=skill-connect`;

const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
});

const verifyToken = (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).send('Access Denied');
    }
    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
        return res.status(401).send('Access Denied');
    }
    
    jwt.verify(token, process.env.JWT_Secret, (err, decoded) => {
        if (err) {
            return res.status(401).send('Access Denied');
        }

    req.decoded = decoded;
    next();
    });
};

async function run() {
    try {

      const clubCollection = client.db("ClubSync").collection("clubs");
      app.get("/test", async (req, res) => {
        const result = await clubCollection.find().toArray();
        res.send(result);
      });
      app.get("/get-club-list", async (req, res) => {
        const result = await clubCollection.find({}, { projection: { name: 1, email: 1, _id: 0 } }).toArray();
        res.send(result);
      });

      const eventsCollection = client.db("ClubSync").collection("events");
      app.post("/new-event", async(req, res) =>{
        const data = req.body
        const newEvent = await eventsCollection.insertOne(data);
        console.log(newEvent)
        if (newEvent?.acknowledged){
          res.status(201).send('Event created successfully');
        }
        else{
          res.status(400).send('Event Creation failed')
        }
      })

      app.get('/get-all-pending-events', async (req, res) =>{
        const requests = await eventsCollection.find({status: 'Pending'}).sort({requestDate:-1}).toArray()
        res.json(requests)
      })

      app.get("/get-pending-events/:email", async(req, res)=>{
        const email = req.params.email
        const events = await eventsCollection.find({ clubMail:email,  status: 'Pending'}).sort({date:-1}).toArray();
        res.json(events);
      })

      app.get("/get-responded-events/:email", async(req, res)=>{
        const email = req.params.email
        const events = await eventsCollection.find({ clubMail:email,  status: 'Responded'}).sort({date:-1}).toArray();
        res.json(events);
      })


      app.delete('/event-planner/:eventId', async(req, res)=>{
        const id = req.params.eventId
        const result = await eventsCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 1) {
            res.status(200).send('Event deleted successfully');
        } else {
            res.status(400).send('Failed to delete event');
        }
      })
      

      // Get a single event by ID
app.get('/events/:id', async (req, res) => {
  const id = req.params.id;
  const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
  if (event) {
    res.json(event);
  } else {
    res.status(404).send('Event not found');
  }
});

// Update an event
app.put('/events/:id', async (req, res) => {
  const id = req.params.id;
  const updatedEvent = req.body;
  const result = await eventsCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedEvent }
  );
  if (result.modifiedCount === 1) {
    res.status(200).send('Event updated successfully');
  } else {
    res.status(400).send('Failed to update event');
  }
});

      
      console.log(
        "Pinged your deployment. You successfully connected to MongoDB!"
      );
    } finally {
        // await client.close();
      }
    }
    run().catch(console.dir);
    
    app.get('/', (req, res) => {
      res.send('Hello BRACU!');
    });
    
    app.listen(port, ()  => {
      console.log(`Server is running on http://localhost:${port}`);
    });