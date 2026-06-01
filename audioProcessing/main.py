import os
import sys
import uvicorn
from fastapi import FastAPI
import inngest.fast_api
from dotenv import load_dotenv

load_dotenv()



from inngest.client import inngestClient
from functions.myfunction import myFunction
from functions.myfunction2 import myFunction2

app = FastAPI()

inngest.fast_api.serve(
    app,
    inngestClient,
    [myFunction,myFunction2]
)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)


