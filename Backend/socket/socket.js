import dotenv from "dotenv";
dotenv.config();
import {Socket, Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { registerUserEvents } from "./userEvents";


export function initializeSocket(server) {  
    const io = new SocketIOServer(server, {
        cors: {
            origin: process.env.CLIENT_URL,
            methods: ["GET", "POST"],
        },
    });
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error("Authentication error"));
        }
        
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return next(new Error("Authentication error"));
            }
            // The token payload is the user object itself, not nested in 'user'
            // Also, token.js maps _id to id
            socket.data.user = decoded;
            socket.data.userId = decoded.id;

            next();
        });
    });
    io.on("connection", async (socket) => {
        const userId=socket.data.userId;
        console.log(`User Connected ${userId}, username ${socket.data.user.name}`);


// registering events 
        registerUserEvents(io, socket);



        socket.on("disconnect", () => {
            //user logs out
            console.log(`User Disconnected ${userId}`);
        });
    });
}