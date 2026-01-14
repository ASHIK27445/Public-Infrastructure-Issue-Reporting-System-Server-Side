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
    // console.log("decoded info", decoded)
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
    const timelineCollection = database.collection('timeline')
    
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
      // const result = await issueCollection.find().toArray()
      // res.send(result)
      //better approach
      const result = await issueCollection.aggregate([
        {
          $lookup: {
            from: 'user',  //from which collection i want to lookup
            localField: 'reportBy',   //which field to select
            foreignField: '_id',       // field in user collection 
            // and "Match issueCollection.reportBy with userCollection._id"
            as: 'reporterInfo'
          }
        },
        {
            $addFields: {
              reporterName: { $arrayElemAt: ['$reporterInfo.name', 0]},
              reporterPhoto: {$arrayElemAt: ['$reporterInfo.photoURL', 0]}
              //$arrayElemAt: [ <array>, <index> ]
              // array → the array you want to get element from
              // index → which element (starts from 0)
              //Take the first element of the reporterInfo.name array
            }
        },
        {
          $project:{
            reporterInfo : 0 //hide original array sothat i can fetch only two item
          }
        }
      ]).toArray()

      res.send(result)

    })

    app.get('/detailIssues/:id', verifyFBToken, async(req, res)=>{
      const {id} = req.params
      const result = await issueCollection.aggregate([
          {
              $match: { _id: new ObjectId(id) }
          },
          {
              $lookup: {
                  from: 'user',          
                  localField: 'reportBy', 
                  foreignField: '_id', 
                  as: 'reporterInfo'         
              }
          },
          {
              $addFields: {
                reporterName: { $arrayElemAt: ['$reporterInfo.name', 0]},
                reporterPhoto: {$arrayElemAt: ['$reporterInfo.photoURL', 0]},
                reporterJoined:{$arrayElemAt:['$reporterInfo.createdAt', 0]}

              }
          },
          {
            $project:{
              reporterInfo : 0 
            }
          }
      ]).next() //Changed .toArray() to .next() to get a single document, because we got an array
      res.send(result)
    })

    //all users get:
    app.get('/allusers', verifyFBToken, async(req, res)=> {
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    //all staff get:
    app.get('/allstaff', verifyFBToken, async(req, res)=>{
      const query = {role: 'staff'}
      const result = await userCollection.find(query).toArray()
      res.send(result)
    })

    //user get:
    app.get('/user/citizen', verifyFBToken, async(req, res)=>{
      const email = req.decoded_email
      // const query = {email: email}
      const result = await userCollection.findOne({email})
      res.send(result)
    })

    //my issues
    app.get('/myissues/:id', verifyFBToken, async(req, res)=>{
      const {id} = req.params
      const query = {reportBy: new ObjectId(id)}
      const result = await issueCollection.find(query).toArray()
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

      // Check if user is blocked
      if(user.isBlocked){
        return res.status(403).send({message: "Your account is blocked. Cannot report issues."})
      }

      // Check issue limit for free users
      const FREE_USER_LIMIT = 3;
      if(!user.isPremium && user.issueCount >= FREE_USER_LIMIT){
        return res.status(403).send({
          message: "You have reached your free issue limit. Please upgrade to Premium.",
          requiresPremium: true
        })
      }

      data.reportBy = user._id
      delete data.citizenEmail

      data.status = 'Pending'
      data.priority = 'Normal'
      data.upvotes = []
      data.upvoteCount = 0
      data.assignInto = null
      data.createdAt = new Date()
      
      console.log(data)
      
      // Insert the issue
      const result = await issueCollection.insertOne(data)
      
      // Increment user's issue count
      await userCollection.updateOne(
        { _id: user._id },
        { 
          $inc: { issueCount: 1 },
          $set: { updatedAt: new Date() }
        }
      )
      
      res.send(result)
    })

    //Adding Staff
    app.post('/addstaff', verifyFBToken, async(req, res)=> {
      const {email, password, name, photoURL, tel, dept}= req.body

      const userRecord = await admin.auth().createUser({
        email, 
        password,
        displayName: name,
        photoURL,
        phoneNumber: tel
      })
      const staffInfo = {
        name, email, password, photoURL, tel
      }
      staffInfo.uid = userRecord.uid
      staffInfo.role = 'staff'
      staffInfo.dept = dept
      staffInfo.isBlocked = false
      staffInfo.assignIssued = 0
      staffInfo.resolvedIssued = 0
      staffInfo.createdAt = new Date()
      console.log(staffInfo)
      const result = await userCollection.insertOne(staffInfo)
      res.send({_id: result.insertedId, ...staffInfo})
    })

    //Assign staff
    app.post('/assign-staff', verifyFBToken, async(req, res)=> {
    /*--------------------Admin check--------------------------*/
    const adminUser = await userCollection.findOne({ email: req.decoded_email });
    
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).send({ message: "Forbidden! Admin access required" });
    }

    const {issueId, staffId} = req.body

    /**-----------------Staff query----------------------------- */
    const staff = await userCollection.findOne({_id: new ObjectId(staffId)})
    if(!staff){
      return res.status(404).send({message: "Staff not found!"})
    }

    /**------------------Assign Staff and Issue Update----------- */
    const issueQuery = {_id: new ObjectId(issueId)}
    const issue = await issueCollection.findOne(issueQuery);
    if (!issue || issue.assignInto) {
      return res.status(400).send({ message: "Issue already assigned" });
    }
    const issueUpdate = {
      $set: {
        assignInto: staff._id,
        assignedStaff: {
          _id: staff._id,
          name: staff.name,
          department: staff.dept,
          tel: staff.tel,
          photoURL: staff.photoURL,
          assignedAt: new Date(),
          assignBy: adminUser.name
        }
        
      }
    }

    const issueResult = await issueCollection.findOneAndUpdate(issueQuery, issueUpdate, {returnDocument: 'after'})

    /**-------------------Assign Count----------------------------- */
    const assignCount = {
      $inc: {assignIssued: 1}
    }

    await userCollection.updateOne({_id: staff._id}, assignCount)

    // console.log(issueResult)

    /**------------------Sending Response---------------------------*/
    res.send({success: true, issue: issueResult})
    })

    //---------------------------------------------------------------------//
    //put/update method
    //---------------------------------------------------------------------//

    //update user status
    app.patch('/update/user/status', verifyFBToken, async (req, res) => {
      const { email, isBlocked } = req.body; // ✅ BODY

      const query = { email };
      const updateIsBlocked = {
        $set: { isBlocked }
      };

      const result = await userCollection.updateOne(query, updateIsBlocked);
      res.send(result);
    });

    //update staff info
    app.patch('/update/staff/info', verifyFBToken, async(req, res)=>{
    const adminUser = await userCollection.findOne({ email: req.decoded_email });
    
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).send({ message: "Forbidden! Admin access required" });
    }

    const {uid, name, password, tel, dept} = req.body

      /* ---------- Firebase Auth update ---------- */
    const authUpdateData = {}
    if (name) authUpdateData.displayName = name
    if (password) authUpdateData.password = password

    if (Object.keys(authUpdateData).length > 0) {
      await admin.auth().updateUser(uid, authUpdateData)
    }

    /* ---------- MongoDB update ---------- */
    const query = { uid }
    const updateStaff = {
      $set: {
        name,
        tel,
        dept,
        updatedAt: new Date()
      }
    }

    const result = await userCollection.updateOne(query, updateStaff)
    res.send(result)
    })
    
    // UPDATE: Edit an issue
    app.patch('/issue/:id', verifyFBToken, async(req, res) => {
      try {
        const { id } = req.params;
        const updateData = req.body;
        const email = req.decoded_email;

        // First, get the user to verify ownership
        const user = await userCollection.findOne({email});
        if (!user) {
          return res.status(401).send({ message: 'User not found' });
        }

        // Check if the issue exists and belongs to this user
        const issue = await issueCollection.findOne({ 
          _id: new ObjectId(id),
          reportBy: user._id
        });

        if (!issue) {
          return res.status(404).send({ message: 'Issue not found or you do not have permission to edit it' });
        }

        // If updating regular fields (not just status), only allow editing if status is Pending
        const isStatusOnlyUpdate = Object.keys(updateData).length === 1 && updateData.status;
        
        if (!isStatusOnlyUpdate && issue.status !== 'Pending') {
          return res.status(403).send({ message: 'Can only edit content of pending issues' });
        }

        // Update allowed fields only
        const allowedFields = ['title', 'description', 'category', 'location', 'status', 'priority'];
        const filteredUpdate = {};
        
        for (const field of allowedFields) {
          if (updateData[field] !== undefined) {
            filteredUpdate[field] = updateData[field];
          }
        }

        // Add updatedAt timestamp
        filteredUpdate.updatedAt = new Date();

        const result = await issueCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: filteredUpdate }
        );

        res.send(result);
      } catch (error) {
        console.error('Error updating issue:', error);
        res.status(500).send({ message: 'Failed to update issue' });
      }
    });

    //UPDATE: Rejected issue
    app.patch('/reject-issue', verifyFBToken, async(req, res)=> {
    /**----------------------Admin Check----------------------------- */
    const adminUser = await userCollection.findOne({ email: req.decoded_email });
    
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).send({ message: "Forbidden! Admin access required" });
    }

    const {issueId, reason} = req.body

    /**--------------------Update Issue Status---------------------- */
    const query = {_id: new ObjectId(issueId)}
    const update = {
        $set: {
          status: 'Rejected',
          rejectedReason: reason,
          rejectedBy: adminUser.name,
          rejectedAt: new Date()
        }
    }

    const result = await issueCollection.updateOne(query, update)

    res.send(result)

    })

    // PROFILE UPDATE: Update user profile information
    app.patch('/user/update', verifyFBToken, async(req, res) => {
      try {
        const email = req.decoded_email;
        const { name, phone, address } = req.body;

        // Find user
        const user = await userCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ message: 'User not found' });
        }

        // Update fields
        const updateData = {};
        if (name) updateData.name = name;
        if (phone) updateData.phone = phone;
        if (address) updateData.address = address;
        updateData.updatedAt = new Date();

        const result = await userCollection.updateOne(
          { email },
          { $set: updateData }
        );

        res.send(result);
      } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).send({ message: 'Failed to update profile' });
      }
    });

    // SUBSCRIBE: Make user premium
    app.post('/user/subscribe', verifyFBToken, async(req, res) => {
      try {
        const email = req.decoded_email;
        const { amount, userId } = req.body;

        // Find user
        const user = await userCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ message: 'User not found' });
        }

        // Check if already premium
        if (user.isPremium) {
          return res.status(400).send({ message: 'User is already premium' });
        }

        // Check if blocked
        if (user.isBlocked) {
          return res.status(403).send({ message: 'Blocked users cannot subscribe' });
        }

        // In production, integrate with payment gateway here
        // For now, we'll just update the user status
        
        // Verify payment amount
        if (amount !== 1000) {
          return res.status(400).send({ message: 'Invalid payment amount' });
        }

        // Update user to premium
        const result = await userCollection.updateOne(
          { email },
          { 
            $set: { 
              isPremium: true,
              subscribedAt: new Date(),
              updatedAt: new Date()
            } 
          }
        );

        res.send({ 
          success: true, 
          message: 'Successfully subscribed to premium!',
          data: result
        });
      } catch (error) {
        console.error('Error subscribing:', error);
        res.status(500).send({ message: 'Subscription failed' });
      }
    });

    //------------------------------------------------------------------------------------//
    //delete method
    //------------------------------------------------------------------------------------//

    //Delete staff:
    app.delete('/delete/staff/:id', verifyFBToken, async(req, res)=> {
      const adminUser = await userCollection.findOne({email: req.decoded_email})

      //checking admin
      if(!adminUser || adminUser.role !== 'admin'){
        return res.status(403).send({message: "Admin access required"})
      }

      //find staff
      const {id} = req.params
      const staff = await userCollection.findOne({
        _id: new ObjectId(id),
        role: 'staff'
      })

      //check staff
      if(!staff){
        return res.status(403).send({message: "Staff not found!"})
      }

      //check assigned issues
      if(staff.assignIssued > 0){
        return res.status(400).send({
          message: `Can't Delete. Staff has ${staff.assignIssued} assigned issue(s).`,
          assignIssued: staff.assignIssued
        })
      }

      //delete from firebase
      await admin.auth().deleteUser(staff.uid)

      //delete from mongodb
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.deleteOne(query)

      res.send(result)
    })

    // DELETE: Remove an issue (user can only delete their own issues)
    app.delete('/issue/:id', verifyFBToken, async(req, res) => {
      try {
        const { id } = req.params;
        const email = req.decoded_email;

        // Get the user
        const user = await userCollection.findOne({email});
        if (!user) {
          return res.status(401).send({ message: 'User not found' });
        }

        // Check if the issue exists and belongs to this user
        const issue = await issueCollection.findOne({ 
          _id: new ObjectId(id),
          reportBy: user._id
        });

        if (!issue) {
          return res.status(404).send({ message: 'Issue not found or you do not have permission to delete it' });
        }

        // Delete the issue
        const result = await issueCollection.deleteOne({ _id: new ObjectId(id) });

        // Decrement user's issue count
        await userCollection.updateOne(
          { _id: user._id },
          { 
            $inc: { issueCount: -1 },
            $set: { updatedAt: new Date() }
          }
        );

        res.send(result);
      } catch (error) {
        console.error('Error deleting issue:', error);
        res.status(500).send({ message: 'Failed to delete issue' });
      }
    });

    


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