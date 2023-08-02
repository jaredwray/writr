import {ConsoleMessage} from "../src/log";

describe('log', () => {

	const logger = new ConsoleMessage()

	logger.log.info = jest.fn()
	logger.log.error = jest.fn()

	it('should run winston log info', () => {

		logger.info('test');

		expect(logger.log.info).toHaveBeenCalled();

	})

	it('should run winston log error', () => {

		logger.error('test');

		expect(logger.log.error).toHaveBeenCalled();

	})
})
