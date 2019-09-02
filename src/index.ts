import { Writr } from "./writr";
import { Logger, transports } from "winston";

const log = new Logger({ transports: [new transports.Console()] });

const writr = new Writr();

writr.parseCLI(process);

writr.runCLI().then(() => {
  process.exit();
  log.info("Done!");
});


