import {createLogger, transports} from "winston";

export class ConsoleMessage {
	log: any;

	constructor() {
		this.log = createLogger({ transports: [new transports.Console()]});
	}

	info(message: string) {
		this.log.info(message);
	}

	error(message: string) {
		this.log.error(message);
	}

}
