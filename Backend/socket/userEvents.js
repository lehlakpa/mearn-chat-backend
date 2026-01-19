import { Socket,Server as socketIOserver } from "socket.io";


export function registerUserEvents(io, socket) {
    socket.on("testSocket", (data) => {
        socket.emit("testSocket",{msg :"real time wroking fine :"});
    });
}
