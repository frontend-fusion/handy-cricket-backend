import express from 'express';
const app = express()
import { createServer } from "http";
import { Server } from "socket.io";
import { customAlphabet } from 'nanoid';

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*'
    }
});

const activeRooms = {};
let prevPlayerTotalScore = 0;

// const _dirname = path.resolve();
// if (process.env.NODE_ENV === 'production') {
//     app.use(express.static(path.join(_dirname, '/frontend/chatty/build')));
//     app.get('*', (req, res) => {
//         res.sendFile(path.resolve(_dirname, 'frontend', 'chatty', 'build', 'index.html'));
//     });
// }

io.on("connection", (socket) => {
    socket.on('create room', (userName) => {
        const roomId = generateRoomId();
        activeRooms[roomId] = {
            totalScore: 0,
            isBothPlayed: false,
            users: [{ userName: userName, score: 0, id: socket.id, makeMove: false}]
        }
        socket.join(roomId);
        socket.emit('room created', roomId);
    });

    socket.on('join room', (userName, roomId) => {
         roomId = roomId.toLowerCase();
        if (!activeRooms[roomId]) {
            socket.emit('room not found');
            return;
        }
        activeRooms[roomId]?.users?.push(
            {
                userName: userName,
                score: 0,
                makeMove: false,
                id: socket.id
            }
        );
        const room = activeRooms[roomId].users;
        if (room) {
            if (room.length <= 2) {
                socket.join(roomId);
                socket.emit('join room', roomId);
                if (room.length === 2) {
                    io.to(roomId).emit('can play now', roomId, activeRooms);
                }
            }
            else {
                socket.emit('room full');
            }
        } else {
            socket.emit('room not found');
        }
    });
    socket.on('player move', (roomId, move) => {
        const index = activeRooms[roomId].users.findIndex(user => user.id === socket.id);
        activeRooms[roomId].users[index].makeMove = true;
        activeRooms[roomId].users[index].score = move;

        if (!activeRooms[roomId].users[0]?.makeMove || !activeRooms[roomId].users[1]?.makeMove) {
            return;
        }

        if (!activeRooms[roomId]) {
            socket.emit('room not found');
            return;
        }

        else {        
            if (activeRooms[roomId].users[0].score === activeRooms[roomId].users[1].score && activeRooms[roomId].users[0].score) {
                activeRooms[roomId].users[0].score = 0;
                activeRooms[roomId].users[1].score = 0;
                activeRooms[roomId].users[0].makeMove = false;
                activeRooms[roomId].users[1].makeMove = false
                if(!activeRooms[roomId].isBothPlayed) {
                [activeRooms[roomId].users[0], activeRooms[roomId].users[1]] = [activeRooms[roomId].users[1], activeRooms[roomId].users[0]];
                activeRooms[roomId].isBothPlayed = true;
                prevPlayerTotalScore = activeRooms[roomId].totalScore;
                let batterScore = activeRooms[roomId].totalScore;
                activeRooms[roomId].totalScore = 0;
                io.to(roomId).emit('bowled out' , activeRooms[roomId].users[1].userName, activeRooms[roomId].users[0].userName, activeRooms, batterScore);
                }
                else {   
                const winner = +(prevPlayerTotalScore) > +(activeRooms[roomId].totalScore) ? activeRooms[roomId].users[1].userName : activeRooms[roomId].users[0].userName;
                const draw = prevPlayerTotalScore === activeRooms[roomId].totalScore;
                activeRooms[roomId].totalScore = 0;
                console.log(activeRooms[roomId]);
                io.to(roomId).emit('out', winner, draw, activeRooms);
                }
            }
            else if(activeRooms[roomId].isBothPlayed && prevPlayerTotalScore < activeRooms[roomId].totalScore+ +(activeRooms[roomId].users[0].score)) {
                io.to(roomId).emit('user2 won match', activeRooms[roomId].users[0].userName);
                console.log(activeRooms[roomId]);
            }
            else {
             console.log(activeRooms[roomId]);
            activeRooms[roomId].totalScore = activeRooms[roomId].totalScore + +(activeRooms[roomId].users[0].score);
            activeRooms[roomId].users[0].makeMove = false;
            activeRooms[roomId].users[1].makeMove = false;
            io.to(roomId).emit('score updated', activeRooms);
            }
        }

    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
        Object.keys(activeRooms).forEach((roomId) => {
            const index = activeRooms[roomId].users.findIndex(user => user.id === socket.id);
            if (index !== -1) {
                activeRooms[roomId].users.splice(index, 1);
                if (activeRooms[roomId].users.length === 0) {
                    delete activeRooms[roomId];
                }
            }
        });
    });
});


function generateRoomId() {
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const generateAlphabeticId = customAlphabet(alphabet, 4);
    return generateAlphabeticId().toLocaleLowerCase();
}

const port = process.env.PORT || 5000;
httpServer.listen(port, () => console.log('app is running'));
