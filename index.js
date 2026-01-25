require('dotenv').config()
const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')
const stripe = require('stripe')(process.env.stripe_secretKey)

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

    // await client.connect();

    //database creation
    const database = client.db('PIIRS')
    const userCollection = database.collection('user')
    const issueCollection = database.collection('issue')
    const upvoteCollection = database.collection('upvote')
    const timelineCollection = database.collection('timeline')
    const paymentCollection = database.collection('payment')
    
    //get method
    app.get('/user/role/:email', async(req, res)=>{
        const {email} = req.params
        const query = {email:email}
        const result = await userCollection.findOne(query)
        // console.log(result)
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

    app.get('/detailIssues/:id', async(req, res)=>{
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
                reporterJoined:{$arrayElemAt:['$reporterInfo.createdAt', 0]},
                reporterIssueCount: {$arrayElemAt: ['$reporterInfo.issueCount', 0]},
                reportRejectedIssueCount: {$arrayElemAt: ['$reporterInfo.rejectedIssueCount', 0]}
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
    
    app.get('/assigned-issues/:staffId', verifyFBToken, async(req, res)=> {
      const {staffId} = req.params

      // First get all issues
      const issues = await issueCollection.find({ 
        assignInto: new ObjectId(staffId) 
      }).toArray()

      // Then populate reporter for each issue
      const populatedIssues = await Promise.all(
        issues.map(async (issue) => {
          try {
            const reporter = await userCollection.findOne(
              { _id: new ObjectId(issue.reportBy) }, // Convert string to ObjectId
              { 
                projection: { 
                  name: 1, 
                  email: 1, 
                  photoURL: 1 
                } 
              }
            )
            
            return {
              ...issue,
              reporter: reporter || null
            }
          } catch (error) {
            console.error('Error populating reporter:', error)
            return {
              ...issue,
              reporter: null
            }
          }
        })
      )

      res.send(populatedIssues)
    })

    //get upvote info
    app.get('/upvote-info/:issueId', async(req, res)=> {
      const {issueId} = req.params
      const {userId} = req.query
      const query = {_id: new ObjectId(issueId)}
      const result = await upvoteCollection.findOne(query)

      const hasUpvoted = userId ?  result?.upvoteUsers?.[userId] : false
      
      const count = result?.count

      res.send({hasUpvoted, count})
    })


    //get timeline info
    app.get('/timeline/:timelineId', async(req, res)=> {
      const {timelineId} = req.params
      const result = await timelineCollection.findOne({_id: new ObjectId(timelineId)})
      res.send(result)
    })

    //verify subscription payment
    app.get('/verify-payment/:sessionId', verifyFBToken, async(req, res) => {
      const {sessionId} = req.params;

      /**------------------------Retrieve Session------------------------- */
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      // console.log('🔍 Stripe Session Data:', {
      //   sessionId: session.id,
      //   payment_status: session.payment_status,
      //   client_reference_id: session.client_reference_id,
      //   customer_email: session.customer_email,
      //   amount_total: session.amount_total,
      //   metadata: session.metadata
      // })

      if (session.payment_status !== 'paid') {
        return res.json({ 
          success: false, 
          paid: false, 
          message: 'Payment not completed',
          payment_status: session.payment_status
        });
      }

      /**-------------------------User Verification---------------------- */
      const userId = session.client_reference_id

      const user = await userCollection.findOne({_id: new ObjectId(userId)});

      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found',
          userId: userId 
        });
      }


      //Check if already premium (prevent duplicate update)
      if (user.isPremium) {
        return res.json({
          success: true,
          paid: true,
          alreadyPremium: true,
          message: 'User is already premium',
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            isPremium: user.isPremium
          }
        })
      }

      /**----------------------------Update User Collection--------------------- */
      const result = await userCollection.updateOne(
        { _id: new ObjectId(userId) },
        { 
          $set: { 
            isPremium: true,
            subscribedAt: new Date(),
            subscriptionAmount: parseInt(session.amount_total / 100),
            subscriptionType: session.metadata?.type || 'premium',
            stripeSessionId: sessionId,
            updatedAt: new Date()
          } 
        }
      );


      /**--------------------------Insert in payment collection-------------------- */
      await paymentCollection.insertOne({
        _id: new ObjectId(),
        userId: new ObjectId(userId),
        actionType: `${session.metadata?.type}`,
        title: `${session.metadata?.type} Subscription Activated`,
        description: `Purchased ${session.metadata?.type || 'premium'} subscription for ${session.amount_total / 100} BDT`,
        performedBy: {
          userId: new ObjectId(userId),
          name: user.name,
          email: user.email,
          role: user.role,
          photoURL: user.photoURL
        },
        data: {
          currency: 'BDT',
          amount: parseInt(session.amount_total / 100),
          type: session.metadata?.type || 'premium',
          stripeSessionId: sessionId,
          customerEmail: session.customer_email
        },
        paymentAt: new Date()
      })

      return res.json({
        success: true,
        paid: true,
        message: 'Payment verified and user upgraded to premium',
        session: {
          id: session.id,
          payment_status: session.payment_status,
          amount: session.amount_total / 100,
          type: session.metadata?.type || 'premium'
        },
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          isPremium: true
        },
        database: {
          updated: result.modifiedCount > 0,
          matched: result.matchedCount > 0
        }
      })
    })

    //verify boost payment
    app.get('/verify-boost-payment/:sessionId', verifyFBToken, async(req, res) => {
      const {sessionId} = req.params;

      /**------------------------Retrieve Session------------------------- */
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      console.log('🔍 Boost Session Data:', {
        sessionId: session.id,
        payment_status: session.payment_status,
        metadata: session.metadata
      });

      if (session.payment_status !== 'paid') {
        console.log('❌ Boost payment not completed:', session.payment_status);
        return res.json({ 
          success: false, 
          paid: false, 
          message: 'Payment not completed',
          payment_status: session.payment_status
        });
      }

      const metadata = session.metadata;
      const userId = session.client_reference_id
      const issueId = metadata.issueId;
      const amount = session.amount_total;
      const boostType = metadata.type;

      /**-------------------------User Verification---------------------- */
      const user = await userCollection.findOne({_id: new ObjectId(userId)});

      if (!user) {
        console.log('❌ User not found for boost payment');
        return res.status(404).json({ 
          success: false, 
          message: 'User not found'
        });
      }

      /**-------------------------Issue Verification---------------------- */
      let issue = null;
      if (issueId) {
        issue = await issueCollection.findOne({_id: new ObjectId(issueId)});
        
        if (!issue) {
          console.log('❌ Issue not found for boost');
          return res.status(404).json({ 
            success: false, 
            message: 'Issue not found'
          });
        }
      }

      console.log('✅ All verifications passed for boost payment');

      // Check if boost already exists for this issue
      const existingPayment = await paymentCollection.findOne({
        'data.stripeSessionId': sessionId,
        actionType: { $regex: /boost/i }
      });

      if (existingPayment) {
        console.log('ℹ️ Boost payment already recorded for this session');
        return res.json({
          success: true,
          paid: true,
          alreadyProcessed: true,
          message: 'Boost already processed',
          amount: amount,
          type: boostType,
          issue: issue
        });
      }

      /**-------------------------Update Issue Priority---------------------- */
      
      if (issueId && issue) {
        // Update issue priority to "High"
        await issueCollection.updateOne(
          { _id: new ObjectId(issueId) },
          { 
            $set: { 
              priority: 'High',
              isBoosted: true,
              boostedAt: new Date(),
              boostedBy: user._id,
              boostType: boostType,
              boostAmount: amount
            },
            $inc: { boostCount: 1 }
          }
        );

        console.log('✅ Issue priority updated to High');
      }

      /**-------------------------Create Timeline Entry---------------------- */
      await timelineCollection.updateOne(
        {_id: new ObjectId(issueId)},
        {
          $push: {
            changes: {
              type: "boost",
              title: "Boosted Priority",
              description: `Issue is boosted on High Priority`,
              role: user?.role,
              updatedBy: user?.name,
              createdAt: new Date()
            }
          }
        }
      )

      console.log('✅ Timeline entry created for boost');

      /**-------------------------Create Payment Record---------------------- */
      await paymentCollection.insertOne({
        _id: new ObjectId(),
        userId: new ObjectId(userId),
        actionType: `${session.metadata?.type}`,
        title: `${session.metadata?.type} Priority Activated`,
        description: `Purchased ${session.metadata?.type} priority for ${session.amount_total / 100} BDT`,
        performedBy: {
          userId: new ObjectId(userId),
          name: user.name,
          email: user.email,
          role: user.role,
          photoURL: user.photoURL
        },
        data: {
          currency: 'BDT',
          amount: parseInt(session.amount_total / 100),
          type: session.metadata?.type || 'premium',
          stripeSessionId: sessionId,
          customerEmail: session.customer_email
        },
        paymentAt: new Date()
      })
      console.log('✅ Payment record saved');

      /**-------------------------Send Response---------------------- */
      const responseData = {
        success: true,
        paid: true,
        message: 'Payment verified and issue boosted successfully',
        amount: amount,
        type: boostType,
        sessionId: sessionId,
        session: {
          id: session.id,
          payment_status: session.payment_status,
          amount: amount
        },
        user: {
          id: user._id,
          email: user.email,
          name: user.name
        }
      };

      // Add issue details if available
      if (issue) {
        responseData.issue = {
          _id: issue._id,
          title: issue.title,
          priority: 'High', // Updated priority
          status: issue.status,
          isBoosted: true
        };
      }

      res.json(responseData);
    })

    //payment history(user)
    app.get('/user-payment-history/:userId', verifyFBToken, async(req, res)=> {
      const {userId} = req.params
      const query = {userId: new ObjectId(userId)}
      const result = await paymentCollection.find(query).toArray()
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
        userInfo.rejectedIssueCount = 0
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
      
      //create upvote 
      await upvoteCollection.insertOne({
        _id: result.insertedId,
        upvoteUsers: {},
        count: 0
      })

      //create timeline
      const timellineEntry = {
        _id: result.insertedId,
        citizen_id: user._id,
        issueCreatorRole: user.role,
        issueCreatedBy: user.name,
        issueCreatedAt: data.createdAt
      }

      const timeline = await timelineCollection.insertOne(timellineEntry)
      console.log(timeline)
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
          email: staff.email,
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

    /**--------------------timeline updated changes--------------- */
    await timelineCollection.updateOne(
      {_id: new ObjectId(issueId)},
      {
        $push: {
          changes: {
            type: "assigned",
            title: "Assigned to Department",
            description: `Issue assigned to ${staff.dept} Department`,
            role: 'admin',
            updatedBy: adminUser.name,
            assignTo: staff.name,
            createdAt: new Date()
          }
        }
      }
    )

    // console.log(issueResult)

    /**------------------Sending Response---------------------------*/
    res.send({success: true, issue: issueResult})
    })

    //upvote
    app.post('/upvote/:issueId', verifyFBToken, async(req, res)=> {
      const {issueId} = req.params
      const userEmail = req.decoded_email

      /**---------------------Find User-------------------------- */
      const user = await userCollection.findOne({email: userEmail})
      if(!user){
        return res.status(404).send({message: "User not found!"})
      }

      /**----------------------Find Issue------------------------ */
      const issue = await issueCollection.findOne({_id: new ObjectId(issueId)})
      if (!issue) {
            return res.status(404).json({ 
                success: false, 
                message: "Issue not found" 
            });
        }
        
        //Check if user owns the issue
        if (issue.reportBy.toString() === user._id.toString()) {
            return res.status(400).json({ 
                success: false, 
                message: "You cannot upvote your own issue" 
            })
        }

        /**-------------------------find Upvote---------------------- */
        const upvote = await upvoteCollection.findOne({_id: new ObjectId(issueId)})

        const userIdStr = user._id.toString()

        /********check if already upvoted***********/
        if(upvote && upvote.upvoteUsers[userIdStr]){
          //remove upvote(toggle)
          await upvoteCollection.updateOne(
            {_id: new ObjectId(issueId)},
            {
              $unset: {[`upvoteUsers.${userIdStr}`]: ''},
              $inc: {count: -1},
              $set: {updatedAt: new Date()}
            }
          )

        //updated upvote from database
        const updateUpvote = await upvoteCollection.findOne({_id: new ObjectId(issueId)})

        //sent response
        return res.json({
          success: true,
          message: 'upvote remove',
          upvoteCount: updateUpvote?.count || 0,
          hasUpvoted: false
          })
          
        }

        /*********Add Upvote******************** */
        await upvoteCollection.updateOne(
          {_id: new ObjectId(issueId)},
          {
            $set: {
              [`upvoteUsers.${userIdStr}`]: true,
              updatedAt: new Date()
            },
            $inc: {count: 1}
          },
          {upsert: true}
        )//doesn't neceesary to use upsert here;

        const updateUpvote = await upvoteCollection.findOne({ 
            _id: new ObjectId(issueId) 
        });
        
        res.json({
            success: true,
            message: "Upvoted successfully",
            upvoteCount: updateUpvote.count || 0,
            hasUpvoted: true
        });
    })

    //payment checkout
    app.post('/create-checkout-session', verifyFBToken, async(req, res)=> {
      const userEmail = req.decoded_email
      const {type, issueId} = req.body

      let amount
      let productName
      let description
      let success_url

      if(type === 'basic'){
        amount = 500
        productName = 'Basic Subscription';
        description = 'Basic access with limited features'
        success_url = `${process.env.FRONTEND_URL}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`
      }else if(type === 'premium'){
        amount = 1000
        productName = 'Premium Subscription';
        description = 'Unlimited issue submissions and priority support'
        success_url = `${process.env.FRONTEND_URL}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`
      }else if(type === 'normal_boost'){
        amount = 100
        productName = 'Issue Boost';
        description = 'Boost this issue for higher priority';
        success_url = `${process.env.FRONTEND_URL}/payment-boost-success?session_id={CHECKOUT_SESSION_ID}`
      }

      /**------------------checking user------------------------------*/
      const user = await userCollection.findOne({email: userEmail})
      if(!user){
        return res.status(404).json({success: false, message: 'User not found!'})
      }

      if (user.isPremium && type !== 'normal_boost') {
        return res.status(400).json({ success: false, message: 'User is already premium' });
      }

      if (user.isBlocked) {
        return res.status(403).json({ success: false, message: 'Blocked users cannot subscribe' });
      }

      const userId = user?._id.toString()

      /**-----------------Conditional metadata--------------------- */
      let metadata
      if(type === 'normal_boost'){
        metadata = {
          userId: userId,
          userEmail: userEmail,
          amount: amount,
          type: type,
          issueId: issueId
        }
      }else{
        metadata = {
          userId: userId,
          userEmail: userEmail,
          amount: amount,
          type: type
        }
      }

      /**------------------Stripe Session -------------------------- */
      const session = await stripe.checkout.sessions.create({
        customer_email: userEmail,
        client_reference_id: userId,
        line_items: [
        {
          price_data: {
            currency: 'bdt',
            product_data: {
              name: productName,
              description: description,
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
        ],
        mode: 'payment',
        success_url: success_url,
        cancel_url: `${process.env.FRONTEND_URL}/dashboard/payment-cancel`,
        metadata: metadata
      })

      res.status(200).json({
        success: true,
        sessionId: session.id, 
        sessionURL: session.url
      })

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


        //update timeline
        await timelineCollection.updateOne(
          {_id: new ObjectId(id)},
          {
            $push:{
              changes: {
                type: "issue-updated",
                title: "Issue Updated",
                description: "Issue details updated by reporter",
                role: "citizen",
                updatedBy: user.name,
                createdAt: new Date()
              }
            }
          }
        )

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

    /**--------------------Find Issue & Reporter---------------------- */
    const issue = await issueCollection.findOne({ _id: new ObjectId(issueId) })
    if (!issue) return res.status(404).send({ message: "Issue not found" })

    const reporterId = issue.reportBy

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

    /**----------------------Update Timeline---------------------- */
    await timelineCollection.updateOne(
      {_id: new ObjectId(issueId)},
      {
        $push: {
          changes: {
            type: 'rejected',
            title: 'Issue Rejected',
            description: reason,
            role: 'admin',
            updatedBy: adminUser.name,
            createdAt: new Date()
          }
        }
      }
    )

    /**--------------------Update Rejected Issue Count------------ */
    await userCollection.updateOne(
      {_id: new ObjectId(reporterId)},
      {
        $inc: {
          rejectedIssueCount: 1
        }
      }
    )


    res.send(result)

    })

    //UPDATE: Issue status
    app.patch('/update-issue-status/:issueId', verifyFBToken, async(req, res)=> {
      const {issueId}= req.params
      const {newStatus, closeReason} = req.body

      const issueQuery = {_id: new ObjectId(issueId)}
      const issue = await issueCollection.findOne(issueQuery)

      if (!issue) {
        return res.status(404).json({ 
          success: false, 
          message: 'Issue not found' 
        })
      }

      const updateData = {
        status: newStatus,
        updatedAt: new Date()
      }

       if (newStatus === 'In-Progress') {
      updateData.inProgressAt = new Date();
      } 
      else if (newStatus === 'Working') {
        updateData.workingAt = new Date();
      }
      else if (newStatus === 'Resolved') {
        updateData.resolvedAt = new Date();

        if(issue.assignInto){
          await userCollection.updateOne(
          { _id: issue.assignInto},
          {$inc: {
            assignIssued: -1,
            resolvedIssued: 1
          }})
        }

      }
      else if (newStatus === 'Closed') {
        updateData.closedAt = new Date();

        if(closeReason){
          updateData.closeNote = closeReason
        }

        if(issue.assignInto && !issue.resolvedAt){
          await userCollection.updateOne(
            { _id: issue.assignInto},
            {$inc: {
              assignIssued: -1
            }}
          )
        }
      }
      
      // Update the issue
      const result = await issueCollection.updateOne(
        { _id: new ObjectId(issueId) },
        { $set: updateData }
      )

      /**--------------------Added Timeline----------------- */
      await timelineCollection.updateOne(
        {_id: new ObjectId(issueId)},
        {
          $push: {
            changes: {
              type: newStatus,
              title: "Status Updated",
              description: closeReason || `Issue marked as ${newStatus}`,
              role: 'staff',
              updatedBy: issue.assignedStaff.name,
              createdAt: new Date()
            }
          }
        }
      )

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
    // app.post('/user/subscribe', verifyFBToken, async(req, res) => {
    //   try {
    //     const email = req.decoded_email;
    //     const { amount, userId } = req.body;

    //     // Find user
    //     const user = await userCollection.findOne({ email });
    //     if (!user) {
    //       return res.status(404).send({ message: 'User not found' });
    //     }

    //     // Check if already premium
    //     if (user.isPremium) {
    //       return res.status(400).send({ message: 'User is already premium' });
    //     }

    //     // Check if blocked
    //     if (user.isBlocked) {
    //       return res.status(403).send({ message: 'Blocked users cannot subscribe' });
    //     }

    //     // In production, integrate with payment gateway here
    //     // For now, we'll just update the user status
        
    //     // Verify payment amount
    //     if (amount !== 1000) {
    //       return res.status(400).send({ message: 'Invalid payment amount' });
    //     }

    //     // Update user to premium
    //     const result = await userCollection.updateOne(
    //       { email },
    //       { 
    //         $set: { 
    //           isPremium: true,
    //           subscribedAt: new Date(),
    //           updatedAt: new Date()
    //         } 
    //       }
    //     );

    //     res.send({ 
    //       success: true, 
    //       message: 'Successfully subscribed to premium!',
    //       data: result
    //     });
    //   } catch (error) {
    //     console.error('Error subscribing:', error);
    //     res.status(500).send({ message: 'Subscription failed' });
    //   }
    // });

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