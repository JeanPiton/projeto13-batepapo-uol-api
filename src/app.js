import express,{json} from "express"
import cors from "cors"
import dotenv from "dotenv"
import { MongoClient } from "mongodb"
import dayjs from "dayjs"
import joi from "joi"
dotenv.config()

const PORT = 5000
const server = express()
server.use(cors())
server.use(json())
server.listen(PORT,()=>{console.log(`Server running at http://localhost:${PORT}`)})

const mongoClient = new MongoClient(process.env.MONGO_URL)
try{
   mongoClient.connect() 
}catch(err){
    console.log(err)
}
const db = mongoClient.db()

server.post('/participants',async (req,res)=>{
    const {name} = req.body
    const scheme = joi.object({name:joi.string().required()})
    const validation = scheme.validate(req.body)
    if(validation.error){
        return res.sendStatus(422)
    }
    try{
        if(await db.collection("participants").findOne({name:`${name}`})){
            return res.sendStatus(409)
        }    
        await db.collection("participants").insertOne({name:`${name}`,lastStatus:Date.now()})
        await db.collection("messages").insertOne({
            from:`${name}`,
            to:'Todos',
            text:'entra na sala...',
            type:'status',
            time:`${dayjs().format("HH:mm:ss")}`
        })
        res.sendStatus(201)
    }catch(err){
        return res.sendStatus(500)
    }
})

server.get('/participants',async (req,res)=>{
    try{
        const p = await db.collection("participants").find().toArray()
        res.status(200).send(p)
    }catch(err){
        return res.sendStatus(500)
    }
    
})

server.post('/messages',async (req,res)=>{
    const {to,text,type} = req.body
    const {user} = req.headers
    const scheme = joi.object({
        to:joi.string().required(),
        text:joi.string().required(),
        type:joi.valid('message','private_message').required()
    })
    const userScheme = joi.object({user:joi.string().required()}).unknown(true)
    const userValidation = userScheme.validate(req.headers)
    const validation = scheme.validate(req.body)
    if(validation.error||userValidation.error){
        console.log(validation.error)
        console.log(userValidation.error)
        return res.sendStatus(422)
    }
    try{
        if(!await db.collection("participants").find({name:`${user}`}).toArray()){
            return res.sendStatus(422)
        }
        await db.collection("messages").insertOne({
            from:`${user}`,
            to:`${to}`,
            text:`${text}`,
            type:`${type}`,
            time:`${dayjs().format("HH:mm:ss")}`
        })
        res.sendStatus(201)
    }catch(err){
        console.log(err)
        return res.sendStatus(500)
    }
})

server.get("/messages",async (req,res)=>{
    const {user} = req.headers
    const {limit} = req.query
    const userScheme = joi.object({user:joi.string().required()}).unknown(true)
    const scheme = joi.object({limit:joi.number().integer().positive().min(1)})
    const userValidation = userScheme.validate(req.headers)
    const validation = scheme.validate(req.query)
    if(validation.error||userValidation.error){
        return res.sendStatus(422)
    }
    try{
        const messages = await db.collection("messages").find({$or:[
            {to:"Todos"},
            {to:user},
            {type:"message"},
            {from:user}
        ]}).limit(limit).toArray()
        res.send(messages)
    }catch(err){
        res.sendStatus(500)
    }
})

server.post("/status",async (req,res)=>{
    const {user} = req.headers
    const scheme = joi.object({user:joi.string().required()}).unknown(true)
    const validation = scheme.validate(req.headers)
    if(validation.error) return res.sendStatus(404)
    try{
        const userDb = await db.collection("participants").findOneAndUpdate({name:user},{$set:{lastStatus:Date.now()}})
        res.sendStatus(200)
    }catch(err){
        res.sendStatus(500)
    }
})