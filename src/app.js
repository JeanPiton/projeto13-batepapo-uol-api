import express,{json} from "express"
import cors from "cors"
import dotenv from "dotenv"
import { MongoClient } from "mongodb"
import dayjs from "dayjs"
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
    if(!name && typeof name != string){
        return res.sendStatus(422)
    }
    try{
        if(await db.collection("participants").findOne({name:`${name}`})){
            return res.sendStatus(409)
        }    
        await db.collection("participants").insertOne({name:`${name}`,lastStatus:`${Date.now()}`})
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
    const p = await db.collection("participants").find().toArray()
    res.send(p)
})