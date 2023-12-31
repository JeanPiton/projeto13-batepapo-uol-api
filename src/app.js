import express,{json} from "express"
import cors from "cors"
import dotenv from "dotenv"
import { MongoClient, ObjectId } from "mongodb"
import dayjs from "dayjs"
import joi from "joi"
dotenv.config()

const PORT = 5000
const server = express()
server.use(cors())
server.use(json())
server.listen(PORT,()=>{console.log(`Server running at http://localhost:${PORT}`)})

const mongoClient = new MongoClient(process.env.DATABASE_URL)
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
        if(!await db.collection("participants").findOne({name:`${user}`})){
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
    const userScheme = joi.object({user:joi.string().required()}).unknown(true)
    const scheme = joi.object({limit:joi.number().integer().positive().min(1).default(0)})
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
        ]}).limit(validation.value.limit).toArray()
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
        if(userDb.lastErrorObject.updatedExisting===false) return res.sendStatus(404)
        res.sendStatus(200)
    }catch(err){
        res.sendStatus(500)
    }
})

setInterval(async ()=>{
    try{
        const time = Date.now()
        const toDelete = await db.collection("participants").find({lastStatus:{$lt:time-10000}}).toArray()
        await db.collection("participants").deleteMany({lastStatus:{$lt:time-10000}})
        if(toDelete.length){
            const delMessage = toDelete.map(p=>{
                return {from:p.name,to:"Todos",text:"sai da sala...",type:"status",time:dayjs(time).format("HH:mm:ss")}
            })
            db.collection("messages").insertMany(delMessage)
        }  
    }catch(err){
        console.log(err)
    }
},15000)

server.delete("/messages/:ID_DA_MENSAGEM",async (req,res)=>{
    const {user} = req.headers
    const id = req.params.ID_DA_MENSAGEM.toString()
    const scheme = joi.object({user:joi.string().required()})
    const idScheme = joi.object({id:joi.string().hex().length(24).required()})
    const validation = scheme.validate({user})
    const idValidation= idScheme.validate({id})
    
    if(validation.error||idValidation.error) return res.sendStatus(422)
    try{
        const message = await db.collection("messages").findOne({_id:new ObjectId(id)})
        if(!message) return res.sendStatus(404)
        if(message.from != user) return res.sendStatus(401)
        await db.collection("messages").deleteOne({_id:message._id})
        res.sendStatus(200)
    }catch(err){
        res.sendStatus(500)
    }
})

server.put("/messages/:ID_DA_MENSAGEM",async (req,res)=>{
    const scheme = joi.object({
        to:joi.string().required(),
        text:joi.string().required(),
        type:joi.valid("message","private_message").required()
    })
    const userScheme = joi.object({user:joi.string().required()})
    const idScheme = joi.object({id:joi.string().hex().length(24).required()})
    const validation = scheme.validate(req.body)
    const userValidation = userScheme.validate({user:req.headers.user})
    const idValidation = idScheme.validate({id:req.params.ID_DA_MENSAGEM})
    
    if(validation.error||userValidation.error||idValidation.error) return res.sendStatus(422)
    try{
        const message = await db.collection("messages").findOne({_id:new ObjectId(idValidation.value.id)})
        if(!message) return res.sendStatus(404)
        if(message.from != userValidation.value.user) return res.sendStatus(401)
        await db.collection("messages").updateOne(message,{$set:{
            to:validation.value.to,
            text:validation.value.text,
            type:validation.value.type
        }}) 
        res.sendStatus(200)
    }catch(err){
        res.sendStatus(500)
    }
})