import { appConfig } from "../utilities/app-config.js";
import { generateUUIDv7, updateBalanceFromAccount } from "../utilities/common-function.js";
import { getCache, deleteCache, setCache } from "../utilities/redis-connection.js";
import { createLogger } from "../utilities/logger.js";
import { getRandomMultiplier, logEventAndEmitResponse } from "../utilities/helper-function.js";
const betLogger = createLogger('Bets', 'jsonl');


export const placeBet = async (socket, bet) => {
    const betAmount = typeof bet == 'string' ? Number(bet) : null;
    if (!betAmount) return socket.emit('betError', 'Invalid Request');
    const cachedPlayerDetails = await getCache(`PL:${socket.id}`);
    if (!cachedPlayerDetails) return socket.emit('betError', 'Invalid Player Details');
    const playerDetails = JSON.parse(cachedPlayerDetails);
    const gameLog = { logId: generateUUIDv7(), player: playerDetails, betAmount };
    if (Number(playerDetails.balance) < betAmount) return logEventAndEmitResponse(gameLog, 'Insufficient Balance', 'bet', socket);
    if ((betAmount < appConfig.minBetAmount) || (betAmount > appConfig.maxBetAmount)) return logEventAndEmitResponse(gameLog, 'Invalid Bet', 'bet', socket);
    const matchId = generateUUIDv7();
    const matchData = await getResult(matchId, betAmount, playerDetails, socket);
    if (matchData['error']) return logEventAndEmitResponse(gameLog, matchData['error'], 'bet', socket);
    betLogger.info(JSON.stringify({ ...gameLog, matchData }));
    socket.bet = matchData;
    socket.emit('init_state', {
        message: 'Game_Started',
        mult: matchData.multiplier
    });
    await initMultiplier(socket);
};

async function initMultiplier(socket) {
    const resultMult = getRandomMultiplier();
    const interval = setInterval(async () => {
        socket.bet.multiplier += 0.01;
        const currentWin = (socket.bet.btAmt * socket.bet.multiplier).toFixed(2);
        socket.bet.winAmount = currentWin;
        socket.emit('running_state', {
            mult: Number(socket.bet.multiplier).toFixed(2),
            bank: Number(socket.bet.winAmount).toFixed(2)
        });
        if (socket.bet.multiplier >= resultMult) {
            socket.emit('end_state', {
                message: "Game Ended",
                mult: Number(socket.bet.multiplier).toFixed(2),
                status: 'LOSS',
                bank: 0.00
            });
            clearInterval(interval);
            delete socket.bet, socket.intervalId;
        }
    }, 50);
    socket.intervalId = interval;
};

export const handleCashout = async (socket) => {
    const cachedPlayerDetails = await getCache(`PL:${socket.id}`);
    if (!cachedPlayerDetails) return socket.emit('betError', 'Invalid Player Details');
    const playerDetails = JSON.parse(cachedPlayerDetails);
    if (!socket.bet) return socket.emit('betError', 'No active bet associated for cashout');
    const winAmount = Math.min(appConfig.maxCashoutAmount, Number(socket.bet.winAmount)).toFixed(2);
    const userIP = socket.handshake.headers?.['x-forwarded-for']?.split(',')[0].trim() || socket.handshake.address;
    const playerId = playerDetails.id.split(':')[1];
    const updateBalanceData = {
        id: socket.bet.match_id,
        winning_amount: winAmount,
        socket_id: playerDetails.socketId,
        txn_id: socket.bet.txn_id,
        user_id: playerId,
        ip: userIP
    };
    const isTransactionSuccessful = await updateBalanceFromAccount(updateBalanceData, "CREDIT", playerDetails);
    if (!isTransactionSuccessful) console.error(`Credit failed for user: ${playerDetails.userId} for round ${socket.bet.match_id}`);
    const creditPlayerDetails = await getCache(`PL:${playerDetails.socketId}`);
    if (creditPlayerDetails) {
        let parseduserDetails = JSON.parse(creditPlayerDetails);
        parseduserDetails.balance = (Number(parseduserDetails.balance) + Number(winAmount)).toFixed(2);
        await setCache(`PL:${parseduserDetails.socketId}`, JSON.stringify(parseduserDetails));
        socket.emit('info', { user_id: parseduserDetails.userId, operator_id: parseduserDetails.operatorId, balance: parseduserDetails.balance });
    };
    delete socket.bet, socket.intervalId;
    return socket.emit('end_state', {
        message: "Game Ended",
        mult: Number(socket.bet.multiplier).toFixed(2),
        status: 'WIN',
        bank: winAmount
    });
}


export const disconnect = async (socket) => {
    const cachedPlayerDetails = await getCache(`PL:${socket.id}`);
    if(!cachedPlayerDetails) return socket.disconnect(true);
    const cachedGame = socket.bet;
    if(cachedGame) await handleCashout(socket);
    await deleteCache(`PL:${socket.id}`);
    console.log("User disconnected:", socket.id);
};

