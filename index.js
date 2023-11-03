const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken')
const app = express();
const port = process.env.PORT || 5000;


//middle ware
app.use(cors());
app.use(express.json());



// db connection

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6dlynzp.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

function verifyJWT(req,res,next){
  const authHeader = req.headers.authorization;
  if(!authHeader){
    return res.status(401).send('unauthorized access')
  }

  const token = authHeader.split(' ')[1];
  
  jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
    if(err){
      return res.status(403).send({message: 'forbidden access'})
    }
    req.decoded = decoded;
    next();
  })
}

async function run() {
  try {
    await client.connect();
    const propertyCollection = client.db("blueBirdRent").collection("properties");
    const usersCollection = client.db("blueBirdRent").collection("users");
    const bookingCollection = client.db("blueBirdRent").collection("bookings");


    app.get('/properties', async (req, res) => {
      const query = {};
      const properties = await propertyCollection.find(query).toArray();
      res.send(properties);
    });

    app.post('/properties', verifyJWT, async( req, res) =>{
      const property = req.body;
      console.log(property)
      const result = await propertyCollection.insertOne(property);
      res.send(result);
    })

    app.get('/propertyDetails/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const property = await propertyCollection.findOne(query);
      res.send(property);
    });

    app.get('/jwt', async(req, res) => {
      const email = req.query.email;
      const query = {
        email: email
      };

      const user = await usersCollection.findOne(query);
      if(user) {
        const token = jwt.sign({email}, process.env.ACCESS_TOKEN, {
          expiresIn: "1h",
        })
        return res.send({accessToken: token})
      }
      res.status(403).send({accessToken: ""})
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // booking related code

    app.get('/bookings',verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;

      if(email !== decodedEmail){
        return res.status(403).send("forbidden access");
      }

      // console.log(req.decoded)

      const query = {email: email};
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })

    app.post("/bookings", async(req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    })

    // temporary to update a field
    app.get('/addIsRent', async(req, res) => {
        const filter = {};
        const option = { upsert : true };
        const updatedDoc = {
            $set: {
                video: 'https://res.cloudinary.com/dtoj9n94u/video/upload/v1696745852/mp4_cnr_14_ratebypass_yes_dur_134_257_lmt_1669835332979732_mt_16_fdllti.mp4'
            }
        }
        const result = await propertyCollection.updateMany(filter, updatedDoc, option);
        res.send(result);
    })

  }
  finally {

  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`RentGo Server on port ${port}`)
})