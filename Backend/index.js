
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
dotenv.config();
import connectDB from "./config/database.js";

import authRoutes from "./routes/auth.routes.js";

import { Server } from "socket.io";
const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);

app.get("/", (req, res) => {
    res.send("server is running");
})

const PORT = process.env.PORT || 3000
const server = http.createServer(app);

connectDB().then(() => {
    console.log("database connected successfully");
    server.listen(PORT, () => {
        console.log(`server is running on port ${PORT}`);
    });

}).catch((error)=>{
   console.log("failed to load data due to database connnection:",error) ;
})
