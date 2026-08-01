import {inngest} from "../inngest";

export const testFunction = inngest.createFunction(
    {
        id:"here",
        triggers: [{event:"test/function"}]
    },
    async ({event,step}) => {
           await step.sleep("wait-a-moment", "1s");
           console.log(event.data.email)
           return { message: `Hello ${event.data.email}!` };
    }
)