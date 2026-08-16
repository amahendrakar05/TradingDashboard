//#region src/server/defer-until-stream-consumed.ts
/**
* Defers cleanup until the downstream consumer drains or cancels the stream.
*/
function deferUntilStreamConsumed(stream, onFlush) {
	let called = false;
	const once = () => {
		if (!called) {
			called = true;
			onFlush();
		}
	};
	const cleanup = new TransformStream({ flush() {
		once();
	} });
	const reader = stream.pipeThrough(cleanup).getReader();
	return new ReadableStream({
		pull(controller) {
			return reader.read().then(({ done, value }) => {
				if (done) controller.close();
				else controller.enqueue(value);
			}, (error) => {
				once();
				controller.error(error);
			});
		},
		cancel(reason) {
			once();
			return reader.cancel(reason);
		}
	});
}
//#endregion
export { deferUntilStreamConsumed };
