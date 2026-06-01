import logging
import inngest

inngestClient = inngest.Inngest(
    app_id="my_app",
    logger=logging.getLogger("uvicorn")
)
