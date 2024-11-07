const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: ['http://localhost:5174','http://localhost:5173'],
    credentials: true
  }));
  app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.b6ckjyi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

    } finally {
        // await client.close();
      }
    }
    run().catch(console.dir);
    
    app.get('/', (req, res) => {
      res.send('Hello BRACU!');
    });
    
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });