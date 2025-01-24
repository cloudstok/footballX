import { updateBalanceFromAccount } from "../../utilities/common-function.js";
import {  setCache } from "../../utilities/redis-connection.js";
import { insertSettlement } from "./bet-db.js";


export const sendBetRequest = async(matchId, betAmount, playerDetails, socket) => {
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
        txn_id: transaction.txn_id,
        multiplier: 1.00,
        crTs: Date.now(),
        upTs: Date.now() 
    }
    return matchData;
};
