require('dotenv').config()
const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')
const stripe = require('stripe')(process.env.stripe_secretKey)
const { setupCommentSummaryRoute } = require('./googlegenerativeai');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { v4: uuidv4 } = require('uuid')
const { 
  sendRegistrationConfirmation, 
  sendPaymentConfirmationEmail,
  sendWaitlistConfirmation,
  sendWaitlistPromotion,
  sendEventReminder,
  sendDonorThankYou
} = require("./emailService")

//toxicity Checker
const {checkToxicity} = require('./checkToxicity')

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

const optionalFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    req.decoded_email = null;
    return next(); // ✅ token না থাকলেও proceed
  }

  try {
    const idToken = token.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    req.decoded_email = null;
    next(); // ✅ token invalid হলেও proceed
  }
}

//comments insight generaTIVE GOOGLE AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });


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
    const reportCollection = database.collection('report')
    const commentCollection = database.collection('comment')
    const eventCollection = database.collection('event')
    const eventRegistrationCollection = database.collection('eventRegistration')
    const donationCollection = database.collection('donation')

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

    //public all issues
    app.get('/allissues', async(req, res)=>{
      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 8
      const skip = (page - 1) * limit
      
      const result = await issueCollection.aggregate([
        {
          $match: {
            isReviewed: true
          }
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
            priorityOrder: {
              $switch: {
                branches: [
                  { case: { $eq: ["$priority", "Critical"] }, then: 4 },
                  { case: { $eq: ["$priority", "High"] }, then: 3 },
                  { case: { $eq: ["$priority", "Normal"] }, then: 2 },
                  { case: { $eq: ["$priority", "Low"] }, then: 1 }
                ],
                default: 0
              }
            },
            statusOrder: {
              $switch: {
                branches: [
                  { case: { $eq: ["$status", "In-Progress"] }, then: 6 },
                  { case: { $eq: ["$status", "Working"] }, then: 5 },
                  { case: { $eq: ["$status", "Pending"] }, then: 4 },
                  { case: { $eq: ["$status", "Resolved"] }, then: 3 },
                  { case: { $eq: ["$status", "Closed"] }, then: 2 },
                  { case: { $eq: ["$status", "Rejected"] }, then: 1 }
                ],
                default: 0
              }
            }
          }
        },
        {
          $sort: { 
            priorityOrder: -1,    // First: Priority (highest first)
            statusOrder: -1,      // Second: Status (In-Progress > Working > Pending > etc.)
            createdAt: -1         // Third: Newest first within same priority & status
          }
        },
        {
          $project: {
            reporterInfo: 0,
            priorityOrder: 0,
            statusOrder: 0
          }
        },
        {
          $skip: skip
        },
        {
          $limit: limit
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

    //admin get all issues
    app.get('/admin/allissues', verifyFBToken, async(req, res)=>{
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

    //verify event donation payment
    app.get("/verify-donation/:sessionId", async (req, res) => {
      try {
        const { sessionId } = req.params;

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== "paid") {
          return res.json({
            success: false,
            paid: false,
            message: "Payment not completed",
          });
        }

        const donationId = session.metadata?.donationId;

        if (!donationId) {
          return res.status(400).json({ message: "Missing donationId" });
        }

        const donation = await donationCollection.findOne({
          _id: new ObjectId(donationId),
        });

        if (!donation) {
          return res.status(404).json({ message: "Donation not found" });
        }

        if (donation.paymentStatus === "paid") {
          return res.json({ success: true, paid: true, message: "Already confirmed" });
        }

        await donationCollection.updateOne(
          { _id: new ObjectId(donationId) },
          {
            $set: {
              paymentStatus: "paid",
              stripeSessionId: sessionId,
              updatedAt: new Date(),
            },
          }
        );

        await eventCollection.updateOne(
          { _id: donation.eventId },
          {
            $inc: { fundRaised: donation.amount },
            $set: { updatedAt: new Date() },
          }
        );

        await paymentCollection.insertOne({
          _id: new ObjectId(),
          userId: donation.userId || null,
          actionType: "event_donation",
          title: "Event Donation Payment Successful",
          description: `Donated ${donation.amount} BDT to event`,
          performedBy: donation.anonymous ? {
            role: "anonymous",
            name: 'Anonymous',
            userId: 'anonymous',
            photoURL: null,
            email: donation.donorEmail || null,
            phone: donation.donorPhone || null,
          } : {
            userId: donation.userId || null,
            name: donation.donorName,
            email: donation.donorEmail || null,
            photoURL: donation.userPhoto || null,
            role: "citizen",
          },
          data: {
            currency: "BDT",
            amount: donation.amount,
            type: "event_donation",
            eventId: session.metadata?.eventId,
            donationId: session.metadata?.donationId,
            stripeSessionId: session.id,
            customerEmail: session.customer_email,
            anonymous: donation.anonymous,
          },
          paymentAt: new Date(),
        });

        if (donation.wantReceipt && donation.donorEmail) {
          try {
            const event = await eventCollection.findOne({ _id: donation.eventId });
            await sendDonorThankYou({
              to: donation.donorEmail,
              name: donation.anonymous ? "Donor" : donation.donorName,
              eventTitle: event?.title,
              amount: donation.amount,
            });
          } catch (emailErr) {
            console.error("Email error:", emailErr.message);
          }
        }

        return res.json({
          success: true,
          paid: true,
          message: "Donation verified successfully",
        });

      } catch (err) {
        console.error("Verify donation error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
      }
    });

    //verify event registration payment
    app.get('/verify-event-reg-pay/:sessionId', verifyFBToken, async(req, res)=>{
      const { sessionId } = req.params;

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== "paid") {
        return res.json({
          success: false,
          paid: false,
          message: "Payment not completed",
        });
      }

      const registrationId = session.metadata?.registrationId;

      if (!registrationId) {
        return res.status(400).json({ message: "Missing registrationId" });
      }

      const registration = await eventRegistrationCollection.findOne({
        _id: new ObjectId(registrationId),
      });

      if (!registration) {
        return res.status(404).json({ message: "Registration not found" });
      }

      // prevent duplicate updates
      if (registration.paymentStatus === "paid") {
        return res.json({
          success: true,
          paid: true,
          message: "Already confirmed",
        });
      }

      const user = await userCollection.findOne({
        _id: new ObjectId(registration.userId),
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await eventRegistrationCollection.updateOne(
        { _id: new ObjectId(registrationId) },
        {
          $set: {
            status: "confirmed",
            paymentStatus: "paid",
            stripeSessionId: sessionId,
            updatedAt: new Date(),
          },
        }
      );

      const countField = registration.role === "guest" ? "guestCount" : "volunteerCount";
      await eventCollection.updateOne(
        { _id: registration.eventId },
        {
          $inc: { [countField]: 1 },
          $set: { updatedAt: new Date() },
        }
      );

      await paymentCollection.insertOne({
        _id: new ObjectId(),
        userId: new ObjectId(registration.userId),
        actionType: "event_payment",
        title: "Event Registration Payment Successful",
        description: `Paid ${session.amount_total / 100} BDT for event registration`,
        performedBy: {
          userId: new ObjectId(registration.userId),
          name: user.name,
          email: user.email,
          role: user.role,
          photoURL: user.photoURL
        },
        data: {
          currency: "BDT",
          amount: session.amount_total / 100,
          type: session.metadata?.type || "event_registration",
          eventId: session.metadata?.eventId,
          registrationId: session.metadata?.registrationId,
          stripeSessionId: session.id,
          customerEmail: session.customer_email
        },
        paymentAt: new Date()
      });

      // payment confirmation email
      const event = await eventCollection.findOne({ _id: registration.eventId });

      try {
        await sendPaymentConfirmationEmail({
          to: registration.email,
          name: user.name,
          eventTitle: event.title,
          eventDate: event.date,
          eventAddress: event.location?.address,
          amount: session.amount_total / 100,
          qrToken: registration.qrToken,
        });
      } catch (emailErr) {
        console.error("Email error:", emailErr.message);
      }

      console.log("Sending email to:", user.email);
      console.log("Event:", event?.title);
      console.log("QR Token:", registration.qrToken);
      return res.json({
        success: true,
        paid: true,
        message: "Payment verified successfully",
      });
    });

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
      
      // console.log('🔍 Boost Session Data:', {
      //   sessionId: session.id,
      //   payment_status: session.payment_status,
      //   metadata: session.metadata
      // });

      if (session.payment_status !== 'paid') {
        // console.log('❌ Boost payment not completed:', session.payment_status);
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

      console.log(issueId)

      /**-------------------------User Verification---------------------- */
      const user = await userCollection.findOne({_id: new ObjectId(userId)});

      if (!user) {
        // console.log('❌ User not found for boost payment');
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
          // console.log('❌ Issue not found for boost');
          return res.status(404).json({ 
            success: false, 
            message: 'Issue not found'
          });
        }
      }

      // console.log('✅ All verifications passed for boost payment');

      // Check if boost already exists for this issue
      const existingPayment = await paymentCollection.findOne({
        'data.issueId': issueId,
        actionType: boostType,
        'data.stripeSessionId': sessionId
      })


      if (existingPayment) {
        // console.log('ℹ️ Boost payment already recorded for this session');
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

      let priority
      if(boostType === 'high_boost'){
        priority = 'Critical'
      }else if(boostType === 'normal_boost'){
        priority = 'High'
      }
      
      if (issueId && issue) {
        // Update issue priority to "High"
        await issueCollection.updateOne(
          { _id: new ObjectId(issueId) },
          { 
            $set: { 
              priority: priority,
              isBoosted: true,
              boostedAt: new Date(),
              boostedBy: user._id,
              boostType: boostType,
              boostAmount: amount/100
            },
            $inc: { boostCount: 1 }
          }
        );

        // console.log(`✅ Issue priority updated to ${priority}`);
      }

      /**-------------------------Create Timeline Entry---------------------- */
      await timelineCollection.updateOne(
        {_id: new ObjectId(issueId)},
        {
          $push: {
            changes: {
              type: "boost",
              title: "Boosted Priority",
              description: `Issue is boosted on ${priority} Priority`,
              role: user?.role,
              updatedBy: user?.name,
              createdAt: new Date()
            }
          }
        }
      )

      // console.log('✅ Timeline entry created for boost');

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
      // console.log('✅ Payment record saved');

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
          priority: priority, // Updated priority
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

    //payment details
    app.get('/payment-details/:paymentId', verifyFBToken, async(req, res)=> {
      const userEmail = req.decoded_email
      const user = await userCollection.findOne({email: userEmail})
      if(!user){
        return res.status(401).send({message: "Unauthorized Access"})
      }
      const {paymentId} = req.params
      const result = await paymentCollection.findOne({_id: new ObjectId(paymentId)})
      // console.log(result.userId.toString() === user._id.toString())
      if(result.userId.toString() === user._id.toString() || user.role === 'admin'){
        res.send(result)
      }
    })

    //get all upvotes
    app.get('/all-upvotes', async(req, res)=> {
      const result = await upvoteCollection.find().toArray()
      res.send(result)
    })

    //get all reviewd issue for super staff
    app.get('/review-issues', verifyFBToken, async(req, res)=>{
      const email = req.decoded_email

      const user = await userCollection.findOne({email})
      if (!user || user.position !== 'super') {
          return res.status(401).send({ message: 'Super Staffnot found' });
      }

      /**--------------------------Pagination--------------------------- */
      const page = parseInt(req.query.page) || 1
      const limit = 8
      const skip = (page - 1) * limit

      const {isReviewed, search, month, year} = req.query
      const query = {}

      //filtering: query string came always as string
      if (isReviewed === 'true') query.isReviewed = true
      if (isReviewed === 'false') query.isReviewed = false

      //search
      if(search){
        query.$or = [
          {
            title: {$regex: search, $options: 'i'}
          },
          {
            description: {$regex: search, $options: 'i'}
          }
        ]
      }

      // Month and year filter
      if (year) {
          const yearNum = parseInt(year);

          if (month !== undefined && month !== "") {
            const monthNum = parseInt(month); 
            const monthStart = new Date(yearNum, monthNum, 1, 0, 0, 0)
            const monthEnd = new Date(yearNum, monthNum + 1, 0, 23, 59, 59)
            query.createdAt = { $gte: monthStart, $lte: monthEnd }
          } else {
            // full year
            const yearStart = new Date(yearNum, 0, 1, 0, 0, 0)
            const yearEnd = new Date(yearNum, 11, 31, 23, 59, 59)
            query.createdAt = { $gte: yearStart, $lte: yearEnd }
          }
      }

      const total = await issueCollection.countDocuments(query)
      
      const result = await issueCollection.find(query).sort({createdAt: -1}).skip(skip).limit(limit).toArray()

      res.send({total, result})

    })

    //Dashoboard Stats
    //Utility function
    const getStartDate = (range) => {
      const now = new Date()
      
      switch (range) {
        case '7d':
          return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          
        case '30d':
          return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          
        case '3m':
          return new Date(new Date().setMonth(now.getMonth() - 3))
          
        case '1y':
          return new Date(new Date().setFullYear(now.getFullYear() - 1))
          
        default:
          return null
      }
    }

    const getPreviousStartDate = (range) => {
      const now = new Date()
      switch (range) {
        case '7d':
          return new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) // 7d ago from current start
        case '30d':
          return new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) // 30d ago
        case '3m':
          return new Date(new Date().setMonth(now.getMonth() - 6))
        case '1y':
          return new Date(new Date().setFullYear(now.getFullYear() - 2))
        default:
          return null
      }
    }

    //user stats
    app.get('/user/stats', verifyFBToken, async (req, res) => {
      const userEmail = req.decoded_email

      const user = await userCollection.findOne({email: userEmail})

      if(!user){
        return res.json({error: true, message: 'User not found!'})
      }

      const { range } = req.query

      const startDate = getStartDate(range)
      const prevStartDate = getPreviousStartDate(range)
      // console.log('Range:', range)
      // console.log('Start Date:', startDate)
      // console.log('previous date', prevStartDate)
      // console.log('Current Date:', new Date())

      const dateFilter = startDate
        ? { createdAt: { $gte: startDate } }
        : {}

      const issueFilter = {
        reportBy: user._id,
        ...dateFilter
      }

      const totalIssues = await issueCollection.countDocuments(issueFilter)

      // Previous range filter
      const prevFilter = { reportBy: user._id, 
        ...(prevStartDate && 
          { createdAt: { $gte: prevStartDate, $lt: startDate } }) }
      const prevTotalIssues = await issueCollection.countDocuments(prevFilter)

      // console.log(totalIssues, 'prev:', prevTotalIssues)
      // Percentage change
      let totalIssuesPercentage = 0
      if (prevTotalIssues > 0) {
        totalIssuesPercentage = Math.round(((totalIssues - prevTotalIssues) / prevTotalIssues) * 100)
      } else if (totalIssues > 0) {
        totalIssuesPercentage = 100 // Previous period zero, current > 0
      }

      const pendingIssues = await issueCollection.countDocuments({
        ...issueFilter,
        status: 'Pending'
      })

      const prevPendingIssues = await issueCollection.countDocuments({
        ...prevFilter,
        status: 'Pending'
      })

      // console.log(pendingIssues, "prev:",  prevPendingIssues)

      // Pending issues percentage change
      let pendingIssuesPercentage = 0
      if (prevPendingIssues > 0) {
        pendingIssuesPercentage = Math.round(((pendingIssues - prevPendingIssues) / prevPendingIssues) * 100)
      } else if (pendingIssues > 0) {
        pendingIssuesPercentage = 100
      }

      const inProgressIssues = await issueCollection.countDocuments({
        ...issueFilter,
        status: { $in: ['In-Progress', 'Working'] }
      })

      const resolvedIssues = await issueCollection.countDocuments({
        ...issueFilter,
        status: 'Closed'
      })

      const prevResolvedIssues = await issueCollection.countDocuments({
        ...prevFilter,
        status: 'Closed'
      })

      const resolvedIssuePercentage = prevResolvedIssues > 0 ? 
      Math.round(((resolvedIssues-prevResolvedIssues)/prevResolvedIssues)*100) : resolvedIssues == 0 ? 0 : 100

      const payments = await paymentCollection.aggregate([
        {
          $match: {
            userId: user._id,
            ...(startDate && { paymentAt: { $gte: startDate } })
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$data.amount' }
          }
        }
      ]).toArray()

      //previous payment
      const prevPayments = await paymentCollection.aggregate([
        {
          $match: {
            userId: user._id,
            ...(prevStartDate && {
              paymentAt: {
                $gte: prevStartDate,
                $lt: startDate
              }
            })
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$data.amount' }
          }
        }
      ]).toArray()

      const totalPayments = payments[0]?.total || 0

      const prevTotalPayments = prevPayments[0]?.total || 0

      const paymentPercentageCalculation = ((totalPayments - prevTotalPayments)/prevTotalPayments)*100

      const paymentPercentage = prevTotalPayments > 0 ? Math.round(paymentPercentageCalculation) : 0

      const successRate = totalIssues
        ? Math.round((resolvedIssues / totalIssues) * 100)
        : 0

      const previousSuccessRate = prevTotalIssues ?
      Math.round((prevResolvedIssues / prevTotalIssues)) : 0

      const successRatePercentage = successRate == 0 && previousSuccessRate == 0 ? 0 :
      previousSuccessRate > 0 ? Math.round(((successRate - previousSuccessRate)/previousSuccessRate)*100) : 100

      //category distribution
      const categoryAggregation = await issueCollection.aggregate([
        { $match: issueFilter },
        {
          $group: {
            _id: '$category',        // Group by category
            count: { $sum: 1 }       // Count issues per category
          }
        }
      ]).toArray()

      // Map to frontend format
      const categoryDistribution = categoryAggregation.map(item => ({
        name: item._id,
        value: item.count,
        color: (() => {
          switch (item._id) {
            case 'Road & Traffic': return '#10b981'
            case 'Water Supply': return '#3b82f6'
            case 'Electricity': return '#f59e0b'
            case 'Sanitation': return '#8b5cf6'
            case 'Streetlight': return '#facc15'
            case 'Public Safety': return '#ef4444'
            case 'Footpath': return '#6b2280'
            default: return '#6b7280'
          }
        })()
      }))

      /*-------------------PriorityDistribution---------------------*/
      const priorityAgg = await issueCollection.aggregate([
        { $match: issueFilter },
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 }
          }
        }
      ]).toArray()

      // Transform to frontend format
      const priorityDistribution = priorityAgg.map(item => ({
        priority: item._id,
        issues: item.count,
        color: (()=>{
          switch (item._id){
            case 'Critical': return '#ef4444'
            case 'High': return '#f97316'
            case 'Normal': return '#10b981'
            case 'Low': return '#3b82f6'
            default: return '#6b7280'
          }
        })()
      }))

      const resolutionAgg = await issueCollection.aggregate([
        { $match: issueFilter },
        { 
          $group: {
            _id: '$category',
            avgTime: { 
              $avg: { 
                $divide: [
                  { $subtract: [ { $ifNull: ['$closedAt', new Date()] }, '$createdAt' ] },
                  1000 * 60 * 60 * 24 // ms -> days
                ]
              }
            }
          }
        },
        { $sort: { avgTime: -1 } }
      ]).toArray()

      const resolutionTimeData = resolutionAgg.map(item => ({
        category: item._id,
        avgTime: item.avgTime ? Number(item.avgTime.toFixed(1)) : 0
      }))

      
      res.send({
        range,
        totalIssues,
        totalIssuesPercentage,
        pendingIssues,
        pendingIssuesPercentage,
        inProgressIssues,
        resolvedIssues,
        resolvedIssuePercentage,
        totalPayments,
        paymentPercentage,
        successRate,
        successRatePercentage,
        categoryDistribution,
        priorityDistribution,
        resolutionTimeData
      })
    })

    //user issues over time
    app.get('/user/issues-over-time', verifyFBToken, async (req, res) => {
      const userEmail = req.decoded_email
      const { range } = req.query

      const user = await userCollection.findOne({ email: userEmail })
      if (!user) {
        return res.status(404).json({ error: true, message: 'User not found' })
      }

      const startDate = getStartDate(range)

      const matchStage = {
        reportBy: user._id,
        ...(startDate && { createdAt: { $gte: startDate } })
      }

      const groupId =
        range === '7d' || range === '30d'
          ? {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            }
          : {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            }

      const issuesOverTime = await issueCollection.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: groupId,
            reported: { $sum: 1 },
            resolved: {
              $sum: {
                $cond: [{ $ifNull: ['$resolvedAt', false] }, 1, 0]
              }
            }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]).toArray()

      // format for frontend
      const formatted = issuesOverTime.map(item => {
        const { year, month, day } = item._id

        return {
          label: day
            ? `${day}/${month}`
            : new Date(year, month - 1).toLocaleString('en', { month: 'short' }),
          reported: item.reported,
          resolved: item.resolved
        }
      })

      res.send(formatted)
    })

    //user-dashboard recent issue
    app.get('/user/dashboard/recent-issues', verifyFBToken, async(req,res)=>{
      const userEmail = req.decoded_email
      const user = await userCollection.findOne({email: userEmail})
      if(!user){
        return res.status(404).send({message: 'user not found!'})
      }

      const issueCount = user.issueCount || 0
      const resolvedCount = user.solvedIssue || 0
      const rejectCount = user.rejectedIssueCount || 0

      const query = {
        reportBy: new ObjectId(user._id)
      }

      const result = await issueCollection.find(query).sort({createdAt: -1}).limit(5).toArray()

      // get all user issues
      const allIssues = await issueCollection
        .find({ reportBy: user._id })
        .toArray()

      /* ---------- FASTEST RESOLUTION ---------- */
      let smallestResolutionDay = null

      const resolvedIssues = allIssues.filter(
        issue =>  issue.resolvedAt
      )

      if (resolvedIssues.length > 0) {
        smallestResolutionDay = Math.min(
          ...resolvedIssues.map(issue => {
            const created = new Date(issue.createdAt)
            const resolved = new Date(issue.resolvedAt)
            return (resolved - created) / (1000 * 60 * 60 * 24)
          })
        )
      }

      /* ---------- AVERAGE RESOLUTION TIME ---------- */
      let avgResolutionDay = 0

      if (resolvedIssues.length > 0) {
        const totalDays = resolvedIssues.reduce((sum, issue) => {
          const created = new Date(issue.createdAt)
          const resolved = new Date(issue.resolvedAt)
          return sum + (resolved - created) / (1000 * 60 * 60 * 24)
        }, 0)

        avgResolutionDay = totalDays / resolvedIssues.length
      }

      /* ---------- MOST UPVOTES ---------- */
      const mostUpvotes = allIssues.length
        ? Math.max(...allIssues.map(issue => issue.upvoteCount || 0))
        : 0

      /* ---------- MOST VIEWS ---------- */
      const mostViewsIssue = allIssues.length
        ? Math.max(...allIssues.map(issue => issue.viewsCount || 0))
        : 0

      /* ---------- FINAL OBJECT ---------- */
      const dashboardQuickStats = {
        smallAvgResolutionDay: smallestResolutionDay
          ? Number(smallestResolutionDay.toFixed(1))
          : 0,
        avgResolutionDay: avgResolutionDay ? Number(avgResolutionDay.toFixed(1)) : 0,
        mostUpvotes,
        mostViewsIssue,
        issueCount,
        resolvedCount,
        rejectCount
      }

      res.send({result, dashboardQuickStats})
    })

    //get comments
    app.get('/comments/:issueId', async(req, res) => {
      const { issueId } = req.params;
      const comments = await commentCollection.find({issueId: new ObjectId(issueId)}).toArray()
      res.send(comments)
    })

    //get issues for map
    app.get('/map-view/issues', async(req, res)=>{
      const result = await issueCollection.find({isReviewed: true}, 
        {projection:{
          title: 1,
          description: 1,
          locationAt: 1,
          status: 1,
          priority: 1,
          category: 1,
          upvoteCount: 1,
          mainPhoto: 1,
          createdAt: 1
      }}).toArray()

      res.send(result)
    })

    //get payment history for admin
    app.get('/admin/payment-history', verifyFBToken, async(req, res) => {
      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 20
      const skip = (page - 1) * limit
      
      // Get total count for pagination
      const total = await paymentCollection.countDocuments()
      
      // Get payments with pagination
      const payments = await paymentCollection.find()
        .sort({ paymentAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray()
      
      // Get analytics
      const analytics = await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$data.amount' },
            totalTransactions: { $sum: 1 },
            avgTransaction: { $avg: '$data.amount' }
          }
        }
      ]).toArray()
      
      const analyticsData = analytics[0] || {
        totalRevenue: 0,
        totalTransactions: 0,
        avgTransaction: 0
      }
      
      res.send({
        payments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        },
        analytics: analyticsData
      })
    })

    //get events
    app.get("/events", async (req, res) => {
      try {
        const {
          status = "upcoming",
          page = 1,
          limit = 9,
          type,
          search,
        } = req.query;

        const query = {};

        // status filter
        if (status) {
          query.status = status;
        }

        // type filter
        if (type) {
          query.eventType = type;
        }

        // search by title
        if (search) {
          query.title = {
            $regex: search,
            $options: "i",
          };
        }

        const skip = (Number(page) - 1) * Number(limit);

        const total = await eventCollection.countDocuments(query);

        const events = await eventCollection
          .find(query)
          .skip(skip)
          .limit(Number(limit))
          .toArray();

          // console.log(events)

        res.send({
          success: true,
          total,
          totalPages: Math.ceil(total / Number(limit)),
          events,
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to fetch events",
        });
      }
    })

    //get single event: view details
    app.get("/events/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const event = await eventCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!event) {
          return res.status(404).send({
            success: false,
            message: "Event not found",
          });
        }

        const registrationInfo = await eventRegistrationCollection.find(
          {eventId: new ObjectId(id), status: 'confirmed'},
          {projection:{name: 1, email:1, ageGroup:1, skills:1, status:1, 
            paymentStatus:1, userName:1, userPhoto:1, role:1, tshirtSize:1}}
        ).toArray()

        //role count
        const volunteerCount = registrationInfo.filter(r => r.role === "volunteer").length;
        const guestCount = registrationInfo.filter(r => r.role === "guest").length;

        const donations = await donationCollection
        .find({ eventId: new ObjectId(id), paymentStatus: "paid" })
        .toArray();

        res.send({
          success: true,
          event,
          registrationInfo,
          totalRegistredParticipate: registrationInfo.length,
          roleCount:{
            volunteer: volunteerCount,
            guest: guestCount
          },
          donations
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to fetch event details",
        });
      }
    });


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
      data.isReviewed = false
      data.createdAt = new Date()
      
      // console.log(data)
      
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
      // console.log(timeline)
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
      // console.log(staffInfo)
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
        
          await issueCollection.updateOne(
            {_id: new ObjectId(issueId)},
            {
              $inc: {upvoteCount: -1}
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

        await issueCollection.updateOne(
          {_id: new ObjectId(issueId)},
          {
            $inc: {upvoteCount: 1}
          }
        )

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
      }else if(type === 'high_boost'){
        amount = 1200
        productName = 'High Isse Boost'
        description = 'Boost this issue for higher priority'
        success_url = `${process.env.FRONTEND_URL}/payment-boost-success?session_id={CHECKOUT_SESSION_ID}`
      }

      /**------------------checking user------------------------------*/
      const user = await userCollection.findOne({email: userEmail})
      if(!user){
        return res.status(404).json({success: false, message: 'User not found!'})
      }

      if (user.isPremium && (type !== 'normal_boost' && type !=='high_boost')) {
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
      }else if(type === 'high_boost'){
        metadata = {
          userId: userId,
          userEmail: userEmail,
          amount: amount,
          type: type,
          issueId: issueId}
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

    //report issue
    app.post('/report-issue/:id', verifyFBToken, async(req, res)=> {
      const {id} = req.params

      if(!id){
        return res.status(400).json({message: "Invalid Id"})
      }

      const  {
      reportType,
      reportDetails,
      isAnonymous,
      reporterId,
      reporterName
      } = req.body

      /*---------------------Chech User already Report the Issue------- */
      const alreadyReported = await reportCollection.findOne({
        _id: new ObjectId(id),
        "reports.reporterId": reporterId
      })

      if (alreadyReported) {
        return res.send({error:true, message: "You Already Report this issue!"})
      }

      const reportData = {
        reportType,
        reportDetails,
        isAnonymous,
        reporterId,
        reporterName,
        reportedAt: new Date()
      }

      // console.log(reportData)

      /*----------------------Find Issues--------------------------------*/
      const issue = await issueCollection.findOne({_id: new ObjectId(id)})
      if(!issue){
       return res.status(400).json({message: "Issue not found!"})
      }

      /*----------------------Insert and Update Report--------------------*/
      await reportCollection.updateOne(
        {_id: new ObjectId(id)},
        {$setOnInsert:{
          _id: new ObjectId(id),
          title: issue.title,
          createdAt: issue.createdAt
          },
          $push:{
          reports: reportData
          }
        },
        {upsert: true}
      )

      /*---------------------issue: report count------------------------*/
      await issueCollection.updateOne(
        {_id: new ObjectId(id)},
        {$inc: {reportCount: 1}}
      )

      res.json({success: true})
    })

    //add comment
    app.post('/comments/:issueId', verifyFBToken, async(req, res) => {
      const { issueId } = req.params;
      const { commentText } = req.body;
      const userEmail = req.decoded_email

      /*-----------------------------User Check---------------------------*/
      const user = await userCollection.findOne({ email: userEmail });
      if (!user) {
          return res.status(404).send({ message: 'User not found' });
      }

      /*-----------------------------Find Issue-------------------------- */
      const issueQuery = {_id: new ObjectId(issueId)}
      const issue = await issueCollection.findOne(issueQuery)
      if (!issue) {
        return res.status(404).send({ message: 'Issue not found' })
      }

      /*----------------------------Toxicity Check----------------------- */
      const toxicityResult = checkToxicity(commentText);
      const isToxic = toxicityResult.score >= 0.8

      const commentData = {
          _id: new ObjectId(),
          issueId: new ObjectId(issueId),
          commentby: user._id,
          commenterName: user.name,
          commenterRole: user.role,
          commenterPhoto: user.photoURL,
          commentText: commentText,
          isToxic: isToxic,
          toxicityScore: toxicityResult.score,
          commentedAt: new Date(),
          replies: []
      }

      const result = await commentCollection.insertOne(commentData);
      await issueCollection.updateOne(
        {_id: new ObjectId(issueId)},
        {$inc: {comments: 1}}
      )
      res.send({
        success: true,
        comment: commentData
      })
    })

    //add reply
    app.post('/comments/reply/:commentId', verifyFBToken, async(req, res) => {
      const { commentId } = req.params
      const { replyText } = req.body
      const userEmail = req.decoded_email

      const user = await userCollection.findOne({ email: userEmail })
      if (!user) {
        return res.status(404).send({ message: 'User not found' })
      }

      /*-----------------------Comment Check----------------------- */
      const comment = await commentCollection.findOne({ _id: new ObjectId(commentId)})
      if (!comment) {
        return res.status(404).send({ message: 'Comment not found' });
      }

      /*------------------------Toxicity Check-------------------- */
      const toxicityResult = await checkToxicity(replyText)
      const isToxic = toxicityResult.score >= 0.8

      // Reply object create
      const replyData = {
        repliesBy: user._id,
        replierName: user.name,
        replierRole: user.role,
        replierPhoto: user.photoURL,
        repliedText: replyText,
        isToxic: isToxic,
        toxicityScore: toxicityResult.score,
        repliedAt: new Date()
      };

      // Comment replies array push
      const result = await commentCollection.updateOne(
        { _id: new ObjectId(commentId) },
        { $push: { replies: replyData } }
      )
      res.send({success: true, reply: replyData})
    })

    //event create
    app.post('/events/create', verifyFBToken,  async (req, res) => {
      const payload = req.body;
      /*--------------------Admin check--------------------------*/
      const adminUser = await userCollection.findOne({ email: req.decoded_email });
      
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(403).send({ message: "Forbidden! Admin access required" });
      }

      const {issueId, staffId} = req.body

      /**-----------------Staff query----------------------------- */
      // const staff = await userCollection.findOne({_id: new ObjectId(staffId)})
      // if(!staff){
      //   return res.status(404).send({message: "Staff not found!"})
      // }

      try {
        const eventDoc = {
          ...payload,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: "upcoming",
          guestCount: 0
        };

        const result = await eventCollection.insertOne(eventDoc);

        res.status(201).send({
          success: true,
          insertedId: result.insertedId,
          message: "Event created successfully",
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to create event",
        });
      }
    });

    //event registration
    app.post("/events/:id/volunteer", verifyFBToken, async (req, res) => {
      try {
        const eventId = new ObjectId(req.params.id);
        const userEmail = req.decoded_email;
        const now = new Date();

        /* ───────────────── USER CHECK ───────────────── */
        const user = await userCollection.findOne({ email: userEmail });
        if (!user) {
          return res.status(404).json({ message: "User not found!" });
        }

        /* ───────────────── EVENT CHECK ───────────────── */
        const event = await eventCollection.findOne({ _id: eventId });

        if (!event)
          return res.status(404).json({ message: "Event not found" });

        if (["completed", "cancelled"].includes(event.status))
          return res.status(400).json({
            message: "Event is no longer accepting registrations",
          });

        /* ───────────────── INPUT ───────────────── */
        const {
          name,
          email,
          phone,
          institution,
          ageGroup,
          skills = [],
          role = "volunteer",
          tshirtSize
        } = req.body;

        if (!name || !email || !phone) {
          return res.status(400).json({
            message: "Name, email and phone are required",
          });
        }

        /* ───────────────── DUPLICATE CHECK ───────────────── */
        const existing = await eventRegistrationCollection.findOne({
          eventId,
          userId: user._id
        });

        if (existing) {
          return res.status(409).json({
            message: "Already registered for this event",
          });
        }

        /* ───────────────── CAPACITY CHECK ───────────────── */
        const confirmedCount = await eventRegistrationCollection.countDocuments({
          eventId,
          status: "confirmed",
        });

        const isFull =
          event.maxVolunteers &&
          confirmedCount >= event.maxVolunteers;

        const isPaidEvent = (event.registrationFee || 0) > 0;

        /* ───────────────── GUEST CAPACITY CHECK ───────────────── */
        if (role === "guest") {
          if (!event.isGuestUnlimited) {
            const guestCount = await eventRegistrationCollection.countDocuments({
              eventId,
              status: "confirmed",
              role: "guest",
            });

            if (guestCount >= (event.guestNumber || 0)) {
              return res.status(400).json({
                message: "Guest spots are full for this event",
              });
            }
          }
        }

        /* ───────────────── STATUS DECISION ───────────────── */
        let status;

        if (isFull) {
          status = "waitlisted";
        } else if (isPaidEvent) {
          status = "pending"; // waiting for payment confirmation
        } else {
          status = "confirmed"; // free event auto-confirm
        }

        const qrToken = uuidv4();
        const registrationId = new ObjectId();

        /* ───────────────── CREATE REGISTRATION ───────────────── */
        const regDoc = {
          _id: registrationId,
          eventId,
          userId: user._id,
          userPhoto: user.photoURL,
          userName: user.name,
          name,
          email,
          phone,
          institution: institution || "",
          ageGroup: ageGroup || "18-25",
          skills,
          role,
          tshirtSize: event.isTshirt ? (tshirtSize || null) : null,

          qrToken,

          status,
          paymentStatus: isPaidEvent ? "pending" : "not-required",

          stripeSessionId: null,
          waitlistPosition: null,

          createdAt: now,
          updatedAt: now,
        };

        await eventRegistrationCollection.insertOne(regDoc);

        /* ───────────────── FREE EVENT: COUNT INCREASE ───────────────── */
        if (status === "confirmed") {
          const countField = role === "guest" ? "guestCount" : "volunteerCount"; // ✅
          await eventCollection.updateOne(
            { _id: eventId },
            { $inc: { [countField]: 1 }, $set: { updatedAt: now } }
          );
        }

        /* ───────────────── WAITLIST POSITION ───────────────── */
        let waitlistPosition = null;

        if (status === "waitlisted") {
          const count = await eventRegistrationCollection.countDocuments({
            eventId,
            status: "waitlisted",
          });

          waitlistPosition = count;

          await eventRegistrationCollection.updateOne(
            { _id: registrationId },
            { $set: { waitlistPosition } }
          );
        }

        /* ───────────────── STRIPE SESSION ───────────────── */
        let paymentUrl = null;

        if (status === "pending") {
          try {
            const session = await stripe.checkout.sessions.create({
              customer_email: email,

              line_items: [
                {
                  price_data: {
                    currency: "bdt",
                    product_data: {
                      name: event.title,
                    },
                    unit_amount: event.registrationFee * 100,
                  },
                  quantity: 1,
                },
              ],

              mode: "payment",

              success_url: `${process.env.FRONTEND_URL}/event-payment-success?session_id={CHECKOUT_SESSION_ID}`,

              cancel_url: `${process.env.FRONTEND_URL}/event-payment-cancel`,

              metadata: {
                eventId: eventId.toString(),
                registrationId: registrationId.toString(),
                type: "event_registration",
              },
            });

            paymentUrl = session.url;

            await eventRegistrationCollection.updateOne(
              { _id: registrationId },
              {
                $set: {
                  stripeSessionId: session.id,
                  updatedAt: now,
                },
              }
            );
          } catch (stripeErr) {
            console.error("Stripe error:", stripeErr.message);

            // ❗ FIX: prevent stuck pending state
            await eventRegistrationCollection.updateOne(
              { _id: registrationId },
              {
                $set: {
                  status: "failed-payment",
                  updatedAt: now,
                },
              }
            );

            return res.status(500).json({
              message: "Payment system error. Please try again.",
            });
          }
        }

        /* ───────────────── EMAIL ───────────────── */
        try {
          if (status === "waitlisted") {
            await sendWaitlistConfirmation({
              to: email,
              name,
              eventTitle: event.title,
              eventDate: event.date,
              eventAddress: event.location?.address,
              waitlistPosition,
            });
          } else if (status === "confirmed") {
            await sendRegistrationConfirmation({
              to: email,
              name,
              eventTitle: event.title,
              eventDate: event.date,
              eventAddress: event.location?.address,
              eventType: event.eventType,
              qrToken,
              role,
              registrationFee: event.registrationFee,
              paymentLink: null,
            });
          } else if (status === "pending") {
            await sendRegistrationConfirmation({
              to: email,
              name,
              eventTitle: event.title,
              eventDate: event.date,
              eventAddress: event.location?.address,
              eventType: event.eventType,
              qrToken: null,
              role,
              registrationFee: event.registrationFee,
              paymentLink: paymentUrl,
            });
          }
        } catch (emailErr) {
          console.error("Email error:", emailErr.message);
        }

        /* ───────────────── RESPONSE ───────────────── */
        return res.status(201).json({
          message:
            status === "waitlisted"
              ? "Added to waitlist"
              : status === "pending"
              ? "Proceed to payment"
              : "Successfully registered",

          registration: {
            _id: registrationId,
            qrToken,
            status,
            paymentStatus: regDoc.paymentStatus,
            paymentUrl,
            waitlistPosition,
          },
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({
          message: "Server error",
          error: err.message,
        });
      }
    });
    
    //event reg payment webhook
    // app.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    //   let stripeEvent;
    //   try {
    //     stripeEvent = stripe.webhooks.constructEvent(
    //       req.body,
    //       req.headers["stripe-signature"],
    //       process.env.STRIPE_WEBHOOK_SECRET
    //     );
    //   } catch (err) {
    //     return res.status(400).send(`Webhook Error: ${err.message}`);
    //   }

    //   if (stripeEvent.type === "checkout.session.completed") {
    //     const session        = stripeEvent.data.object;
    //     const registrationId = new ObjectId(session.metadata?.registrationId);
    //     const now            = new Date();

    //     const reg = await eventRegistrationCollection.findOne({ _id: registrationId });

    //     // Idempotency: already processed হলে skip
    //     if (!reg || reg.status === "confirmed") return res.json({ received: true });

    //     // Registration confirm করো
    //     await eventRegistrationCollection.updateOne(
    //       { _id: registrationId },
    //       { $set: { status: "confirmed", paymentStatus: "paid", updatedAt: now } }
    //     );

    //     // ✅ এখন volunteerCount বাড়াও
    //     await eventCollection.updateOne(
    //       { _id: reg.eventId },
    //       { $inc: { volunteerCount: 1 }, $set: { updatedAt: now } }
    //     );
    //   }

    //   res.json({ received: true });
    // });

    //event verify session checkout

    //event donation


    app.post("/events/:id/donate", optionalFBToken, async (req, res) => {
      let userId = null;
      let userPhoto = null;

      if (req.decoded_email) {
        const user = await userCollection.findOne({ email: req.decoded_email });
        if (user) {
          userId = user._id;
          userPhoto = user.photoURL || null; // ✅
        }
      }
      try {
        const eventId = new ObjectId(req.params.id);
        const {
          amount,
          donorName = "Supporter",
          donorEmail,
          donorPhone,
          anonymous,
          wantReceipt,
        } = req.body;

        if (!amount || Number(amount) < 10) {
          return res.status(400).json({ message: "Minimum donation is ৳10" });
        }

        // if Anonymous then email or phone must needed
        if (anonymous && !donorEmail && !donorPhone) {
          return res.status(400).json({
            message: "Anonymous donation requires at least an email or phone",
          });
        }

        const event = await eventCollection.findOne({ _id: eventId });
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        if (event.status === "cancelled") {
          return res.status(400).json({ message: "Cannot donate to a cancelled event" });
        }

        if (event.status === "completed") {
          return res.status(400).json({ message: "Cannot donate to a completed event" });
        }

        if (!event.fundGoal || event.fundGoal <= 0) {
          return res.status(400).json({ message: "This event is not accepting donations" });
        }

        // Donation record 
        const donationId = new ObjectId();
        const donationDoc = {
          _id: donationId,
          eventId,
          userId,
          userPhoto,
          amount: Number(amount),
          donorName: anonymous ? "Anonymous" : donorName,
          donorEmail: donorEmail || null,
          donorPhone: donorPhone || null,
          anonymous,
          wantReceipt: wantReceipt || false,
          paymentStatus: "pending",
          stripeSessionId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await donationCollection.insertOne(donationDoc);

        // Stripe session create
        const session = await stripe.checkout.sessions.create({
          customer_email: donorEmail || undefined,

          line_items: [
            {
              price_data: {
                currency: "bdt",
                product_data: {
                  name: `Donation — ${event.title}`,
                },
                unit_amount: Number(amount) * 100,
              },
              quantity: 1,
            },
          ],

          mode: "payment",

          success_url: `${process.env.FRONTEND_URL}/events/${eventId}?donated=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.FRONTEND_URL}/events/${eventId}`,

          metadata: {
            donationId: donationId.toString(),
            eventId: eventId.toString(),
            type: "event_donation",
          },
        });

        // Save Session ID
        await donationCollection.updateOne(
          { _id: donationId },
          { $set: { stripeSessionId: session.id, updatedAt: new Date() } }
        );

        return res.json({ success: true, paymentUrl: session.url });

      } catch (err) {
        console.error("Donation error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
      }
    });

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
          priority: 'Low',
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

        if(issue.reportBy){
          await userCollection.updateOne(
            {_id: issue.reportBy},
            {
              $inc: {
                solvedIssue: 1
              }
            }
          )
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
    })

    // is review update
    app.patch('/update-review/:id', verifyFBToken, async(req, res)=>{
      const {id} = req.params
      const {isReviewed} = req.body

      const query = {_id: new ObjectId(id)}
      const update = {
        $set: {
          isReviewed
        }
      }
      const result = await issueCollection.updateOne(query, update)
      res.send(result)
    })

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
    })

    //DELETE: Comment
    app.delete('/comments/:commentId', verifyFBToken, async (req, res) => {
      const { commentId } = req.params
      const userEmail = req.decoded_email

      // Find user
      const user = await userCollection.findOne({ email: userEmail })
      if (!user) {
        return res.status(404).send({ message: 'User not found' })
      }

      // Find comment
      const comment = await commentCollection.findOne({ 
        _id: new ObjectId(commentId) 
      })

      if (!comment) {
        return res.status(404).send({ message: 'Comment not found' })
      }

      // Check permission (owner or admin)
      if (comment.commentby.toString() !== user._id.toString() && user.role !== 'admin') {
        return res.status(403).send({ message: 'Permission denied' })
      }

      // Delete comment
      const result = await commentCollection.deleteOne({ 
        _id: new ObjectId(commentId) 
      })

      // Update issue comment count
      await issueCollection.updateOne(
        { _id: comment.issueId },
        { $inc: { comments: -1 } }
      )

      res.send({ success: true })
    })
    
    //router
    //View Count Route(Simple)
    app.post('/view-count/:issueId', async (req, res) => {
      const result = await issueCollection.findOneAndUpdate(
          { _id: new ObjectId(req.params.issueId) },
          { $inc: { viewsCount: 1 } },
          { returnDocument: 'after' }
        )
        // console.log(result)
        res.json({ success: true, viewsCount: result.viewsCount});
    })

    
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

    //await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res)=>{
    res.send("Hello there!!!!")
})

setupCommentSummaryRoute(app, model, verifyFBToken);

app.listen(port, ()=>{
    console.log(`App is running on the port ${port}`)
})