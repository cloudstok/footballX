import { updateBalanceFromAccount } from "../../utilities/common-function.js";
import { read } from "../../utilities/db-connection.js";
import {  setCache } from "../../utilities/redis-connection.js";

export const initBetRequest = async (matchId, betAmount, playerDetails, socket) => {
    const userIP = socket.handshake.headers?.['x-forwarded-for']?.split(',')[0].trim() || socket.handshake.address;
    const playerId = playerDetails.id.split(':')[1];

    const updateBalanceData = {
        id: matchId,
        bet_amount: betAmount,
        socket_id: playerDetails.socketId,
        user_id: playerId,
        ip: userIP
    };

    const transaction = await updateBalanceFromAccount(updateBalanceData, "DEBIT", playerDetails);
    if (!transaction) return { error: 'Bet Cancelled by Upstream' };
    playerDetails.balance = (playerDetails.balance - betAmount).toFixed(2);
    await setCache(`PL:${playerDetails.socketId}`, JSON.stringify(playerDetails));
    socket.emit('info', { user_id: playerDetails.userId, operator_id: playerDetails.operatorId, balance: playerDetails.balance });
    const matchData = {
        uId: playerDetails.userId,
        opId: playerDetails.operatorId,
        btAmt: betAmount,
        match_id: matchId,
        winAmount: 0.00,
        txn_id: transaction.txn_id,
        multiplier: 1.00,
        crTs: Date.now(),
        upTs: Date.now() 
    }
    return matchData;
};

export const betHistory = async(userId, operatorId, socket) => {
    const data = await read(`SELECT max_mult, bet_amount, win_amount, created_at FROM settlement WHERE user_id = ? AND operator_id = ? ORDER BY created_at desc LIMIT 30`, [userId, operatorId]);
    return socket.emit('betHistory', data);
}