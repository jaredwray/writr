import { Writr } from "../src/index";
import { Config } from "../src/config";
import { DataService } from "../src/data/dataService";

import * as del from "del";
import * as fs from "fs-extra";

describe('Writr', () => {

  let config: Config = new Config();

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
  });

  it("parse CLI", () => {
    let writr = new Writr();
  
    process.argv = [ '-c', './test/blog/config-test2.json', '-o', './out' ];

    writr.parseCLI(process);

    if(writr.config) {
      expect(writr.config.program.output).toBe("./out");
    } else {
      fail();
    }
  });

  it("cli run", async () => {
    let writr = new Writr();
  
    writr.parseCLI(process);

    writr.config = config;
    writr.data = new DataService(config);

    //create directory
    fs.ensureDirSync(config.output);

    let val = await writr.runCLI();

    expect(val).toBe(true);
  });

  it("cli run on path", async () => {
    let writr = new Writr();
  
    let p: any = {};
    p.argv = [ '',
    '',
    '-p',
    './blog_example' ];

    writr.parseCLI(p);

    if(writr.config) {
      expect(writr.config.path).toBe("./blog_example");
    } else {
      fail();
    }
  });

  it("cli run with no data set or config", async () => {
    let writr = new Writr();
  
    let p: any = {};
    p.argv = [ '',
    '',
    '-c', './blog_example/config.json', '-o', './out' ];

    writr.parseCLI(p);

    writr.config = undefined;
    writr.data = undefined;

    let val = await writr.runCLI();

    expect(val).toBe(false);
  });
  

});