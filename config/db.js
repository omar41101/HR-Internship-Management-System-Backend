import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const connectMongo = async () => {
    try{
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected!");
    }
    catch(err){
        console.log(err);
    }
}

export default connectMongo;