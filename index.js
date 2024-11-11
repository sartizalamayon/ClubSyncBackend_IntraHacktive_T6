const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const nodemailer = require('nodemailer');
const app = express();
const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: ["http://localhost:5174", "http://localhost:5173", "https://help-oca.surge.sh", "http://help-oca.surge.sh", "https://clubsyncfrontend.vercel.app"],
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
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can use other services like Outlook, Yahoo, etc.
  auth: {
    user: 'bunglishh@gmail.com',
    pass: `${process.env.GMAIL_PASS}`,
  },
});
const sendEmailWithRetry = async (mailOptions, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await transporter.sendMail(mailOptions);
      console.log('Email sent successfully');
      return; // Exit if successful
    } catch (error) {
      console.error(`Error sending email (attempt ${i + 1}):`, error);
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000)); // wait 5 seconds
      } else {
        console.error('Failed to send email after multiple attempts');
      }
    }
  }
};

async function run() {
  try {
    const clubCollection = client.db("ClubSync").collection("clubs");
    const messageCollection = client.db("ClubSync").collection("messages");

    app.get("/current-user/:mail", async (req, res) => {
      const email = req.params.mail;
      const result = await clubCollection.findOne({ email: email });
      res.send(result);
    });

    app.get("/all-clubs", async (req, res) => {
      const result = await clubCollection.find({role: "club"}).toArray();
      res.send(result);
    })

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
    // add new event with email sending features
    const eventsCollection = client.db("ClubSync").collection("events");
    app.post("/new-event", async (req, res) => {
      const data = req.body;
      // sent email notification
      if (data.termsAgreed) {
        const mailOptions = {
          from: 'bunglishh@gmail.com', // Sender address
          to: `${data.advisorEmail}`,           // Club advisor's email
          subject: `Event Request Submission: ${data.title}`,  // Dynamic subject with event title
          text: `
            Dear Dear Club Advisor,
      
            This is to inform you that a new event request titled "${data.title}" has been submitted by our club and is currently under review.
      
            Below are the details of the request:
      
            - **Event Title**: ${data.title}
            - **Description**: ${data.description}
            - **Proposed Date**: ${data.date}
            - **Budget Required**: ${data.needsBudget ? 'Yes' : 'No'}
            - **Room Reservation**: ${data.needsRoom ? 'Yes' : 'No'}
            - **Guest Passes Required**: ${data.needsGuestPasses ? 'Yes' : 'No'}
            - **Additional Requirements**: ${data.additionalRequirements || 'None'}
      
            Current Status: ${data.status}
      
            We kindly seek your guidance and approval for the above request. Should you need further information or have any suggestions, please feel free to let us know.
      
            Sincerely,
            The Club Events Team
          `,
          html: `
            <p>Dear Club Advisor,</p>
      
            <p>This is to inform you that a new event request titled "<strong>${data.title}</strong>" has been submitted by our club and is currently under review.</p>
      
            <h3>Event Details:</h3>
            <ul>
              <li><strong>Event Title:</strong> ${data.title}</li>
              <li><strong>Description:</strong> ${data.description}</li>
              <li><strong>Proposed Date:</strong> ${data.date}</li>
              <li><strong>Budget Required:</strong> ${data.needsBudget ? 'Yes' : 'No'}</li>
              <li><strong>Room Reservation:</strong> ${data.needsRoom ? 'Yes' : 'No'}</li>
              <li><strong>Guest Passes Required:</strong> ${data.needsGuestPasses ? 'Yes' : 'No'}</li>
              <li><strong>Additional Requirements:</strong> ${data.additionalRequirements || 'None'}</li>
            </ul>
      
            <p><strong>Current Status:</strong> ${data.status}</p>
      
            <p>We kindly seek your guidance and approval for the above request. Should you need further information or have any suggestions, please feel free to let us know.</p>
      
            <p>Sincerely,</p>
            <p>${data.clubMail}</p>
            <p>The Club Events Team</p>
          `
        };
      
        try {
          // Send the email
          await transporter.sendMail(mailOptions);
          // console.log('Email sent successfully');
        } catch (error) {
          // console.error('Error sending email:', error);
        }
      }
      
      if(data.guestPassesCount){
        data.guestPassesCount = parseInt(data.guestPassesCount);
      }
      const newEvent = await eventsCollection.insertOne(data);

      
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
    // accepted events
    app.get("/accepted-events", async (req, res) => {
      const acceptedEvents = await eventsCollection
        .find({ response: "Accepted" })
        .project({ roomNumber:1,title:1,clubMail: 1, date: 1, _id: 0 })
        .sort({ date: 1 })
        .toArray();


      // Map through the array and transform the objects
      const transformedEvents = acceptedEvents.map((event) => ({
        title: event.title,
        room: event.roomNumber,
        club:event.clubMail.split("@")[0].toUpperCase(),
        date: event.date,
      }));

      app.get("/calender-accepted-events", async (req, res) => {
        const acceptedEvents = await eventsCollection
          .find({ response: "Accepted" })
          .project({
            title: 1,
            date: 1,
            clubMail: 1,
            roomNumber: 1,
            _id: 1
          })
          .toArray();
      
        const transformedEvents = acceptedEvents.map(event => ({
          id: event._id.toString(),
          title: event.title,
          start: event.date,
          end: event.date,
          allDay: true,
          extendedProps: {
            club: event.clubMail.split('@')[0].toUpperCase(),
            room: event.roomNumber
          }
        }));
      
        res.json(transformedEvents);
      });

      res.json(transformedEvents);
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
    // get only accepted events from the database
    app.get("/get-responded-events-accepted/:email", async (req, res) => {
      const email = req.params.email;
      const events = await eventsCollection
        .find({ clubMail: email, response: "Accepted" })
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


    //Get all the events
    app.get("/all-events", async (req, res) => {
      const events = await eventsCollection.find().toArray();
      res.json(events);
    });



    // Announcement
    const announcementCollection = client.db("ClubSync").collection("announcements");

    app.get("/announcements", async (req, res) => {
      const announcements = await announcementCollection.find().toArray();
      res.json(announcements);
    });

    app.post("/add-announcement", async (req, res) => {
      const announcement = req.body;
      const result = await announcementCollection.insertOne(announcement);
      res.send(result);
    });

    app.delete("/delete-announcement/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await announcementCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/check-room-availability", async (req, res) => {
      const { date, roomNumber } = req.body;
      const result = await eventsCollection.findOne({
        date: date,  // Convert to YYYY-MM-DD format
        roomNumber: roomNumber,
        response: 'Accepted'
      });

      console.log(result)
  

      if (result) {
        res.json({ available: false });
      } else {
        res.json({ available: true });
      }
    })

    app.patch("/clubs-update/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id)
      const updatedData = req.body;
  
      const result = await clubCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );
  
      if (result.modifiedCount === 1) {
        res.status(200).send("Club updated successfully");
      } else {
        res.status(400).send("Failed to update club");
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

app.get("/", (req, res) => {
  res.send("Hello BRACU!");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});