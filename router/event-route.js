import { placeBet, handleCashout} from '../services/game-event.js';

export const registerEvents = async (socket) => {
    socket.on('message', (data) => {
        const event = data.split(':')
        switch (event[0]) {
            case 'PB': return placeBet(socket, event[1]);
            case 'CO' : return handleCashout(socket);
        }
    })
}
