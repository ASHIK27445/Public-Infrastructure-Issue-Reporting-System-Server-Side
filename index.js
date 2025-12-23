const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const cors = require('cors')
require('dotenv').config()

const port = process.env.PORT

const app = express()
app.use(cors())
app.use(express.json())

const admin = require("firebase-admin")

const decoded = Buffer.from(process.env.FB_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if(!token){
    return res.status(401).send({message: 'unauthorized access'})
  }

  try{
    const idToken = token.split(' ')[1]
    const decoded = await admin.auth().verifyIdToken(idToken)
    console.log("decoded info", decoded)
    req.decoded_email = decoded.email
    next()
  }catch(err){
    return res.status(401).send({message: 'unauthorized access'})
  }
}





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.md2layq.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    await client.connect();

    //database creation
    const database = client.db('PIIRS')
    const userCollection = database.collection('user')
    const issueCollection = database.collection('issue')
    
    //get method
    app.get('/user/role/:email', async(req, res)=>{
        const {email} = req.params
        const query = {email:email}
        const result = await userCollection.findOne(query)
        console.log(result)
        res.send(result)
    })

    app.get('/manageissues/:email', async(req, res)=>{
      const {email}= req.params
      const query = {citizenEmail: email}
      const result = await issueCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/allissues', async(req, res)=>{
      const result = await issueCollection.find().toArray()
      res.send(result)
    })

    app.get('/detailIssues/:id', verifyFBToken, async(req, res)=>{
      const {id} = req.params
      const query = {_id: new ObjectId(id)}
      const result = await issueCollection.findOne(query)
      res.send(result)
    })

    //post method

    //User Registration
    app.post('/users', async(req, res)=>{
        const userInfo = req.body
        userInfo.role = 'citizen'
        userInfo.isPremium = false
        userInfo.isBlocked = false
        userInfo.issueCount = 0
        userInfo.createdAt = new Date()
        const result = await userCollection.insertOne(userInfo)
        res.send(result)
    })

    //Adding Issues
    app.post('/addissue', verifyFBToken, async(req, res)=>{
      const data = req.body
      const user = await userCollection.findOne({email: data.citizenEmail})
      if(!user){
        return res.status(401).send("User not found")
      }
      data.reportBy = user._id
      delete data.citizenEmail

      data.status = 'pending'
      data.priority = 'normal'
      data.upvotes = []
      data.upvoteCount = 0
      data.assignInto = null
      data.createdAt = new Date()
      console.log(data)
      const result = await issueCollection.insertOne(data)
      res.send(result)
    })

    //put/update method



    //delete method


    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

    //await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res)=>{
    res.send("Hello there!!!!")
})

app.listen(port, ()=>{
    console.log(`App is running on the port ${port}`)
})