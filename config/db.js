import dotenv from "dotenv";
import mongoose from "mongoose";

// Load the appropriate .env file
if (process.env.NODE_ENV === "test") {
    dotenv.config({ path: ".env.test" });
} else {
    dotenv.config();
}

// Connect MongoDB based on the NODE_ENV
const connectMongo = async () => {
    try {
        const URI = process.env.NODE_ENV === "test" ? process.env.MONGO_URI_TEST : process.env.MONGO_URI;

        // Only connect if the DB not already connected
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(URI);

            console.log(`MongoDB Connected!`);
        } else {
            console.log("MongoDB Already Connected!");
        }
    } catch (err) {
        console.log(err);
    }
};

export default connectMongo;