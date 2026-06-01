import inngest
from inngest.client import inngestClient

@inngestClient.create_function(
    fn_id="my-function",
    trigger=inngest.TriggerEvent(event="app/my-event")
)
async def myFunction(ctx: inngest.Context) -> str:
    ctx.logger.info(ctx.event)
    return "done"
