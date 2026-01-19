import { Socket,Server as socketIOserver } from "socket.io";


export function registerUserEvents(io: socketIOserver, socket: Socket) {
    socket.on("user:join", async (data) => {
        socket.emit("testsocket",{msg :"its working :"});
        console.log(`User ${socket.data.userId} joined their own room.`);
    });
}
