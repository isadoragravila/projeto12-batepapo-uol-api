import express from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import { stripHtml } from "string-strip-html";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
    db = mongoClient.db("batepapouol_api");
});

const participantSchema = joi.object({
    name: joi.string().required()
});

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required()
});

app.post("/participants", async (req, res) => {
    const validation = participantSchema.validate(req.body);
    if (validation.error) {
        return res.sendStatus(422);
    }

    const name = stripHtml(req.body.name).result.trim();
    const participants = await db.collection('participants').find().toArray();
    const repeated = participants.find(item => item.name === name);
    if (repeated) {
        return res.sendStatus(409);
    }

    const participant = { name, lastStatus: Date.now() };
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

app.get("/participants", async (req, res) => {
    try {
        const participants = await db.collection('participants').find().toArray();
        res.send(participants);
    } catch (error) {
        res.status(500).send(error);
    }
});

app.post("/messages", async (req, res) => {
    const validation = messageSchema.validate(req.body);
    if (validation.error) {
        return res.sendStatus(422);
    }

    const user = stripHtml(req.headers.user).result.trim();
    const participants = await db.collection('participants').find().toArray();
    const repeated = participants.find(item => item.name === user);
    if (!repeated) {
        return res.sendStatus(409);
    }

    const to = stripHtml(req.body.to).result.trim();
    const text = stripHtml(req.body.text).result.trim();
    const type = stripHtml(req.body.type).result.trim();
    const message = {
        from: user,
        to,
        text,
        type,
        time: dayjs().format("HH:mm:ss")
    };

    db.collection('messages').insertOne(message);

    res.sendStatus(201);
});

app.get("/messages", async (req, res) => {
    const { limit } = req.query;
    const { user } = req.headers;
    const messages = await db.collection('messages').find().toArray();
    
    const userMessages = messages.filter(item => {
        if (item.from === user || item.type === 'message' || item.type === 'status') {
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
        res.send(userMessages.slice(userMessages.length - limit, userMessages.length));
    }
});

app.post("/status", async (req, res) => {
    const { user } = req.headers;
    const participant = await db.collection('participants').findOne({ name: user });
    if (!participant) {
        return res.sendStatus(404);
    }

    await db.collection('participants').updateOne(
        { name: user },
        { $set: { lastStatus: Date.now() } }
    );

    res.sendStatus(200);
});

async function removeParticipant() {
    const participants = await db.collection('participants').find().toArray();
    const oldParticipants = participants
    .filter(item => item.lastStatus < (Date.now() - 10000))
    .map(item => ({ name: item.name }));

    for (let i = 0; i < oldParticipants.length; i++) {
        await db.collection('participants').deleteOne(oldParticipants[i]);
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

setInterval(removeParticipant, 15000);

app.delete("/messages/:id", async (req, res) => {
    const id = req.params.id;
    const { user } = req.headers;

    const messageId = await db.collection('messages').findOne({ _id: new ObjectId(id) });
    if (!messageId) {
        return res.sendStatus(404);
    }
    if (messageId.from !== user) {
        return res.sendStatus(401);
    }

    await db.collection('messages').deleteOne({ _id: new ObjectId(id) });
    res.sendStatus(200);
});

app.listen(5000);