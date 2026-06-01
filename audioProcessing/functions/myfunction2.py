import inngest
from inngest.client import inngestClient

@inngestClient.create_function(
    fn_id="my-function2",
    trigger=inngest.TriggerEvent(event="app/my-event2")
)
async def myFunction2(ctx: inngest.Context) -> str:
    ctx.logger.info(ctx.event)
    return "done"
