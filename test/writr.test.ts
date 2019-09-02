import { Writr } from "../src/writr";
import { Config, ConfigData } from "../src/config";
import { DataService } from "../src/data/dataService";
import { expect } from "chai";
import "mocha";

import * as del from "del";
import * as fs from "fs-extra";

describe('Writr', () => {

  let config: Config = new Config();

  beforeEach(() => {
    config.data = new ConfigData();
    config.data.type = "file";
    config.data.postPath = __dirname + "/blog";
    config.data.contentPath = __dirname + "/blog/content";
    config.data.templatePath = __dirname + "/blog/templates";
    config.program.output = "./out"
  });

  it("parse CLI", () => {
    let writr = new Writr();
  
    let process: any = {};
    process.argv = [ '-c', './test/blog/config-test2.json', '-o', './out' ]

    writr.parseCLI(process);

    expect(writr.config.program.output).to.equal("./out");
  });

  it("cli run", async () => {
    let writr = new Writr();
  
    let process: any = {};
    process.argv = [ '-c', './test/blog/config-test2.json', '-o', './out' ]

    writr.parseCLI(process);

    writr.config = config;
    writr.dataStore = new DataService(config);

    let val = await writr.runCLI();

    //cleanup
    if (fs.existsSync(config.program.output)) {
      del.sync(config.program.output);
    }

    expect(val).to.equal(true);
  });

  it("cli run with no datastore or config", async () => {
    let writr = new Writr();
  
    let process: any = {};
    process.argv = [ '-c', './test/blog/config.json', '-o', './out' ]

    writr.parseCLI(process);

    writr.config = undefined;
    writr.dataStore = undefined;

    let val = await writr.runCLI();

    expect(val).to.equal(false);
  });
  

});