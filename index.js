const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
// const mongoose = require("mongoose");
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json({ limit: "30mb", extended: true }));
//app.use(bodyParser.urlencoded({ limit: "30mb", extended: true }));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.deqifab.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version

const client = new MongoClient(uri,
    {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        },

    });

async function run() {
    try {

        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // connect mongodb and create collections
        client.connect();
        const database = client.db('unique-travels');
        const collectionUser = database.collection('users');
        const collectionBuses = database.collection('buses');
        const collectionBookings = database.collection('bookings');

        /*----------------------
        CRUD Method Start  Here
        -----------------------*/

        //collection a new user when register
        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user)
            const result = await collectionUser.insertOne(user);
            res.json(result);
        })

        // get all users 
        app.get('/users', async (req, res) => {
            const result = await collectionUser.find({}).toArray();
            res.send(result);
        });

        //store user when login
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const UserDoc = {
                $set: user,
            };
            const result = await collectionUser.updateOne(filter, UserDoc, options)
            res.json(result)
        })

        // Get a single user 
        app.get('/users/:email', async (req, res) => {
            const userEmail = req.params.email;
            const query = { email: userEmail };
            const userInfo = await collectionUser.findOne(query);
            res.send(userInfo);
        });


        // make admin existing user 
        app.put('/makeAdmin', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const findUser = await collectionUser.find(filter).toArray();
            if (findUser) {
                const UserDoc = {
                    $set: user,
                };
                const result = await collectionUser.updateOne(filter, UserDoc);
                res.json(result)
            }
            res.json()
        })


        /* --------------------------
            Doctors part start 
        --------------------------- */
        // create or insert doctors to database 
        app.post('/buses', async (req, res) => {
            const buses = req.body;
            const result = await collectionBuses.insertOne(buses);
            res.json(result);
        });

        // get all data from server 
        app.get('/buses', async (_req, res) => {
            const result = await collectionBuses.find({}).toArray();
            res.send(result);
        });

        //find a single data using id
        app.get('/details/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await collectionBuses.findOne(filter);
            res.send(result);
        });

        //find booked buses
        app.get('/buses/booked', async (_req, res) => {
            const result = await collectionBuses.find({ bookedSeats: { $ne: [] } }).toArray();

            // Custom sorting function to sort seats by number and letter
            const customSort = (a, b) => {
                const aNumber = parseInt(a); // Extract number from seat
                const bNumber = parseInt(b); // Extract number from seat

                if (aNumber !== bNumber) {
                    return aNumber - bNumber; // Sort by number
                } else {
                    // If numbers are the same, sort by letter
                    const aLetter = a.replace(aNumber.toString(), '');
                    const bLetter = b.replace(bNumber.toString(), '');
                    return aLetter.localeCompare(bLetter);
                }
            };

            // Sort the bookedSeats array of each bus
            result.forEach(bus => {
                bus.bookedSeats.sort(customSort);
            });
            res.send(result);
        });

        // Cancel or delete a data
        app.delete('/buses/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await collectionBuses.deleteOne(query);
            res.json(result);
        });

        /* --------------------------
            booking part start 
        --------------------------- */
        // create or insert a service to database 
        app.post('/bookings', async (req, res) => {
            const bookData = req.body;
            try {
                // Insert the booking into collectionBookings
                const bookingResult = await collectionBookings.insertOne(bookData);

                // Update availableSeats in collectionBuses
                const bus = await collectionBuses.findOne({ _id: ObjectId(bookData?.busId) });
                const newAvailableSeats = parseInt(bus.availableSeats) - bookData?.selectedSeats.length;
                await collectionBuses.updateOne(
                    { _id: ObjectId(bookData?.busId) },
                    { $set: { availableSeats: newAvailableSeats } }
                );

                // Add booked seats to bus's bookedSeats array
                const newBookedSeats = [...bus.bookedSeats, ...bookData?.selectedSeats];
                await collectionBuses.updateOne(
                    { _id: ObjectId(bookData?.busId) },
                    { $set: { bookedSeats: newBookedSeats } }
                );
                res.status(200).json(bookingResult);
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'An error occurred' });
            }
        });

        // get all booking data from server 
        app.get('/bookings', async (_req, res) => {
            const result = await collectionBookings.find({}).toArray();
            res.send(result);
        });

        // Get booking by gmail
        app.get('/bookings/:email', async (req, res) => {
            const userEmail = req.params.email;
            const query = { email: userEmail };
            const booking = await collectionBookings.find(query).toArray();
            res.send(booking);
        });


        // mail send using node mailer
        // Configure nodemailer transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 465,
            secure: true,
            logger: true,
            debug: true,
            secureConnection: false,
            auth: {
                user: 'airinkhanam506@gmail.com',
                pass: 'btyoifztgrjoflix',
            },
            tls: {
                rejectUnAuthorized: true
            }
        });

        // API endpoint to send email
        app.post('/send-email', async (req, res) => {
            try {
                const { to, subject, passengerName, selectedSeats, snacks, totalPrice, time } = req.body;

                const htmlBody = `
                <p>Dear ${passengerName},</p>
                <p>Your booking details:</p>
                <p>Selected Seats: ${selectedSeats.join(', ')}</p>
                <p>Snacks: ${snacks}</p>
                <p>Time: ${time}</p>
                <p>Total Price: ${totalPrice} Tk</p>
                <p>Thank you for choosing our service!</p>
              `;

                // Sending email using nodemailer
                const info = await transporter.sendMail({
                    from: 'airinkhanam506@gmail.com',
                    to,
                    subject,
                    html: htmlBody,
                });

                console.log('Email sent:', info);
                res.status(200).json({ message: 'Email sent successfully' });
            } catch (error) {
                console.error('Error sending email:', error);
                res.status(500).json({ message: 'An error occurred while sending email' });
            }
        });


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Running Unique Travels Server Online');
});
app.listen(port, () => {
    console.log(`Running Unique Travels Server on port ${port}`);
});