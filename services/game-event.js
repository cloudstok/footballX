import { appConfig } from "../utilities/app-config.js";
import { generateUUIDv7, updateBalanceFromAccount } from "../utilities/common-function.js";
import { getCache, deleteCache, setCache } from "../utilities/redis-connection.js";
import { createLogger } from "../utilities/logger.js";
import { getRandomMultiplier, logEventAndEmitResponse } from "../utilities/helper-function.js";
import { initBetRequest } from '../module/bets/bet-session.js';
import { insertSettlement } from "../module/bets/bet-db.js";
const userLocks = new Map();
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
    const matchData = await initBetRequest(matchId, betAmount, playerDetails, socket);
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
    socket.bet.matchMult = resultMult;
    const interval = setInterval(async () => {
        if (!socket.bet) {
            clearInterval(interval);
            return;
        }
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
                mult: '0.00',
                status: 'LOSS',
                bank: '0.00'
            });
            await insertSettlement({
                matchId: socket.bet.match_id,
                operatorId: socket.bet.opId,
                userId: socket.bet.uId,
                betAmount: socket.bet.btAmt,
                multiplier: 0.00,
                matchMaxMult: socket.bet.matchMult,
                winAmount: 0.00,
                status: 'loss'
            });
            clearInterval(interval);
            delete socket.bet, delete socket.intervalId;
        }
    }, 70);
    socket.intervalId = interval;
};

const acquireLock = async (user_id) => {
    while (userLocks.get(user_id)) {
        await userLocks.get(user_id);
    }

    let resolveLock;
    const lockPromise = new Promise((resolve) => {
        resolveLock = resolve;
    });

    userLocks.set(user_id, lockPromise);

    return () => {
        resolveLock();
        userLocks.delete(user_id);
    };
};

export const handleCashout = async (socket) => {
    const cachedPlayerDetails = await getCache(`PL:${socket.id}`);
    if (!cachedPlayerDetails) return socket.emit('betError', 'Invalid Player Details');
    const playerDetails = JSON.parse(cachedPlayerDetails);
    const releaseLock = await acquireLock(`${playerDetails.operatorId}:${playerDetails.userId}`);
    try{
        if (!socket.bet) return socket.emit('betError', 'No active bet associated for cashout');
        const winAmount = Math.min(appConfig.maxCashoutAmount, Number(socket.bet.winAmount)).toFixed(2);
        if (Number(winAmount) > 0) {
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
                let parsedUserDetails = JSON.parse(creditPlayerDetails);
                parsedUserDetails.balance = (Number(parsedUserDetails.balance) + Number(winAmount)).toFixed(2);
                await setCache(`PL:${parsedUserDetails.socketId}`, JSON.stringify(parsedUserDetails));
                socket.emit('info', { user_id: parsedUserDetails.userId, operator_id: parsedUserDetails.operatorId, balance: parsedUserDetails.balance });
            };
        }
        if (socket.intervalId) clearInterval(socket.intervalId);
        await insertSettlement({
            matchId: socket.bet.match_id,
            operatorId: socket.bet.opId,
            userId: socket.bet.uId,
            betAmount: socket.bet.btAmt,
            multiplier: Number(winAmount) > 0 ? socket.bet.multiplier : '0.00',
            matchMaxMult: socket.bet.matchMult,
            winAmount: winAmount,
            status: Number(winAmount) > 0 ? 'win' : 'loss'
        });
        socket.emit('end_state', {
            message: "Game Ended",
            mult: Number(winAmount) > 0 ?  Number(socket.bet.multiplier).toFixed(2) : '0.00',
            status: Number(winAmount) > 0 ? 'WIN' : 'LOSS',
            bank: winAmount
        });
        if (socket.intervalId) clearInterval(socket.intervalId);
        delete socket.bet, delete socket.intervalId;
        return;
    } catch(err){
        console.err(err);
        return;
    } finally{
        releaseLock();
    }
}


export const disconnect = async (socket) => {
    const cachedPlayerDetails = await getCache(`PL:${socket.id}`);
    if (!cachedPlayerDetails) return socket.disconnect(true);
    const cachedGame = socket.bet;
    if (cachedGame) await handleCashout(socket);
    await deleteCache(`PL:${socket.id}`);
    console.log("User disconnected:", socket.id);
};

