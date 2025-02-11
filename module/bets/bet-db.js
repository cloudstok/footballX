import { write } from "../../utilities/db-connection.js";


export const insertSettlement = async(data)=> {
    try{
        const { matchId, operatorId, userId, betAmount, multiplier, matchMaxMult, winAmount, status} = data;
        const decodeUserId = decodeURIComponent(userId);
        await write(`INSERT INTO settlement (lobby_id, user_id, operator_id, bet_amount, max_mult, match_max_mult, win_amount, status) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`, [matchId, decodeUserId, operatorId, parseFloat(betAmount), multiplier, matchMaxMult, winAmount, status]);
        console.log(`Settlement data inserted successfully`);
    }catch(err){
        console.error(`Err while inserting data in table is:::`, err);
    }
}