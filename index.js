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

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send('unauthorized access')
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'forbidden access' })
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
    const wishListCollection = client.db("blueBirdRent").collection("wishlist");

    // Note: Make sure you use verifyAdmin after verifyJWT
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // Note: Make sure you use verifyAdmin after verifyJWT
    const verifySeller = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "seller") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.get('/properties', async (req, res) => {
      const area = req.query.area;
      if (area === 'null') {
        const query = { isRent: true };
        const properties = await propertyCollection.find(query).toArray();
        return res.send(properties);
      }
      else{
        const query = {
          isRent : true,
          area: area
        }
        const properties = await propertyCollection.find(query).toArray();
        return res.send(properties);
      }

    });

    app.get("/myProperty", async (req, res) => {
      const email = req.query.email;
      const query = { authorEmail: email };
      const property = await propertyCollection.find(query).toArray();
      res.send(property);
    })

    app.post('/properties', async (req, res) => {
      const property = req.body;
      const result = await propertyCollection.insertOne(property);
      res.send(result);
    })

    app.get('/propertyDetails/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id), isRent: true };
      const property = await propertyCollection.findOne(query);
      res.send(property);
    });

    app.get("/propertyDetails/:id/review", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const property = await propertyCollection.findOne(filter);
      const comment = await property.review;
      res.send(comment);
    });

    app.put("/propertyDetails/:id/review", async (req, res) => {
      const id = req.params.id;
      const review = req.body;
      const filter = { _id: new ObjectId(id) }
      const property = await propertyCollection.findOne(filter);
      const reviews = property.review;
      const newReviews = [...reviews, review];
      const option = { upsert: true };
      const updatedDoc = {
        $set: {
          review: newReviews,
        },
      };
      const result = await propertyCollection.updateOne(
        filter,
        updatedDoc,
        option
      );
      res.send(result);
    });

    app.put("/properties/update/:isRent", async (req, res) => {
      const isRent = req.params.isRent;
      const id = req.query.id;
      const availability = req.body;
      console.log(availability)
      const filter = { _id: new ObjectId(id) }
      const property = await propertyCollection.findOne(filter);
      const option = { upsert: true };
      let updatedDoc = {};
      if (isRent === 'hide') {
        updatedDoc = {
          $set: {
            isRent: false,
          },
        };
      } else {
        updatedDoc = {
          $set: {
            isRent: true,
            availability: availability.availability,
          },
        };
      }
      const result = await propertyCollection.updateOne(
        filter,
        updatedDoc,
        option
      );
      res.send({ acknowledged: true });
    })

    app.get('/jwt', async (req, res) => {
      const email = req.query.email;
      const query = {
        email: email
      };

      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "1h",
        })
        return res.send({ accessToken: token })
      }
      res.status(403).send({ accessToken: "" })
    });


    // booking related code

    app.get("/bookings", async (req, res) => {
      const query = {};
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/myBookings', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/myPropertyBooking', async (req, res) => {
      const email = req.query.email;
      const query = { authorEmail: email };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })

    app.put('/booking/:id', async(req, res) => {
      const id = req.params.id;
      const action = req.body;
      const filter = {_id : new ObjectId(id)};
      const option = { upsert: true };
      let updatedDoc = {
        $set: {
          action: action.action
        }
      };
      const result = await bookingCollection.updateOne(
        filter,
        updatedDoc,
        option
      );
      res.send({ acknowledged: true });
    })

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const query = {
        email: booking.email,
        propertyId: booking.propertyId
      };
      const alreadyBooked = await bookingCollection.find(query).toArray();
      if (alreadyBooked.length) {
        const message = `You already have a booking on this property`;
        return res.send({ acknowledged: false, message });
      }
      const result = await bookingCollection.insertOne(booking);
      res.send({ acknowledged: true });
    })

    // user related code

    app.get("/users", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.get("/activeUser", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const users = await usersCollection.findOne(query);
      res.send(users);
    })

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    app.get("/users/seller/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send({ isSeller: user?.role === "seller" });
    });

    app.get("/users/request/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send({ isRequest: user?.role === "sellerRequest" });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = {
        email: user.email,
      };
      const alreadyAssigned = await usersCollection.find(query).toArray();
      if (alreadyAssigned.length) {
        return res.send({ acknowledged: false });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.put("/user/update/:role", async (req, res) => {
      const email = req.query.email;
      console.log(email)
      const role = req.params.role;
      const filter = { email: email }
      const users = await usersCollection.findOne(filter);
      const option = { upsert: true };
      let updatedDoc = {};
      if (role === 'request') {
        updatedDoc = {
          $set: {
            role: 'sellerRequest',
          },
        };
      }
      else if (role === 'confirm') {
        updatedDoc = {
          $set: {
            role: 'seller',
          },
        };
      }
      else {
        updatedDoc = {
          $set: {
            role: 'user',
          },
        };
      }
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        option
      );
      res.send({ acknowledged: true });
    });
    app.put("/users/update/:email", async (req, res) => {
      const email = req.params.email;
      const phone = req.query.phone;
      const filter = { email: email }
      const users = await usersCollection.findOne(filter);
      const option = { upsert: true };
      let updatedDoc = {};
      updatedDoc = {
        $set: {
          phone: phone,
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        option
      );
      res.send({ acknowledged: true });
    });

    //  WishList

    app.get('/wishlist', async (req, res) => {
      const email = req.query.email;
      const properties = await propertyCollection.find({}).toArray();
      let wishlist = [];
      const wishlistQuery = { email: email };
      const mylist = await wishListCollection.find(wishlistQuery).toArray();

      properties.forEach(async (property) => {
        mylist.forEach(li => {
          if (JSON.stringify(property._id) === JSON.stringify(li.propertyId) && property.isRent === true) {
            wishlist = [...wishlist, property]
          }
        })
      })
      res.send(wishlist)
    })

    app.post("/wishlist", async (req, res) => {
      // const email = req.query.
      const list = req.body;
      const query = {
        email: list.email,
        propertyId: list.propertyId
      };
      const alreadyBooked = await wishListCollection.find(query).toArray();
      if (alreadyBooked.length) {
        const message = `Already have this property in your wishlist`;
        return res.send({ acknowledged: false, message });
      }
      const result = wishListCollection.insertOne(list);
      res.send({ acknowledged: true });
    })

    // temporary to update a field
    app.get('/addIsRent', async (req, res) => {
      const filter = { area: 'Ghulshan'};
      const option = { upsert: true };
      const updatedDoc = {
        $set: {
          location: 'House: 55,  Road: 3, Ghulshan, Dhaka, Bangladesh'
        }
      }
      const result = await propertyCollection.updateMany(filter, updatedDoc, option);
      res.send(result);
    });

  }
  finally {

  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Blue Bird Rent Server on port ${port}`)
})