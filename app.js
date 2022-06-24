import express from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(()=> {
    db = mongoClient.db("batepapouol_api");
});

const participantSchema = joi.object({
    name: joi.string().required()
});

app.post("/participants", async (req, res) => {

    const validation = participantSchema.validate(req.body);
    if (validation.error) {
        return res.sendStatus(422);
    }

    const { name } = req.body;
    const participants = await db.collection('participants').find().toArray();
    const repeated = participants.find(item => item.name === name);
    if (repeated) {
        return res.sendStatus(409);
    }

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

app.post("/status", (req, res) => {

    const { user } = req.headers;

    const promise = db.collection('participants').find({name: user}).toArray();
    promise.then(participant => {
        if (participant.length === 0) {
            res.sendStatus(404);
            return;
        }
        //modificar o lastStatus
        res.sendStatus(200);
    });
});

async function removeParticipant () {
    const now = Date.now();
    const participants = await db.collection('participants').find().toArray();
    const oldParticipants = participants.filter(item => item.lastStatus < (now - 10)).map(item => ({name: item.name}));

    for (let i = 0; i < oldParticipants.length; i++) {
        const deletado = await db.collection('participants').deleteOne(oldParticipants[i]);
        const message = {
            from: oldParticipants[i].name, 
            to: 'Todos', 
            text: 'sai da sala...', 
            type: 'status', 
            time: dayjs().format("HH:mm:ss")
        };
        db.collection('messages').insertOne(message);
    }
}

// setInterval(removeParticipant, 15000);


app.listen(5000);