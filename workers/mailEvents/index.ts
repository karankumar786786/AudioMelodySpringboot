import {redis} from "./Redis";
import {sendMail} from "./NodeMailer";
import {config} from "dotenv";
config();

interface Data{
    to:string,
    subject:string,
    otp: string
}

;(async (mailQueue:string) => {
    try {
        console.log("mail server worker is started",mailQueue);
        while(true){
            const result = await redis.blpop(mailQueue,5); //5 sec wait untill null
            if (result && result[1]) {
                const data:Data = JSON.parse(result[1]);
                try {
                    await sendMail(data.to,data.subject,data.otp);
                } catch (error) {
                    await redis.rpush(mailQueue,JSON.stringify(data));
                }
            }
        }
    } catch (error) {
        
    }
})(process.env.MAIL_QUEUE!);