import express from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(()=> {
    db = mongoClient.db("batepapouol_api");
});

app.post("/participants", (req, res) => {

    //fazer as validações aqui e se tiver tudo ok:

    const { name } = req.body;
    const participant = { name, lastStatus: Date.now()};
    const message = {
        from: name, 
        to: 'Todos', 
        text: 'entra na sala...', 
        type: 'status', 
        time: dayjs().format("HH:mm:ss")
    };

    db.collection('participants').insertOne(participant);
    db.collection('messages').insertOne(message);

    res.sendStatus(201);
});

app.get("/participants", (req, res) => {
    const promise = db.collection('participants').find().toArray();
    promise.then(participants => res.send(participants));
});

app.post("/messages", (req, res) => {

    //fazer as validações aqui e se tiver tudo ok:

    const { to, text, type } = req.body;
    const from = req.headers.user;
    
    const message = {
        from, 
        to, 
        text, 
        type, 
        time: dayjs().format("HH:mm:ss")
    };

    db.collection('messages').insertOne(message);

    res.sendStatus(201);
});

app.get("/messages", (req, res) => {
    const { limit } = req.query;
    const { user } = req.headers;
    const promise = db.collection('messages').find().toArray();

    promise.then(messages => {
        messages.reverse();
        const userMessages = messages.filter(item => {
            if (item.from === user ||item.type === 'message' || item.type === 'status') {
                return true;
            } else if (item.type === 'private_message' && (item.to === user || item.to === "Todos")) {
                return true;
            } else {
                return false;
            }
        });

        if (!limit || userMessages.length < limit) {
            res.send(userMessages);
        } else {
            res.send(userMessages.slice(0 , limit));
        }
    });
});


app.listen(5000);