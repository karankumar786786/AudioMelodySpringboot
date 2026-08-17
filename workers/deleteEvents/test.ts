import {config} from "dotenv";
import { deleteObject } from "./lib/s3";


config();

(async () => {
    // console.log(process.env.PRODUCTION_BUCKET_NAME);
    await deleteObject(process.env.PRODUCTION_BUCKET_NAME!,"audios/40b94454-33e4-4742-b43c-f076adedff62");
    console.log("deleted");
})();